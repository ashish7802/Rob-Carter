export interface AnonymousUser {
  id: string;
  alias: string;
  avatarSeed: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderAlias: string;
  senderAvatarSeed: string;
  text: string;
  timestamp: number;
  isEncrypted?: boolean;
  isDirectP2P?: boolean;
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
