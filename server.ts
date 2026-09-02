import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = 3000;

// 30 Days in Milliseconds (1 Month Auto-Deletion Retention)
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// Ensure persistent storage directories exist
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const CHAT_FILE = path.join(DATA_DIR, 'chat_history.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded media & files statically with proper caching and disposition headers
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Attachment & Message Interfaces
export type AttachmentType = 'image' | 'video' | 'audio' | 'document' | 'other';

export interface ChatAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: AttachmentType;
  mimeType: string;
  url: string;
  duration?: number;
  expiresAt: number;
}

export interface StoredMessage {
  id: string;
  roomId: string;
  roomCode: string;
  senderId: string;
  senderAlias: string;
  senderAvatarSeed: string;
  text: string;
  timestamp: number;
  expiresAt: number; // 30-day auto-expiry timestamp
  isEncrypted?: boolean;
  isDirectP2P?: boolean;
  attachments?: ChatAttachment[];
  reactions?: Record<string, string[]>;
}

// In-Memory & Persistent Chat Store
let chatHistory: StoredMessage[] = [];

function loadChatHistory() {
  try {
    if (fs.existsSync(CHAT_FILE)) {
      const raw = fs.readFileSync(CHAT_FILE, 'utf-8');
      chatHistory = JSON.parse(raw);
      console.log(`[Storage]: Loaded ${chatHistory.length} messages from disk`);
    }
  } catch (err) {
    console.error('[Storage Error]: Failed to load chat history:', err);
    chatHistory = [];
  }
}

function saveChatHistory() {
  try {
    fs.writeFileSync(CHAT_FILE, JSON.stringify(chatHistory, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Storage Error]: Failed to save chat history:', err);
  }
}

// Periodic 30-Day Auto-Purge of Expired Messages & Files
function purgeExpiredMessagesAndFiles() {
  const now = Date.now();
  const initialCount = chatHistory.length;
  const expiredMessages: StoredMessage[] = [];
  const validMessages: StoredMessage[] = [];

  for (const msg of chatHistory) {
    if (msg.expiresAt && now > msg.expiresAt) {
      expiredMessages.push(msg);
    } else {
      validMessages.push(msg);
    }
  }

  // Delete attached files from disk for expired messages
  for (const msg of expiredMessages) {
    if (msg.attachments) {
      for (const att of msg.attachments) {
        try {
          const filename = path.basename(att.url);
          const fullPath = path.join(UPLOADS_DIR, filename);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`[Auto-Purge (30 Days)]: Deleted expired file ${filename}`);
          }
        } catch (e) {
          console.warn('[Auto-Purge Warning]: Failed to delete file:', e);
        }
      }
    }
  }

  if (expiredMessages.length > 0) {
    chatHistory = validMessages;
    saveChatHistory();
    console.log(`[Auto-Purge (30 Days)]: Purged ${expiredMessages.length} expired messages out of ${initialCount}.`);
  }
}

// Load history on boot and run purge every 30 minutes
loadChatHistory();
purgeExpiredMessagesAndFiles();
setInterval(purgeExpiredMessagesAndFiles, 30 * 60 * 1000);

// Multer Storage Configuration for File/Image/Video Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substring(2, 8);
    // Sanitize original file name
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB per file
  },
});

// Helper to determine media file type
function getAttachmentType(mime: string, originalName: string): AttachmentType {
  const ext = path.extname(originalName).toLowerCase();
  if (mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('video/') || ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'].includes(ext)) {
    return 'video';
  }
  if (mime.startsWith('audio/') || ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'].includes(ext)) {
    return 'audio';
  }
  if (
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('excel') ||
    mime.includes('presentation') ||
    mime.includes('text') ||
    mime.includes('json') ||
    ['.pdf', '.doc', '.docx', '.txt', '.zip', '.rar', '.tar', '.gz', '.xls', '.xlsx', '.csv', '.ppt', '.pptx', '.md', '.ts', '.tsx', '.js', '.py'].includes(ext)
  ) {
    return 'document';
  }
  return 'other';
}

// In-memory peer session state
interface UserSession {
  id: string;
  alias: string;
  avatarSeed: string;
  roomId?: string;
  connectedAt: number;
}

const users = new Map<string, UserSession>();
const rooms = new Map<string, Set<string>>();
const startTime = Date.now();

// -------------------------------------------------------------
// REST API ROUTES
// -------------------------------------------------------------

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    activeConnections: users.size,
    activeRooms: rooms.size,
    totalStoredMessages: chatHistory.length,
    retentionPolicy: '30 Days (1 Month Auto-Purge)',
    e2eeProtocol: 'AES-256-GCM + DTLS-SRTP v1.0',
    timestamp: new Date().toISOString(),
  });
});

// Chat Retention Info
app.get('/api/chat/retention-info', (req, res) => {
  res.json({
    retentionDays: 30,
    retentionMs: RETENTION_MS,
    autoPurgeActive: true,
    policyDescription: 'All messages, images, videos, audio notes, and files are automatically deleted after 30 days (1 month).',
    totalStoredMessages: chatHistory.length,
  });
});

// Room Chat History API
app.get('/api/chat/history/:roomCode', (req, res) => {
  const roomCode = (req.params.roomCode || '').trim().toUpperCase();
  purgeExpiredMessagesAndFiles();

  const roomMessages = chatHistory.filter((m) => m.roomCode === roomCode);
  res.json({
    roomCode,
    retentionDays: 30,
    count: roomMessages.length,
    messages: roomMessages,
  });
});

// REST endpoint to post a message into room chat (used by RoomChatModal & external clients)
app.post('/api/chat/message', (req, res) => {
  try {
    const { roomCode, text, senderId, senderAlias, senderAvatarSeed, attachments, isEncrypted } = req.body;
    if (!roomCode || (!text && (!attachments || attachments.length === 0))) {
      return res.status(400).json({ error: 'Missing roomCode or message content' });
    }

    const normalizedCode = (roomCode || '').trim().toUpperCase();
    const fullRoomId = `room_${normalizedCode}`;
    const now = Date.now();
    const expiresAt = now + RETENTION_MS;

    const messagePayload: StoredMessage = {
      id: `msg_${now}_${Math.random().toString(36).substring(2, 7)}`,
      roomId: fullRoomId,
      roomCode: normalizedCode,
      senderId: senderId || 'anonymous_rest',
      senderAlias: senderAlias || 'Anonymous User',
      senderAvatarSeed: senderAvatarSeed || 'seed',
      text: (text || '').trim(),
      timestamp: now,
      expiresAt,
      isEncrypted: !!isEncrypted,
      attachments: attachments || [],
      reactions: {},
    };

    chatHistory.push(messagePayload);
    saveChatHistory();

    // Broadcast in real-time to active room socket connections
    io.to(fullRoomId).emit('chat:message', messagePayload);

    res.json({
      success: true,
      message: messagePayload,
    });
  } catch (err: any) {
    console.error('Failed to store chat message:', err);
    res.status(500).json({ error: 'Internal server error storing message' });
  }
});

// REST endpoint to add emoji reaction
app.post('/api/chat/reaction', (req, res) => {
  try {
    const { messageId, emoji, userAlias } = req.body;
    if (!messageId || !emoji) {
      return res.status(400).json({ error: 'Missing messageId or emoji' });
    }

    const targetMsg = chatHistory.find((m) => m.id === messageId);
    if (!targetMsg) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (!targetMsg.reactions) targetMsg.reactions = {};
    const alias = userAlias || 'Anonymous';
    const list = targetMsg.reactions[emoji] || [];
    const userIndex = list.indexOf(alias);

    if (userIndex >= 0) {
      list.splice(userIndex, 1);
      if (list.length === 0) delete targetMsg.reactions[emoji];
    } else {
      list.push(alias);
      targetMsg.reactions[emoji] = list;
    }

    saveChatHistory();

    io.to(targetMsg.roomId).emit('chat:reaction_updated', {
      messageId,
      reactions: targetMsg.reactions,
    });

    res.json({ success: true, reactions: targetMsg.reactions });
  } catch (err: any) {
    console.error('Reaction API error:', err);
    res.status(500).json({ error: 'Failed to update reaction' });
  }
});

// File / Image / Video Upload API
app.post('/api/chat/upload', upload.array('files', 10), (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const now = Date.now();
    const expiresAt = now + RETENTION_MS; // 30-day expiry

    const attachments: ChatAttachment[] = files.map((file) => {
      const fileType = getAttachmentType(file.mimetype, file.originalname);
      return {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        fileName: file.originalname,
        fileSize: file.size,
        fileType,
        mimeType: file.mimetype,
        url: `/uploads/${file.filename}`,
        expiresAt,
      };
    });

    res.json({
      success: true,
      expiresAt,
      retentionDays: 30,
      attachments,
    });
  } catch (err: any) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Failed to process file upload' });
  }
});

// Generate fresh meeting room code
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

  // Check stored messages count for this room code
  const messageCount = chatHistory.filter((m) => m.roomCode === roomCode).length;

  res.json({
    roomCode,
    exists: count > 0 || messageCount > 0,
    participantCount: count,
    messageCount,
    isAvailable: count < 50,
  });
});

// -------------------------------------------------------------
// SOCKET.IO REAL-TIME SIGNALING & ENCRYPTED RELAY & CHAT
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

    // Send active room chat history (with 30-day auto-expiry)
    purgeExpiredMessagesAndFiles();
    const roomMessages = chatHistory.filter((m) => m.roomCode === normalizedCode);

    // Notify joining client
    socket.emit('room:joined', {
      roomCode: normalizedCode,
      roomId: fullRoomId,
      isInitiator: !isFirstUser,
      peers: peersInRoom,
      history: roomMessages,
      retentionDays: 30,
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

  // Media state changes
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

  // Chat Typing indicator
  socket.on('chat:typing', (data: { isTyping: boolean }) => {
    const session = users.get(socket.id);
    if (session?.roomId) {
      socket.to(session.roomId).emit('chat:typing', {
        senderId: socket.id,
        senderAlias: session.alias,
        isTyping: data.isTyping,
      });
    }
  });

  // Chat Message with optional Attachments (Files, Images, Videos, Audio) & 30-Day Expiry
  socket.on('chat:message', (data: {
    id?: string;
    text?: string;
    attachments?: ChatAttachment[];
    isEncrypted?: boolean;
  }) => {
    const session = users.get(socket.id);
    if (!session?.roomId) return;

    const normalizedRoomCode = session.roomId.replace(/^room_/, '');
    const now = Date.now();
    const expiresAt = now + RETENTION_MS; // 30 Days TTL

    const messagePayload: StoredMessage = {
      id: data.id || `msg_${now}_${Math.random().toString(36).substring(2, 7)}`,
      roomId: session.roomId,
      roomCode: normalizedRoomCode,
      senderId: socket.id,
      senderAlias: session.alias,
      senderAvatarSeed: session.avatarSeed,
      text: (data.text || '').trim(),
      timestamp: now,
      expiresAt,
      isEncrypted: !!data.isEncrypted,
      attachments: data.attachments || [],
      reactions: {},
    };

    // Save to persistent storage with 30-day TTL
    chatHistory.push(messagePayload);
    saveChatHistory();

    // Broadcast in real-time to everyone in the room
    io.to(session.roomId).emit('chat:message', messagePayload);
  });

  // E2EE Encrypted Chat Message Relay & Store
  socket.on('chat:encrypted_message', (data: {
    id?: string;
    encryptedPayload: { iv: string; ciphertext: string };
    attachments?: ChatAttachment[];
  }) => {
    const session = users.get(socket.id);
    if (!session?.roomId || !data.encryptedPayload) return;

    const normalizedRoomCode = session.roomId.replace(/^room_/, '');
    const now = Date.now();
    const expiresAt = now + RETENTION_MS;

    const messageEnvelope = {
      id: data.id || `msg_${now}_${Math.random().toString(36).substring(2, 7)}`,
      roomId: session.roomId,
      roomCode: normalizedRoomCode,
      senderId: socket.id,
      senderAlias: session.alias,
      senderAvatarSeed: session.avatarSeed,
      encryptedPayload: data.encryptedPayload,
      attachments: data.attachments || [],
      timestamp: now,
      expiresAt,
      isEncrypted: true,
      reactions: {},
    };

    // Store encrypted ciphertext for 30-day room history
    chatHistory.push({
      id: messageEnvelope.id,
      roomId: session.roomId,
      roomCode: normalizedRoomCode,
      senderId: socket.id,
      senderAlias: session.alias,
      senderAvatarSeed: session.avatarSeed,
      text: JSON.stringify(data.encryptedPayload),
      timestamp: now,
      expiresAt,
      isEncrypted: true,
      attachments: data.attachments || [],
      reactions: {},
    });
    saveChatHistory();

    io.to(session.roomId).emit('chat:encrypted_message', messageEnvelope);
  });

  // Emoji Reaction on Message
  socket.on('chat:reaction', (data: { messageId: string; emoji: string }) => {
    const session = users.get(socket.id);
    if (!session?.roomId || !data.messageId || !data.emoji) return;

    const targetMsg = chatHistory.find((m) => m.id === data.messageId);
    if (targetMsg) {
      if (!targetMsg.reactions) targetMsg.reactions = {};
      const list = targetMsg.reactions[data.emoji] || [];
      const userIndex = list.indexOf(session.alias);
      if (userIndex >= 0) {
        list.splice(userIndex, 1);
        if (list.length === 0) delete targetMsg.reactions[data.emoji];
      } else {
        list.push(session.alias);
        targetMsg.reactions[data.emoji] = list;
      }
      saveChatHistory();

      io.to(session.roomId).emit('chat:reaction_updated', {
        messageId: data.messageId,
        reactions: targetMsg.reactions,
      });
    }
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
    console.log(`[Chat Retention]: 30-Day auto-purge enabled.`);
  });
}

start();
