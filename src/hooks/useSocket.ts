import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { AnonymousUser, ChatMessage, PeerState } from '../types';

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

  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef<string | null>(null);

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
          isHandRaised: false,
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

    // In-Call Chat message
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

  // Send In-Call Message
  const sendMessage = useCallback((text: string) => {
    if (socketRef.current && text.trim()) {
      socketRef.current.emit('chat:message', { text: text.trim() });
    }
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
  }, []);

  return {
    socket,
    isConnected,
    currentRoomId,
    currentRoomCode,
    isInitiator,
    peerState,
    messages,
    joinCustomRoom,
    sendMessage,
    toggleHandRaise,
    leaveSession,
  };
}
