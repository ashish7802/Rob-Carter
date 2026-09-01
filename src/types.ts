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
}

export interface PeerState {
  id: string;
  alias: string;
  avatarSeed: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShareEnabled: boolean;
  isHandRaised?: boolean;
}

export interface MediaDeviceInfoList {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
}
