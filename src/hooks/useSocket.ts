import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AnonymousUser, ChatMessage, PeerState, DrawStroke, ReactionPayload } from '../types';
import { soundFx } from '../utils/soundEffects';
import confetti from 'canvas-confetti';

interface UseSocketProps {
  currentUser: AnonymousUser;
  onMatched?: (peer: PeerState, roomId: string, isInitiator: boolean) => void;
  onPeerDisconnected?: (reason: string) => void;
}

export function useSocket({ currentUser, onMatched, onPeerDisconnected }: UseSocketProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineStats, setOnlineStats] = useState({ onlineUsers: 1, inQueue: 0 });
  const [isSearching, setIsSearching] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [peerState, setPeerState] = useState<PeerState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji?: string; alias: string }[]>([]);
  const [whiteboardStrokes, setWhiteboardStrokes] = useState<DrawStroke[]>([]);
  const [isInitiator, setIsInitiator] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      console.log('[Socket Connected]:', newSocket.id);
      setIsConnected(true);
      newSocket.emit('user:register', {
        alias: currentUser.alias,
        avatarSeed: currentUser.avatarSeed,
      });
    });

    newSocket.on('disconnect', () => {
      console.log('[Socket Disconnected]');
      setIsConnected(false);
    });

    newSocket.on('stats:update', (data: { onlineUsers: number; inQueue: number }) => {
      setOnlineStats(data);
    });

    // Stranger matched
    newSocket.on('matched', (data: {
      roomId: string;
      isInitiator: boolean;
      peer: { id: string; alias: string; avatarSeed: string; sharedInterests?: string[] };
    }) => {
      setIsSearching(false);
      setCurrentRoomId(data.roomId);
      setCurrentRoomCode(null);
      setIsInitiator(data.isInitiator);

      const peer: PeerState = {
        id: data.peer.id,
        alias: data.peer.alias,
        avatarSeed: data.peer.avatarSeed,
        sharedInterests: data.peer.sharedInterests || [],
        audioEnabled: true,
        videoEnabled: true,
        screenShareEnabled: false,
      };

      setPeerState(peer);
      setMessages([]);
      setWhiteboardStrokes([]);
      soundFx.playMatched();

      if (onMatched) {
        onMatched(peer, data.roomId, data.isInitiator);
      }
    });

    // Custom Room Joined
    newSocket.on('room:joined', (data: {
      roomCode: string;
      roomId: string;
      isInitiator: boolean;
      peers: { id: string; alias: string; avatarSeed: string }[];
    }) => {
      setCurrentRoomId(data.roomId);
      setCurrentRoomCode(data.roomCode);
      setIsInitiator(data.isInitiator);

      if (data.peers.length > 0) {
        const firstPeer = data.peers[0];
        const peer: PeerState = {
          id: firstPeer.id,
          alias: firstPeer.alias,
          avatarSeed: firstPeer.avatarSeed,
          audioEnabled: true,
          videoEnabled: true,
          screenShareEnabled: false,
        };
        setPeerState(peer);
        soundFx.playMatched();
        if (onMatched) {
          onMatched(peer, data.roomId, data.isInitiator);
        }
      }
    });

    // Peer Joined our custom room
    newSocket.on('room:peer_joined', (data: { peer: { id: string; alias: string; avatarSeed: string } }) => {
      const peer: PeerState = {
        id: data.peer.id,
        alias: data.peer.alias,
        avatarSeed: data.peer.avatarSeed,
        audioEnabled: true,
        videoEnabled: true,
        screenShareEnabled: false,
      };
      setPeerState(peer);
      soundFx.playMatched();
      if (onMatched && currentRoomId) {
        onMatched(peer, currentRoomId, true);
      }
    });

    // Peer profile update
    newSocket.on('peer:profile_updated', (data: { alias: string; avatarSeed: string }) => {
      setPeerState((prev) => (prev ? { ...prev, alias: data.alias, avatarSeed: data.avatarSeed } : null));
    });

    // Peer media state update
    newSocket.on('peer:media_state', (data: { senderId: string; audio: boolean; video: boolean; screenShare: boolean }) => {
      setPeerState((prev) => (prev ? {
        ...prev,
        audioEnabled: data.audio,
        videoEnabled: data.video,
        screenShareEnabled: data.screenShare,
      } : null));
    });

    // Peer disconnected / skipped
    newSocket.on('peer:disconnected', (data: { reason?: string }) => {
      const reason = data.reason || 'Stranger left';
      setPeerState(null);
      soundFx.playDisconnected();
      if (onPeerDisconnected) {
        onPeerDisconnected(reason);
      }
    });

    // Chat message received
    newSocket.on('chat:message', (message: ChatMessage) => {
      if (message.senderId !== newSocket.id) {
        soundFx.playMessageReceived();
      }

      // If message is ephemeral, calculate client expiration
      if (message.ephemeralSeconds && message.ephemeralSeconds > 0) {
        message.expiresAt = Date.now() + message.ephemeralSeconds * 1000;
      }

      setMessages((prev) => [...prev, message]);
    });

    // Typing status
    newSocket.on('chat:typing', (data: { isTyping: boolean }) => {
      setIsPeerTyping(data.isTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (data.isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          setIsPeerTyping(false);
        }, 3000);
      }
    });

    // Reactions
    newSocket.on('chat:reaction', (data: ReactionPayload) => {
      if (data.sound) {
        soundFx.playSoundboard(data.sound);
      }
      if (data.emoji) {
        if (data.emoji === '🎉') {
          try {
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
          } catch (e) {}
        }
        const reactionId = `react_${Date.now()}_${Math.random()}`;
        setFloatingReactions((prev) => [...prev, { id: reactionId, emoji: data.emoji, alias: data.alias }]);
        setTimeout(() => {
          setFloatingReactions((prev) => prev.filter((r) => r.id !== reactionId));
        }, 3000);
      }
    });

    // Whiteboard real-time stroke
    newSocket.on('draw:stroke', (data: { stroke: DrawStroke }) => {
      setWhiteboardStrokes((prev) => [...prev, data.stroke]);
    });

    newSocket.on('draw:clear', () => {
      setWhiteboardStrokes([]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ephemeral message cleanup timer loop
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => prev.filter((m) => !m.expiresAt || m.expiresAt > now));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Update profile
  const updateProfile = useCallback((alias: string, avatarSeed: string) => {
    if (socketRef.current) {
      socketRef.current.emit('user:update_profile', { alias, avatarSeed });
    }
  }, []);

  // Stranger Matchmaking Actions
  const startStrangerSearch = useCallback((interests: string[]) => {
    if (socketRef.current) {
      setIsSearching(true);
      socketRef.current.emit('match:start', { interests });
    }
  }, []);

  const cancelStrangerSearch = useCallback(() => {
    if (socketRef.current) {
      setIsSearching(false);
      socketRef.current.emit('match:cancel');
    }
  }, []);

  const skipStranger = useCallback(() => {
    if (socketRef.current) {
      setPeerState(null);
      setMessages([]);
      setWhiteboardStrokes([]);
      setIsSearching(true);
      socketRef.current.emit('match:skip');
    }
  }, []);

  // Room code actions
  const joinCustomRoom = useCallback((roomCode: string) => {
    if (socketRef.current) {
      setMessages([]);
      setWhiteboardStrokes([]);
      socketRef.current.emit('room:join', { roomCode });
    }
  }, []);

  // Chat message sending
  const sendMessage = useCallback((text?: string, mediaUrl?: string, mediaType?: 'image' | 'audio' | 'voice_note', ephemeralSeconds = 0, spoiler = false) => {
    if (socketRef.current && (text?.trim() || mediaUrl)) {
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      socketRef.current.emit('chat:message', {
        id: msgId,
        text: text?.trim(),
        mediaUrl,
        mediaType,
        ephemeralSeconds,
        spoiler,
      });
      soundFx.playMessageSent();
    }
  }, []);

  // Send typing status
  const sendTyping = useCallback((isTyping: boolean) => {
    if (socketRef.current) {
      socketRef.current.emit('chat:typing', { isTyping });
    }
  }, []);

  // Send reaction
  const sendReaction = useCallback((emoji?: string, sound?: string) => {
    if (socketRef.current) {
      socketRef.current.emit('chat:reaction', { emoji, sound });
    }
  }, []);

  // Whiteboard drawing actions
  const emitStroke = useCallback((stroke: DrawStroke) => {
    if (socketRef.current) {
      setWhiteboardStrokes((prev) => [...prev, stroke]);
      socketRef.current.emit('draw:stroke', { stroke });
    }
  }, []);

  const emitClearWhiteboard = useCallback(() => {
    if (socketRef.current) {
      setWhiteboardStrokes([]);
      socketRef.current.emit('draw:clear');
    }
  }, []);

  // End Call / Leave
  const leaveSession = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('call:end');
    }
    setCurrentRoomId(null);
    setCurrentRoomCode(null);
    setPeerState(null);
    setIsSearching(false);
    setMessages([]);
    setWhiteboardStrokes([]);
  }, []);

  return {
    socket,
    isConnected,
    onlineStats,
    isSearching,
    currentRoomId,
    currentRoomCode,
    isInitiator,
    peerState,
    messages,
    isPeerTyping,
    floatingReactions,
    whiteboardStrokes,
    updateProfile,
    startStrangerSearch,
    cancelStrangerSearch,
    skipStranger,
    joinCustomRoom,
    sendMessage,
    sendTyping,
    sendReaction,
    emitStroke,
    emitClearWhiteboard,
    leaveSession,
  };
}
