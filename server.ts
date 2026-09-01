import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Socket.io with CORS & transport fallbacks
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e7, // 10MB for ephemeral voice notes/images
});

// In-memory real-time state
interface UserSession {
  id: string;
  alias: string;
  avatarSeed: string;
  roomId?: string;
  interests?: string[];
  mode?: 'stranger' | 'custom_room' | 'ai';
  status: 'idle' | 'searching' | 'matched' | 'in_call';
  connectedAt: number;
}

// Map socket.id -> UserSession
const users = new Map<string, UserSession>();

// Queue for random stranger matching: interest tag -> socket.id[]
const matchQueue: { socketId: string; interests: string[]; timestamp: number }[] = [];

// Rooms state: roomId -> Set of socket IDs
const rooms = new Map<string, Set<string>>();

// Helper to remove user from matchmaking queue
function removeFromQueue(socketId: string) {
  const idx = matchQueue.findIndex((item) => item.socketId === socketId);
  if (idx !== -1) {
    matchQueue.splice(idx, 1);
  }
}

// Try to match users from the queue
function attemptMatch() {
  if (matchQueue.length < 2) return;

  // Strategy: Try to find users with overlapping interests first
  let pairFound = false;

  for (let i = 0; i < matchQueue.length && !pairFound; i++) {
    const userA = matchQueue[i];
    for (let j = i + 1; j < matchQueue.length; j++) {
      const userB = matchQueue[j];

      // Check if both users are still connected and searching
      const sessionA = users.get(userA.socketId);
      const sessionB = users.get(userB.socketId);

      if (!sessionA || !sessionB) continue;

      // Check interest overlap or if either has 'Random' or empty
      const sharedInterests = userA.interests.filter(
        (int) => userB.interests.includes(int) && int.toLowerCase() !== 'random'
      );
      const isMatch =
        sharedInterests.length > 0 ||
        userA.interests.includes('Random') ||
        userB.interests.includes('Random') ||
        userA.interests.length === 0 ||
        userB.interests.length === 0;

      if (isMatch) {
        // Form a unique match room
        const roomId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        // Remove both from queue
        matchQueue.splice(j, 1);
        matchQueue.splice(i, 1);

        // Update sessions
        sessionA.roomId = roomId;
        sessionA.status = 'matched';
        sessionB.roomId = roomId;
        sessionB.status = 'matched';

        // Join room
        const socketA = io.sockets.sockets.get(userA.socketId);
        const socketB = io.sockets.sockets.get(userB.socketId);

        if (socketA && socketB) {
          socketA.join(roomId);
          socketB.join(roomId);

          rooms.set(roomId, new Set([userA.socketId, userB.socketId]));

          // Notify Peer A (Initiator)
          socketA.emit('matched', {
            roomId,
            isInitiator: true,
            peer: {
              id: sessionB.id,
              alias: sessionB.alias,
              avatarSeed: sessionB.avatarSeed,
              sharedInterests,
            },
          });

          // Notify Peer B (Receiver)
          socketB.emit('matched', {
            roomId,
            isInitiator: false,
            peer: {
              id: sessionA.id,
              alias: sessionA.alias,
              avatarSeed: sessionA.avatarSeed,
              sharedInterests,
            },
          });
        }

        pairFound = true;
        break;
      }
    }
  }

  // Fallback: If queue has >=2 users waiting for >3 seconds, match the first 2 regardless
  if (!pairFound && matchQueue.length >= 2) {
    const oldest = matchQueue[0];
    if (Date.now() - oldest.timestamp > 2500) {
      const itemA = matchQueue.shift()!;
      const itemB = matchQueue.shift()!;
      const sessionA = users.get(itemA.socketId);
      const sessionB = users.get(itemB.socketId);

      if (sessionA && sessionB) {
        const roomId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        sessionA.roomId = roomId;
        sessionA.status = 'matched';
        sessionB.roomId = roomId;
        sessionB.status = 'matched';

        const socketA = io.sockets.sockets.get(itemA.socketId);
        const socketB = io.sockets.sockets.get(itemB.socketId);

        if (socketA && socketB) {
          socketA.join(roomId);
          socketB.join(roomId);
          rooms.set(roomId, new Set([itemA.socketId, itemB.socketId]));

          socketA.emit('matched', {
            roomId,
            isInitiator: true,
            peer: {
              id: sessionB.id,
              alias: sessionB.alias,
              avatarSeed: sessionB.avatarSeed,
              sharedInterests: [],
            },
          });

          socketB.emit('matched', {
            roomId,
            isInitiator: false,
            peer: {
              id: sessionA.id,
              alias: sessionA.alias,
              avatarSeed: sessionA.avatarSeed,
              sharedInterests: [],
            },
          });
        }
      }
    }
  }
}

// Socket.io handlers
io.on('connection', (socket: Socket) => {
  console.log(`[Socket Connected]: ${socket.id}`);

  // Register anonymous user session
  socket.on('user:register', (data: { alias: string; avatarSeed: string }) => {
    const session: UserSession = {
      id: socket.id,
      alias: data.alias || `Anon#${Math.floor(1000 + Math.random() * 9000)}`,
      avatarSeed: data.avatarSeed || Math.random().toString(36).substring(2, 8),
      status: 'idle',
      connectedAt: Date.now(),
    };
    users.set(socket.id, session);
    socket.emit('user:registered', session);
    io.emit('stats:update', { onlineUsers: users.size, inQueue: matchQueue.length });
  });

  // Update alias or avatar seed
  socket.on('user:update_profile', (data: { alias?: string; avatarSeed?: string }) => {
    const session = users.get(socket.id);
    if (session) {
      if (data.alias) session.alias = data.alias;
      if (data.avatarSeed) session.avatarSeed = data.avatarSeed;
      if (session.roomId) {
        socket.to(session.roomId).emit('peer:profile_updated', {
          alias: session.alias,
          avatarSeed: session.avatarSeed,
        });
      }
    }
  });

  // Start stranger search
  socket.on('match:start', (data: { interests?: string[] }) => {
    const session = users.get(socket.id);
    if (!session) return;

    // Leave any existing room
    if (session.roomId) {
      socket.leave(session.roomId);
      const roomUsers = rooms.get(session.roomId);
      if (roomUsers) {
        roomUsers.delete(socket.id);
        socket.to(session.roomId).emit('peer:disconnected', { reason: 'Stranger skipped or disconnected' });
        if (roomUsers.size === 0) rooms.delete(session.roomId);
      }
      session.roomId = undefined;
    }

    removeFromQueue(socket.id);

    session.status = 'searching';
    session.interests = data.interests || ['Random'];
    session.mode = 'stranger';

    matchQueue.push({
      socketId: socket.id,
      interests: session.interests,
      timestamp: Date.now(),
    });

    socket.emit('match:searching', { queuePosition: matchQueue.length });
    io.emit('stats:update', { onlineUsers: users.size, inQueue: matchQueue.length });

    attemptMatch();
  });

  // Stop stranger search
  socket.on('match:cancel', () => {
    removeFromQueue(socket.id);
    const session = users.get(socket.id);
    if (session) session.status = 'idle';
    socket.emit('match:cancelled');
    io.emit('stats:update', { onlineUsers: users.size, inQueue: matchQueue.length });
  });

  // Skip / Next stranger
  socket.on('match:skip', () => {
    const session = users.get(socket.id);
    if (!session) return;

    if (session.roomId) {
      socket.to(session.roomId).emit('peer:disconnected', { reason: 'Stranger clicked Next' });
      socket.leave(session.roomId);
      const roomUsers = rooms.get(session.roomId);
      if (roomUsers) {
        roomUsers.delete(socket.id);
        if (roomUsers.size === 0) rooms.delete(session.roomId);
      }
      session.roomId = undefined;
    }

    removeFromQueue(socket.id);
    session.status = 'searching';

    matchQueue.push({
      socketId: socket.id,
      interests: session.interests || ['Random'],
      timestamp: Date.now(),
    });

    socket.emit('match:searching', { queuePosition: matchQueue.length });
    attemptMatch();
  });

  // Join or Create a Custom Room by Code
  socket.on('room:join', (data: { roomCode: string; passcode?: string }) => {
    const session = users.get(socket.id);
    if (!session) return;

    const normalizedCode = data.roomCode.trim().toUpperCase();
    if (!normalizedCode) {
      socket.emit('room:error', { message: 'Invalid room code' });
      return;
    }

    // Leave any previous room
    if (session.roomId) {
      socket.leave(session.roomId);
      const prevRoom = rooms.get(session.roomId);
      if (prevRoom) {
        prevRoom.delete(socket.id);
        socket.to(session.roomId).emit('peer:disconnected', { reason: 'Peer switched rooms' });
        if (prevRoom.size === 0) rooms.delete(session.roomId);
      }
    }
    removeFromQueue(socket.id);

    const fullRoomId = `code_${normalizedCode}`;
    socket.join(fullRoomId);
    session.roomId = fullRoomId;
    session.status = 'in_call';
    session.mode = 'custom_room';

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

    socket.emit('room:joined', {
      roomCode: normalizedCode,
      roomId: fullRoomId,
      isInitiator: !isFirstUser,
      peers: peersInRoom,
    });

    // Notify other peers in this room
    socket.to(fullRoomId).emit('room:peer_joined', {
      peer: {
        id: socket.id,
        alias: session.alias,
        avatarSeed: session.avatarSeed,
      },
    });
  });

  // WebRTC Signaling: Offer
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

  // WebRTC Signaling: Answer
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

  // Real-time Chat message
  socket.on('chat:message', (data: {
    id: string;
    text?: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'audio' | 'voice_note';
    ephemeralSeconds?: number;
    spoiler?: boolean;
    timestamp?: number;
  }) => {
    const session = users.get(socket.id);
    if (!session?.roomId) return;

    const messagePayload = {
      id: data.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      senderId: socket.id,
      senderAlias: session.alias,
      senderAvatarSeed: session.avatarSeed,
      text: data.text,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      ephemeralSeconds: data.ephemeralSeconds || 0,
      spoiler: !!data.spoiler,
      timestamp: data.timestamp || Date.now(),
    };

    // Broadcast to room (including sender confirmation)
    io.to(session.roomId).emit('chat:message', messagePayload);
  });

  // Typing status indicator
  socket.on('chat:typing', (data: { isTyping: boolean }) => {
    const session = users.get(socket.id);
    if (session?.roomId) {
      socket.to(session.roomId).emit('chat:typing', {
        senderId: socket.id,
        alias: session.alias,
        isTyping: data.isTyping,
      });
    }
  });

  // Reactions / Soundboard triggers
  socket.on('chat:reaction', (data: { emoji?: string; sound?: string }) => {
    const session = users.get(socket.id);
    if (session?.roomId) {
      io.to(session.roomId).emit('chat:reaction', {
        senderId: socket.id,
        alias: session.alias,
        emoji: data.emoji,
        sound: data.sound,
        timestamp: Date.now(),
      });
    }
  });

  // Collaborative Whiteboard events
  socket.on('draw:stroke', (data: { stroke: any }) => {
    const session = users.get(socket.id);
    if (session?.roomId) {
      socket.to(session.roomId).emit('draw:stroke', data);
    }
  });

  socket.on('draw:clear', () => {
    const session = users.get(socket.id);
    if (session?.roomId) {
      socket.to(session.roomId).emit('draw:clear');
    }
  });

  // Call End / Disconnect from peer
  socket.on('call:end', () => {
    const session = users.get(socket.id);
    if (session && session.roomId) {
      socket.to(session.roomId).emit('peer:disconnected', { reason: 'Peer ended the session' });
      socket.leave(session.roomId);
      const roomUsers = rooms.get(session.roomId);
      if (roomUsers) {
        roomUsers.delete(socket.id);
        if (roomUsers.size === 0) rooms.delete(session.roomId);
      }
      session.roomId = undefined;
      session.status = 'idle';
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected]: ${socket.id}`);
    removeFromQueue(socket.id);

    const session = users.get(socket.id);
    if (session && session.roomId) {
      socket.to(session.roomId).emit('peer:disconnected', { reason: 'User closed connection or disconnected' });
      const roomUsers = rooms.get(session.roomId);
      if (roomUsers) {
        roomUsers.delete(socket.id);
        if (roomUsers.size === 0) rooms.delete(session.roomId);
      }
    }

    users.delete(socket.id);
    io.emit('stats:update', { onlineUsers: users.size, inQueue: matchQueue.length });
  });
});

// Periodic match check
setInterval(() => {
  attemptMatch();
}, 1500);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    onlineUsers: users.size,
    inQueue: matchQueue.length,
    activeRooms: rooms.size,
    timestamp: new Date().toISOString(),
  });
});

// Gemini AI Incognito Assistant / Icebreaker generator
app.post('/api/ai/icebreaker', async (req, res) => {
  try {
    const { topic } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Return high quality curated icebreakers if API key is not configured yet
      const fallbackStarters = [
        "What is the most mysterious coincidence that has ever happened to you?",
        "If you could safely delete one invention from human history, what would it be?",
        "What is a personal philosophy or secret rule you quietly live by?",
        "If you were granted complete anonymity for 24 hours anywhere on Earth, what would you do?",
        "What is a guilty pleasure song or hobby you rarely tell anyone about?",
        "What is something universally praised that you secretly find completely overrated?"
      ];
      const random = fallbackStarters[Math.floor(Math.random() * fallbackStarters.length)];
      return res.json({ prompt: random, isAiGenerated: false });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Generate a single, intriguing, fun, thought-provoking conversation starter or debate question for two anonymous strangers chatting on an anonymous platform. Topic preference: ${topic || 'Random deep/fun'}. Return ONLY the question string directly without quotation marks or conversational fluff.`,
    });

    const question = response.text ? response.text.trim().replace(/^["']|["']$/g, '') : "What is a controversial opinion you secretly hold?";
    res.json({ prompt: question, isAiGenerated: true });
  } catch (error: any) {
    console.error('Icebreaker AI Error:', error);
    res.json({
      prompt: "If you could witness any event in past or future history without being seen, what would you choose?",
      isAiGenerated: false,
    });
  }
});

// Gemini AI Chatbot response for Solo/Incognito Companion mode
app.post('/api/ai/companion-chat', async (req, res) => {
  try {
    const { messages, userAlias } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json({
        reply: "Greetings from the Incognito AI companion! (Configure GEMINI_API_KEY in secrets to unleash full deep reasoning). Tell me what's on your mind!",
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `You are "Phantom", a witty, charismatic, intriguing, and respectful anonymous conversational companion on a privacy-first anonymous chat & video platform. You converse naturally with ${userAlias || 'Stranger'}. Keep your replies engaging, punchy (1-3 sentences max unless answering deep questions), open-minded, and thought-provoking.`;

    const contents = (messages || []).map((m: { sender: string; text: string }) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello!' }] }],
      config: {
        systemInstruction,
        temperature: 0.85,
      },
    });

    res.json({
      reply: response.text ? response.text.trim() : "I'm listening through the static...",
    });
  } catch (error: any) {
    console.error('AI Companion Error:', error);
    res.json({
      reply: "The encrypted channel crackled for a second. What were you saying?",
    });
  }
});

// Vite Middleware for development vs production
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
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
    console.log(`⚡ Incognito Anonymous Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite();
