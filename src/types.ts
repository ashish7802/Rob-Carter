export type MatchMode = 'stranger' | 'custom_room' | 'ai';

export interface AnonymousUser {
  id: string;
  alias: string;
  avatarSeed: string;
  color: string;
  interests?: string[];
  status?: 'idle' | 'searching' | 'matched' | 'in_call';
}

export type VoiceFilterType = 'none' | 'deep' | 'helium' | 'robot' | 'whisper' | 'radio';

export type VideoFilterType = 'none' | 'privacy_blur' | 'cyber_hologram' | 'night_vision' | 'pixelate' | 'matrix' | 'noir';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderAlias: string;
  senderAvatarSeed: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'audio' | 'voice_note';
  ephemeralSeconds?: number;
  expiresAt?: number;
  spoiler?: boolean;
  timestamp: number;
}

export interface PeerState {
  id: string;
  alias: string;
  avatarSeed: string;
  sharedInterests?: string[];
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShareEnabled: boolean;
}

export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawStroke {
  id: string;
  points: DrawPoint[];
  color: string;
  width: number;
  isEraser?: boolean;
}

export interface ReactionPayload {
  senderId: string;
  alias: string;
  emoji?: string;
  sound?: string;
  timestamp: number;
}
