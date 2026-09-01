export interface AnonymousUser {
  id: string;
  alias: string;
  avatarSeed: string;
  color: string;
}

export type AttachmentType = 'image' | 'video' | 'audio' | 'document' | 'other';

export interface ChatAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: AttachmentType;
  mimeType: string;
  url: string;
  duration?: number;
  expiresAt: number; // 30-day auto-expiry timestamp
}

export interface ChatMessage {
  id: string;
  roomId?: string;
  senderId: string;
  senderAlias: string;
  senderAvatarSeed: string;
  text: string;
  timestamp: number;
  expiresAt: number; // 30 days from creation
  isEncrypted?: boolean;
  isDirectP2P?: boolean;
  attachments?: ChatAttachment[];
  reactions?: Record<string, string[]>; // emoji -> array of user aliases
}

export interface PeerState {
  id: string;
  alias: string;
  avatarSeed: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShareEnabled: boolean;
  isHandRaised?: boolean;
  isE2EEVerified?: boolean;
}

export interface MediaDeviceInfoList {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
}

export interface E2EESecurityDetails {
  roomCode: string;
  sixDigitCode: string;
  fingerprint: string;
  sasEmojis: string[];
  cipherSuite: string;
  isP2PDataChannelActive: boolean;
  dtlsSrtpActive: boolean;
}

