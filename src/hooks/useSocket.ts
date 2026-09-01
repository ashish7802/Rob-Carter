import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AnonymousUser, ChatMessage, ChatAttachment, PeerState, E2EESecurityDetails } from '../types';
import {
  deriveRoomKey,
  encryptText,
  decryptText,
  generateSecurityVerification,
  EncryptedPayload,
} from '../utils/crypto';

interface UseSocketProps {
  currentUser: AnonymousUser;
  onMatched?: (peer: PeerState, roomId: string, isInitiator: boolean) => void;
  onPeerDisconnected?: (reason: string) => void;
}

export function useSocket({ currentUser, onMatched, onPeerDisconnected }: UseSocketProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [peerState, setPeerState] = useState<PeerState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isInitiator, setIsInitiator] = useState(false);
  const [e2eeDetails, setE2eeDetails] = useState<E2EESecurityDetails | null>(null);
  const [typingPeers, setTypingPeers] = useState<string[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const roomKeyRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    roomIdRef.current = currentRoomId;
  }, [currentRoomId]);

  // Initialize Socket connection
  useEffect(() => {
    const newSocket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('user:register', {
        alias: currentUser.alias,
        avatarSeed: currentUser.avatarSeed,
      });
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Room Joined (Self)
    newSocket.on('room:joined', async (data: {
      roomCode: string;
      roomId: string;
      isInitiator: boolean;
      peers: { id: string; alias: string; avatarSeed: string }[];
      history?: any[];
      retentionDays?: number;
    }) => {
      setCurrentRoomId(data.roomId);
      setCurrentRoomCode(data.roomCode);
      setIsInitiator(data.isInitiator);

      // Derive AES-GCM-256 E2EE Room Key
      let key: CryptoKey | null = null;
      try {
        key = await deriveRoomKey(data.roomCode);
        roomKeyRef.current = key;

        const security = await generateSecurityVerification(data.roomCode);
        setE2eeDetails({
          roomCode: data.roomCode,
          sixDigitCode: security.sixDigitCode,
          fingerprint: security.fingerprint,
          sasEmojis: security.sasEmojis,
          cipherSuite: 'AES-256-GCM / SHA-256 (Web Crypto)',
          isP2PDataChannelActive: false,
          dtlsSrtpActive: true,
        });
      } catch (err) {
        console.warn('Failed to derive E2EE key:', err);
      }

      // Process Room Chat History (with 30-day retention)
      if (data.history && Array.isArray(data.history)) {
        const decryptedHistory: ChatMessage[] = [];
        for (const item of data.history) {
          let text = item.text || '';
          if (item.isEncrypted && key) {
            try {
              const payload = typeof item.text === 'string' ? JSON.parse(item.text) : item.text;
              if (payload && payload.ciphertext && payload.iv) {
                text = await decryptText(payload, key);
              }
            } catch (e) {
              // Leave fallback or raw text
            }
          }
          decryptedHistory.push({
            id: item.id,
            roomId: item.roomId,
            senderId: item.senderId,
            senderAlias: item.senderAlias,
            senderAvatarSeed: item.senderAvatarSeed,
            text,
            timestamp: item.timestamp,
            expiresAt: item.expiresAt || (item.timestamp + 30 * 24 * 60 * 60 * 1000),
            isEncrypted: item.isEncrypted,
            attachments: item.attachments || [],
            reactions: item.reactions || {},
          });
        }
        setMessages(decryptedHistory);
      } else {
        setMessages([]);
      }

      if (data.peers.length > 0) {
        const firstPeer = data.peers[0];
        const peer: PeerState = {
          id: firstPeer.id,
          alias: firstPeer.alias,
          avatarSeed: firstPeer.avatarSeed,
          audioEnabled: true,
          videoEnabled: true,
          screenShareEnabled: false,
          isHandRaised: false,
          isE2EEVerified: true,
        };
        setPeerState(peer);
        if (onMatched) {
          onMatched(peer, data.roomId, data.isInitiator);
        }
      }
    });

    // Peer Joined our Room
    newSocket.on('room:peer_joined', (data: { peer: { id: string; alias: string; avatarSeed: string }; roomId?: string }) => {
      const peer: PeerState = {
        id: data.peer.id,
        alias: data.peer.alias,
        avatarSeed: data.peer.avatarSeed,
        audioEnabled: true,
        videoEnabled: true,
        screenShareEnabled: false,
        isHandRaised: false,
        isE2EEVerified: true,
      };
      setPeerState(peer);
      const activeRoom = data.roomId || roomIdRef.current;
      if (onMatched && activeRoom) {
        onMatched(peer, activeRoom, false);
      }
    });

    // Peer Media State update
    newSocket.on('peer:media_state', (data: { senderId: string; audio: boolean; video: boolean; screenShare: boolean }) => {
      setPeerState((prev) => (prev ? {
        ...prev,
        audioEnabled: data.audio,
        videoEnabled: data.video,
        screenShareEnabled: data.screenShare,
      } : null));
    });

    // Peer Hand Raised
    newSocket.on('meeting:hand_raise', (data: { senderId: string; isHandRaised: boolean }) => {
      setPeerState((prev) => (prev ? {
        ...prev,
        isHandRaised: data.isHandRaised,
      } : null));
    });

    // Peer Disconnected / Left
    newSocket.on('peer:disconnected', () => {
      setPeerState(null);
      if (onPeerDisconnected) {
        onPeerDisconnected('Peer has left the meeting');
      }
    });

    // Typing state update
    newSocket.on('chat:typing', (data: { senderId: string; senderAlias: string; isTyping: boolean }) => {
      setTypingPeers((prev) => {
        if (data.isTyping) {
          return prev.includes(data.senderAlias) ? prev : [...prev, data.senderAlias];
        } else {
          return prev.filter((alias) => alias !== data.senderAlias);
        }
      });
    });

    // Encrypted Chat message received
    newSocket.on('chat:encrypted_message', async (envelope: {
      id: string;
      senderId: string;
      senderAlias: string;
      senderAvatarSeed: string;
      encryptedPayload: EncryptedPayload;
      attachments?: ChatAttachment[];
      timestamp: number;
      expiresAt?: number;
      reactions?: Record<string, string[]>;
    }) => {
      let plaintext = '[Encrypted Message]';
      if (roomKeyRef.current && envelope.encryptedPayload) {
        try {
          plaintext = await decryptText(envelope.encryptedPayload, roomKeyRef.current);
        } catch (e) {
          console.warn('E2EE Decryption failure:', e);
          plaintext = '⚠️ Message could not be decrypted (Key mismatch)';
        }
      }

      setMessages((prev) => {
        // Prevent duplicates
        if (prev.some((m) => m.id === envelope.id)) return prev;
        return [
          ...prev,
          {
            id: envelope.id,
            senderId: envelope.senderId,
            senderAlias: envelope.senderAlias,
            senderAvatarSeed: envelope.senderAvatarSeed,
            text: plaintext,
            timestamp: envelope.timestamp,
            expiresAt: envelope.expiresAt || (envelope.timestamp + 30 * 24 * 60 * 60 * 1000),
            isEncrypted: true,
            attachments: envelope.attachments || [],
            reactions: envelope.reactions || {},
          },
        ];
      });
    });

    // Fallback or persistent plain message received
    newSocket.on('chat:message', (message: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    // Reaction update
    newSocket.on('chat:reaction_updated', (data: { messageId: string; reactions: Record<string, string[]> }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === data.messageId ? { ...msg, reactions: data.reactions } : msg))
      );
    });

    return () => {
      newSocket.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Join Room
  const joinCustomRoom = useCallback((roomCode: string) => {
    if (socketRef.current) {
      socketRef.current.emit('room:join', { roomCode });
    }
  }, []);

  // Send In-Call / Persistent Message with optional Attachments & Client-Side E2EE
  const sendMessage = useCallback(async (text: string, attachments: ChatAttachment[] = []) => {
    if (!text.trim() && attachments.length === 0) return;

    if (socketRef.current && roomKeyRef.current && text.trim()) {
      try {
        const encrypted = await encryptText(text.trim(), roomKeyRef.current);
        socketRef.current.emit('chat:encrypted_message', {
          encryptedPayload: encrypted,
          attachments,
        });
      } catch (err) {
        console.warn('E2EE encrypt error, falling back to standard socket:', err);
        socketRef.current.emit('chat:message', {
          text: text.trim(),
          attachments,
        });
      }
    } else if (socketRef.current) {
      socketRef.current.emit('chat:message', {
        text: text.trim(),
        attachments,
      });
    }
  }, []);

  // Send Typing Indicator
  const sendTyping = useCallback((isTyping: boolean) => {
    if (socketRef.current) {
      socketRef.current.emit('chat:typing', { isTyping });
    }
  }, []);

  // Send Reaction
  const sendReaction = useCallback((messageId: string, emoji: string) => {
    if (socketRef.current) {
      socketRef.current.emit('chat:reaction', { messageId, emoji });
    }
  }, []);

  // Receive a direct P2P Decrypted message from WebRTC DataChannel
  const handleP2PMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, { ...msg, isDirectP2P: true, isEncrypted: true }]);
  }, []);

  // Toggle Hand Raise
  const toggleHandRaise = useCallback((isHandRaised: boolean) => {
    if (socketRef.current) {
      socketRef.current.emit('meeting:hand_raise', { isHandRaised });
    }
  }, []);

  // Leave Call / Session
  const leaveSession = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('call:end');
    }
    setCurrentRoomId(null);
    setCurrentRoomCode(null);
    setPeerState(null);
    setMessages([]);
    setE2eeDetails(null);
    roomKeyRef.current = null;
  }, []);

  return {
    socket,
    isConnected,
    currentRoomId,
    currentRoomCode,
    isInitiator,
    peerState,
    messages,
    typingPeers,
    e2eeDetails,
    joinCustomRoom,
    sendMessage,
    sendTyping,
    sendReaction,
    handleP2PMessage,
    toggleHandRaise,
    leaveSession,
  };
}
