import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = 3000;

app.use(express.json());

// In-memory peer session state
interface UserSession {
  id: string;
  alias: string;
  avatarSeed: string;
  roomId?: string;
  connectedAt: number;
}

const users = new Map<string, UserSession>();
// Map roomId -> Set of socket IDs
const rooms = new Map<string, Set<string>>();

const startTime = Date.now();

// -------------------------------------------------------------
// REST API ROUTES (Full Stack Backend Services)
// -------------------------------------------------------------

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    activeConnections: users.size,
    activeRooms: rooms.size,
    e2eeProtocol: 'AES-256-GCM + DTLS-SRTP v1.0',
    timestamp: new Date().toISOString(),
  });
});

// Real-time stats
app.get('/api/stats', (req, res) => {
  res.json({
    totalActiveUsers: users.size,
    totalActiveRooms: rooms.size,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    e2eeSupported: true,
  });
});

// Generate fresh meeting room code (Google Meet style: 3-4-3 chars)
app.post('/api/rooms/generate', (req, res) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const pick = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const roomCode = `${pick(3)}-${pick(4)}-${pick(3)}`;
  res.json({
    roomCode,
    joinUrl: `/meet/${roomCode}`,
    createdAt: Date.now(),
  });
});

// Verify if a room exists or get occupancy
app.get('/api/rooms/verify/:code', (req, res) => {
  const roomCode = (req.params.code || '').trim().toUpperCase();
  const fullRoomId = `room_${roomCode}`;
  const roomUsers = rooms.get(fullRoomId);
  const count = roomUsers ? roomUsers.size : 0;

  res.json({
    roomCode,
    exists: count > 0,
    participantCount: count,
    isAvailable: count < 50, // Capacity check
  });
});

// -------------------------------------------------------------
// SOCKET.IO REAL-TIME SIGNALING & ENCRYPTED RELAY
// -------------------------------------------------------------

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 20000,
  pingInterval: 10000,
});

io.on('connection', (socket: Socket) => {
  console.log(`[Peer Connected]: ${socket.id}`);

  // Register peer session
  socket.on('user:register', (data: { alias: string; avatarSeed: string }) => {
    users.set(socket.id, {
      id: socket.id,
      alias: data.alias || 'Anonymous User',
      avatarSeed: data.avatarSeed || 'seed',
      connectedAt: Date.now(),
    });
    socket.emit('user:registered', { id: socket.id });
  });

  // Join or Create Room
  socket.on('room:join', (data: { roomCode: string }) => {
    let session = users.get(socket.id);
    if (!session) {
      session = {
        id: socket.id,
        alias: 'Anonymous User',
        avatarSeed: 'seed',
        connectedAt: Date.now(),
      };
      users.set(socket.id, session);
    }

    const normalizedCode = (data.roomCode || 'MEET-ROOM').trim().toUpperCase();
    const fullRoomId = `room_${normalizedCode}`;

    // Leave any previous room cleanly
    if (session.roomId && session.roomId !== fullRoomId) {
      socket.leave(session.roomId);
      const prevUsers = rooms.get(session.roomId);
      if (prevUsers) {
        prevUsers.delete(socket.id);
        if (prevUsers.size === 0) rooms.delete(session.roomId);
        else socket.to(session.roomId).emit('peer:disconnected', { peerId: socket.id });
      }
    }

    socket.join(fullRoomId);
    session.roomId = fullRoomId;

    if (!rooms.has(fullRoomId)) {
      rooms.set(fullRoomId, new Set());
    }
    const currentRoomUsers = rooms.get(fullRoomId)!;
    const isFirstUser = currentRoomUsers.size === 0;
    currentRoomUsers.add(socket.id);

    // Collect peer info
    const peersInRoom = Array.from(currentRoomUsers)
      .filter((id) => id !== socket.id)
      .map((id) => {
        const s = users.get(id);
        return {
          id,
          alias: s?.alias || 'Anonymous Peer',
          avatarSeed: s?.avatarSeed || 'seed',
        };
      });

    // Notify joining client
    socket.emit('room:joined', {
      roomCode: normalizedCode,
      roomId: fullRoomId,
      isInitiator: !isFirstUser, // Joiner initiates WebRTC offer to existing peer
      peers: peersInRoom,
    });

    // Notify other peers in this room
    socket.to(fullRoomId).emit('room:peer_joined', {
      peer: {
        id: socket.id,
        alias: session.alias,
        avatarSeed: session.avatarSeed,
      },
      roomId: fullRoomId,
    });
  });

  // WebRTC Signaling: SDP Offer
  socket.on('signal:offer', (data: { sdp: any; targetId?: string; roomId?: string }) => {
    const session = users.get(socket.id);
    const targetRoom = data.roomId || session?.roomId;
    if (!targetRoom) return;

    if (data.targetId) {
      io.to(data.targetId).emit('signal:offer', {
        sdp: data.sdp,
        senderId: socket.id,
      });
    } else {
      socket.to(targetRoom).emit('signal:offer', {
        sdp: data.sdp,
        senderId: socket.id,
      });
    }
  });

  // WebRTC Signaling: SDP Answer
  socket.on('signal:answer', (data: { sdp: any; targetId?: string; roomId?: string }) => {
    const session = users.get(socket.id);
    const targetRoom = data.roomId || session?.roomId;
    if (!targetRoom) return;

    if (data.targetId) {
      io.to(data.targetId).emit('signal:answer', {
        sdp: data.sdp,
        senderId: socket.id,
      });
    } else {
      socket.to(targetRoom).emit('signal:answer', {
        sdp: data.sdp,
        senderId: socket.id,
      });
    }
  });

  // WebRTC Signaling: ICE Candidate
  socket.on('signal:ice_candidate', (data: { candidate: any; targetId?: string; roomId?: string }) => {
    const session = users.get(socket.id);
    const targetRoom = data.roomId || session?.roomId;
    if (!targetRoom) return;

    if (data.targetId) {
      io.to(data.targetId).emit('signal:ice_candidate', {
        candidate: data.candidate,
        senderId: socket.id,
      });
    } else {
      socket.to(targetRoom).emit('signal:ice_candidate', {
        candidate: data.candidate,
        senderId: socket.id,
      });
    }
  });

  // Media state changes (Audio muted, Video paused, Screen share active)
  socket.on('media:state_change', (data: { audio: boolean; video: boolean; screenShare: boolean }) => {
    const session = users.get(socket.id);
    if (session?.roomId) {
      socket.to(session.roomId).emit('peer:media_state', {
        senderId: socket.id,
        ...data,
      });
    }
  });

  // Hand raise toggle
  socket.on('meeting:hand_raise', (data: { isHandRaised: boolean }) => {
    const session = users.get(socket.id);
    if (session?.roomId) {
      socket.to(session.roomId).emit('meeting:hand_raise', {
        senderId: socket.id,
        alias: session.alias,
        isHandRaised: data.isHandRaised,
      });
    }
  });

  // E2EE Encrypted Chat Message Relay
  socket.on('chat:encrypted_message', (data: {
    id?: string;
    encryptedPayload: { iv: string; ciphertext: string };
  }) => {
    const session = users.get(socket.id);
    if (!session?.roomId || !data.encryptedPayload) return;

    const messageEnvelope = {
      id: data.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: socket.id,
      senderAlias: session.alias,
      senderAvatarSeed: session.avatarSeed,
      encryptedPayload: data.encryptedPayload,
      timestamp: Date.now(),
      isEncrypted: true,
    };

    io.to(session.roomId).emit('chat:encrypted_message', messageEnvelope);
  });

  // Fallback plain chat message
  socket.on('chat:message', (data: { id?: string; text: string }) => {
    const session = users.get(socket.id);
    if (!session?.roomId || !data.text?.trim()) return;

    const messagePayload = {
      id: data.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: socket.id,
      senderAlias: session.alias,
      senderAvatarSeed: session.avatarSeed,
      text: data.text.trim(),
      timestamp: Date.now(),
    };

    io.to(session.roomId).emit('chat:message', messagePayload);
  });

  // Call End / Leave Room
  socket.on('call:end', () => {
    const session = users.get(socket.id);
    if (session && session.roomId) {
      socket.to(session.roomId).emit('peer:disconnected', { peerId: socket.id });
      socket.leave(session.roomId);
      const roomUsers = rooms.get(session.roomId);
      if (roomUsers) {
        roomUsers.delete(socket.id);
        if (roomUsers.size === 0) rooms.delete(session.roomId);
      }
      session.roomId = undefined;
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    const session = users.get(socket.id);
    if (session && session.roomId) {
      socket.to(session.roomId).emit('peer:disconnected', { peerId: socket.id });
      const roomUsers = rooms.get(session.roomId);
      if (roomUsers) {
        roomUsers.delete(socket.id);
        if (roomUsers.size === 0) rooms.delete(session.roomId);
      }
    }
    users.delete(socket.id);
  });
});

// Vite / Static file serving
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`AnonMeet Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
