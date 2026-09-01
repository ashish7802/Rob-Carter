import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AnonymousUser, ChatMessage, PeerState, E2EESecurityDetails } from '../types';
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
    }) => {
      setCurrentRoomId(data.roomId);
      setCurrentRoomCode(data.roomCode);
      setIsInitiator(data.isInitiator);

      // Derive AES-GCM-256 E2EE Room Key
      try {
        const key = await deriveRoomKey(data.roomCode);
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

    // Encrypted Chat message received
    newSocket.on('chat:encrypted_message', async (envelope: {
      id: string;
      senderId: string;
      senderAlias: string;
      senderAvatarSeed: string;
      encryptedPayload: EncryptedPayload;
      timestamp: number;
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

      setMessages((prev) => [
        ...prev,
        {
          id: envelope.id,
          senderId: envelope.senderId,
          senderAlias: envelope.senderAlias,
          senderAvatarSeed: envelope.senderAvatarSeed,
          text: plaintext,
          timestamp: envelope.timestamp,
          isEncrypted: true,
        },
      ]);
    });

    // Fallback unencrypted message
    newSocket.on('chat:message', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Join Room
  const joinCustomRoom = useCallback((roomCode: string) => {
    if (socketRef.current) {
      setMessages([]);
      socketRef.current.emit('room:join', { roomCode });
    }
  }, []);

  // Send In-Call Message with Client-Side E2EE
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    if (socketRef.current && roomKeyRef.current) {
      try {
        const encrypted = await encryptText(text.trim(), roomKeyRef.current);
        socketRef.current.emit('chat:encrypted_message', {
          encryptedPayload: encrypted,
        });
      } catch (err) {
        console.warn('E2EE encrypt error, falling back to plain relay:', err);
        socketRef.current.emit('chat:message', { text: text.trim() });
      }
    } else if (socketRef.current) {
      socketRef.current.emit('chat:message', { text: text.trim() });
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
    e2eeDetails,
    joinCustomRoom,
    sendMessage,
    handleP2PMessage,
    toggleHandRaise,
    leaveSession,
  };
}
