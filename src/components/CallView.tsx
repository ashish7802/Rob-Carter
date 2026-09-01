import React, { useState, useEffect, useRef } from 'react';
import { AnonymousUser, PeerState, ChatMessage } from '../types';
import { getRoomInviteUrl, copyToClipboard } from '../utils/invite';
import { ChatPanel } from './ChatPanel';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  Users,
  MessageSquare,
  Info,
  Settings,
  Hand,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  Share2,
} from 'lucide-react';

interface CallViewProps {
  currentUser: AnonymousUser;
  peerState: PeerState | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  audioLevel: number;
  roomCode: string;
  messages: ChatMessage[];
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onSendMessage: (text: string) => void;
  onToggleHandRaise: (isHandRaised: boolean) => void;
  onLeaveCall: () => void;
  onOpenSettings: () => void;
}

export const CallView: React.FC<CallViewProps> = ({
  currentUser,
  peerState,
  localStream,
  remoteStream,
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  audioLevel,
  roomCode,
  messages,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onSendMessage,
  onToggleHandRaise,
  onLeaveCall,
  onOpenSettings,
}) => {
  // Drawer states: 'chat' | 'people' | 'info' | null
  const [activeDrawer, setActiveDrawer] = useState<'chat' | 'people' | 'info' | null>(null);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [pinnedTile, setPinnedTile] = useState<'local' | 'remote' | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const inviteUrl = getRoomInviteUrl(roomCode);

  // Timer loop for call duration
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoEnabled, isScreenSharing]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, peerState?.videoEnabled, peerState?.screenShareEnabled]);

  const handleCopyLink = async () => {
    const success = await copyToClipboard(inviteUrl);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleHandRaiseToggle = () => {
    const nextState = !isHandRaised;
    setIsHandRaised(nextState);
    onToggleHandRaise(nextState);
  };

  const participantCount = peerState ? 2 : 1;

  return (
    <div className="relative flex h-[calc(100vh-64px)] w-full flex-col bg-[#121418] text-white overflow-hidden select-none">
      
      {/* TOP BAR / OVERLAY */}
      <div className="absolute top-0 inset-x-0 h-14 px-4 sm:px-6 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Room Code & Copy */}
          <div className="flex items-center gap-2 rounded-full bg-[#202124]/90 backdrop-blur-md px-3.5 py-1.5 border border-[#3c4043] shadow-md">
            <span className="text-xs font-mono font-medium text-cyan-300">
              {roomCode}
            </span>
            <button
              onClick={handleCopyLink}
              title="Copy meeting invite link"
              className="text-[#9aa0a6] hover:text-white transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Call Timer */}
          <div className="text-xs font-medium text-[#9aa0a6] bg-[#202124]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#3c4043]">
            {formatDuration(callDuration)}
          </div>
        </div>

        {/* E2EE Badge */}
        <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-[#202124]/90 backdrop-blur-md px-3 py-1.5 border border-emerald-500/30 text-[11px] text-emerald-400 pointer-events-auto">
          <Lock className="h-3 w-3" />
          <span>End-to-End Encrypted (P2P)</span>
        </div>
      </div>

      {/* MAIN CONTENT AREA: Video Stage + Side Drawers */}
      <div className="flex flex-1 w-full overflow-hidden pt-14 pb-20">
        
        {/* VIDEO STAGE */}
        <div className="flex-1 p-3 sm:p-4 md:p-6 flex items-center justify-center overflow-hidden">
          {peerState ? (
            /* 2 PARTICIPANTS (Self + Peer) */
            <div className={`w-full h-full grid gap-3 sm:gap-4 ${
              pinnedTile
                ? 'grid-cols-1'
                : 'grid-cols-1 md:grid-cols-2'
            }`}>
              
              {/* REMOTE PEER TILE */}
              {(!pinnedTile || pinnedTile === 'remote') && (
                <div className="relative w-full h-full min-h-[220px] rounded-2xl sm:rounded-3xl bg-[#202124] border border-[#3c4043] overflow-hidden flex items-center justify-center shadow-xl group">
                  {peerState.videoEnabled && remoteStream ? (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div
                        className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-slate-950 font-mono shadow-2xl"
                        style={{ backgroundColor: '#06b6d4' }}
                      >
                        {peerState.alias.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-sm font-medium text-[#9aa0a6]">
                        {peerState.alias}
                      </div>
                    </div>
                  )}

                  {/* Peer Speaking wave indicator border */}
                  {peerState.audioEnabled && (
                    <div className="absolute inset-0 border-2 border-emerald-500/0 transition-all pointer-events-none" />
                  )}

                  {/* Hand Raised Badge */}
                  {peerState.isHandRaised && (
                    <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-amber-500/90 text-slate-950 px-3 py-1 text-xs font-bold shadow-lg animate-bounce">
                      <Hand className="h-3.5 w-3.5" />
                      <span>Hand Raised</span>
                    </div>
                  )}

                  {/* Top-Right Pin button */}
                  <button
                    onClick={() => setPinnedTile(pinnedTile === 'remote' ? null : 'remote')}
                    className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {pinnedTile === 'remote' ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </button>

                  {/* Bottom Name Label & Status */}
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-3 py-1.5 text-xs text-white border border-white/10">
                    <span className="font-medium">{peerState.alias}</span>
                    {!peerState.audioEnabled && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white">
                        <MicOff className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* LOCAL USER TILE */}
              {(!pinnedTile || pinnedTile === 'local') && (
                <div className="relative w-full h-full min-h-[220px] rounded-2xl sm:rounded-3xl bg-[#202124] border border-[#3c4043] overflow-hidden flex items-center justify-center shadow-xl group">
                  {isVideoEnabled && localStream ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`h-full w-full object-cover ${isScreenSharing ? '' : '-scale-x-100'}`}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div
                        className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-slate-950 font-mono shadow-2xl"
                        style={{ backgroundColor: currentUser.color || '#10b981' }}
                      >
                        {currentUser.alias.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-sm font-medium text-[#9aa0a6]">
                        {currentUser.alias} (You)
                      </div>
                    </div>
                  )}

                  {/* Speaking indicator wave ring */}
                  {isAudioEnabled && audioLevel > 15 && (
                    <div className="absolute inset-0 rounded-2xl sm:rounded-3xl border-2 border-emerald-400 pointer-events-none animate-pulse" />
                  )}

                  {/* Hand Raised Badge (Self) */}
                  {isHandRaised && (
                    <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-amber-500/90 text-slate-950 px-3 py-1 text-xs font-bold shadow-lg">
                      <Hand className="h-3.5 w-3.5" />
                      <span>You raised your hand</span>
                    </div>
                  )}

                  {/* Top-Right Pin button */}
                  <button
                    onClick={() => setPinnedTile(pinnedTile === 'local' ? null : 'local')}
                    className="absolute top-4 right-4 h-8 w-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    {pinnedTile === 'local' ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </button>

                  {/* Bottom Name Label & Status */}
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-3 py-1.5 text-xs text-white border border-white/10">
                    <span className="font-medium">{currentUser.alias} (You)</span>
                    {!isAudioEnabled && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-white">
                        <MicOff className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* 1 PARTICIPANT (WAITING ROOM) */
            <div className="relative w-full max-w-4xl h-full flex flex-col md:flex-row items-center justify-center gap-6">
              
              {/* Local Camera Tile */}
              <div className="relative aspect-[16/10] w-full max-w-lg rounded-3xl bg-[#202124] border border-[#3c4043] overflow-hidden flex items-center justify-center shadow-2xl">
                {isVideoEnabled && localStream ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`h-full w-full object-cover ${isScreenSharing ? '' : '-scale-x-100'}`}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-slate-950 font-mono shadow-2xl"
                      style={{ backgroundColor: currentUser.color || '#10b981' }}
                    >
                      {currentUser.alias.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-xs font-medium text-[#9aa0a6]">
                      {currentUser.alias} (You)
                    </div>
                  </div>
                )}

                {/* Bottom label */}
                <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs text-white border border-white/10">
                  <span>{currentUser.alias} (You)</span>
                  {!isAudioEnabled && <MicOff className="h-3 w-3 text-rose-400" />}
                </div>
              </div>

              {/* Waiting Room Share Card */}
              <div className="w-full max-w-md rounded-3xl border border-[#3c4043] bg-[#202124] p-6 shadow-2xl space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-white font-['Google_Sans',sans-serif]">
                    Waiting for others to join
                  </h3>
                  <p className="text-xs text-[#9aa0a6] mt-1">
                    Send this link to anyone you want in this call. No account is required to join.
                  </p>
                </div>

                {/* Copy Link Input */}
                <div className="flex items-center gap-2 p-1.5 rounded-xl border border-[#3c4043] bg-[#282a2d]">
                  <input
                    type="text"
                    readOnly
                    value={inviteUrl}
                    className="flex-1 bg-transparent px-2.5 py-1 text-xs font-mono text-cyan-300 focus:outline-none select-all truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      copiedLink ? 'bg-emerald-600 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    }`}
                  >
                    {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedLink ? 'Copied' : 'Copy link'}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-[#3c4043] flex items-center gap-2 text-xs text-emerald-400">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Direct WebRTC End-to-End Encryption active</span>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* SIDE DRAWERS */}
        
        {/* 1. In-Call Chat Drawer */}
        <ChatPanel
          isOpen={activeDrawer === 'chat'}
          onClose={() => setActiveDrawer(null)}
          messages={messages}
          currentUser={currentUser}
          onSendMessage={onSendMessage}
        />

        {/* 2. People / Participants Drawer */}
        {activeDrawer === 'people' && (
          <aside className="w-full sm:w-80 md:w-96 flex flex-col h-full bg-[#202124] border-l border-[#3c4043] z-20 animate-in slide-in-from-right duration-200 shadow-2xl">
            <div className="h-14 border-b border-[#3c4043] px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white font-['Google_Sans',sans-serif]">
                  People ({participantCount})
                </h3>
              </div>
              <button
                onClick={() => setActiveDrawer(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {/* Local User */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-[#282a2d] border border-[#3c4043]">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-slate-950 font-mono"
                    style={{ backgroundColor: currentUser.color || '#10b981' }}
                  >
                    {currentUser.alias.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white">
                      {currentUser.alias} (You)
                    </div>
                    <div className="text-[10px] text-cyan-400">Meeting Host</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[#9aa0a6]">
                  {isHandRaised && <Hand className="h-4 w-4 text-amber-400" />}
                  {isAudioEnabled ? <Mic className="h-4 w-4 text-emerald-400" /> : <MicOff className="h-4 w-4 text-rose-400" />}
                  {isVideoEnabled ? <Video className="h-4 w-4 text-emerald-400" /> : <VideoOff className="h-4 w-4 text-rose-400" />}
                </div>
              </div>

              {/* Remote Peer if connected */}
              {peerState && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#282a2d] border border-[#3c4043]">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-slate-950 font-mono"
                      style={{ backgroundColor: '#06b6d4' }}
                    >
                      {peerState.alias.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-white">
                        {peerState.alias}
                      </div>
                      <div className="text-[10px] text-[#9aa0a6]">Connected Peer</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[#9aa0a6]">
                    {peerState.isHandRaised && <Hand className="h-4 w-4 text-amber-400" />}
                    {peerState.audioEnabled ? <Mic className="h-4 w-4 text-emerald-400" /> : <MicOff className="h-4 w-4 text-rose-400" />}
                    {peerState.videoEnabled ? <Video className="h-4 w-4 text-emerald-400" /> : <VideoOff className="h-4 w-4 text-rose-400" />}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* 3. Meeting Details / Info Drawer */}
        {activeDrawer === 'info' && (
          <aside className="w-full sm:w-80 md:w-96 flex flex-col h-full bg-[#202124] border-l border-[#3c4043] z-20 animate-in slide-in-from-right duration-200 shadow-2xl">
            <div className="h-14 border-b border-[#3c4043] px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white font-['Google_Sans',sans-serif]">
                  Meeting details
                </h3>
              </div>
              <button
                onClick={() => setActiveDrawer(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-5 flex-1 overflow-y-auto">
              {/* Joining Info */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-white">Joining info</div>
                <div className="text-xs font-mono text-cyan-300 break-all p-2.5 rounded-xl bg-[#282a2d] border border-[#3c4043]">
                  {inviteUrl}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 py-2 text-xs font-medium text-white transition-colors cursor-pointer shadow-sm"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedLink ? 'Joining info copied' : 'Copy joining info'}</span>
                </button>
              </div>

              {/* Encryption Guarantee */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2 text-xs text-[#9aa0a6]">
                <div className="flex items-center gap-2 font-semibold text-emerald-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>End-to-End Encrypted</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Your audio, video, and screen sharing are directly encrypted peer-to-peer using WebRTC DTLS-SRTP. No third party or server can access your call.
                </p>
              </div>
            </div>
          </aside>
        )}

      </div>

      {/* GOOGLE MEET CLASSIC BOTTOM CONTROLS DOCK */}
      <footer className="absolute bottom-0 inset-x-0 h-20 bg-[#121418] border-t border-[#2d3139] px-4 sm:px-6 flex items-center justify-between z-30">
        
        {/* Left: Meeting code & Call duration */}
        <div className="hidden lg:flex items-center gap-3 w-64">
          <span className="text-xs font-mono text-cyan-300 font-medium">{roomCode}</span>
          <span className="text-[#3c4043]">|</span>
          <span className="text-xs text-[#9aa0a6]">{formatDuration(callDuration)}</span>
        </div>

        {/* Center: Core Meeting Controls (Exact Google Meet round buttons) */}
        <div className="flex-1 flex items-center justify-center gap-2 sm:gap-3">
          
          {/* Mic Mute Toggle */}
          <button
            id="call-toggle-mic-btn"
            onClick={onToggleAudio}
            title={isAudioEnabled ? 'Turn off microphone' : 'Turn on microphone'}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all cursor-pointer shadow-md ${
              isAudioEnabled
                ? 'bg-[#3c4043] hover:bg-[#4a4e51] text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Camera On/Off Toggle */}
          <button
            id="call-toggle-camera-btn"
            onClick={onToggleVideo}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all cursor-pointer shadow-md ${
              isVideoEnabled
                ? 'bg-[#3c4043] hover:bg-[#4a4e51] text-white'
                : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Screen Share / Present now */}
          <button
            id="call-toggle-screenshare-btn"
            onClick={onToggleScreenShare}
            title={isScreenSharing ? 'Stop presenting' : 'Present now'}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all cursor-pointer shadow-md ${
              isScreenSharing
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white ring-2 ring-cyan-400'
                : 'bg-[#3c4043] hover:bg-[#4a4e51] text-white'
            }`}
          >
            <ScreenShare className="h-5 w-5" />
          </button>

          {/* Raise Hand Toggle */}
          <button
            id="call-toggle-hand-btn"
            onClick={handleHandRaiseToggle}
            title={isHandRaised ? 'Lower hand' : 'Raise hand'}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all cursor-pointer shadow-md ${
              isHandRaised
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-[#3c4043] hover:bg-[#4a4e51] text-white'
            }`}
          >
            <Hand className="h-5 w-5" />
          </button>

          {/* Audio & Video Settings */}
          <button
            id="call-open-settings-btn"
            onClick={onOpenSettings}
            title="Audio & video settings"
            className="hidden sm:flex h-12 w-12 items-center justify-center rounded-full bg-[#3c4043] hover:bg-[#4a4e51] text-white transition-all cursor-pointer shadow-md"
          >
            <Settings className="h-5 w-5" />
          </button>

          {/* Red Leave Call button */}
          <button
            id="call-leave-btn"
            onClick={onLeaveCall}
            title="Leave call"
            className="flex h-12 px-6 items-center justify-center gap-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-lg transition-all cursor-pointer active:scale-95 ml-2 sm:ml-4"
          >
            <PhoneOff className="h-5 w-5" />
            <span className="hidden sm:inline">Leave</span>
          </button>

        </div>

        {/* Right: Meeting Info, People, Chat Toggles */}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 w-auto lg:w-64">
          
          {/* Meeting Info Button */}
          <button
            id="call-drawer-info-btn"
            onClick={() => setActiveDrawer(activeDrawer === 'info' ? null : 'info')}
            title="Meeting details"
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors cursor-pointer ${
              activeDrawer === 'info'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-[#9aa0a6] hover:text-white hover:bg-[#202124]'
            }`}
          >
            <Info className="h-5 w-5" />
          </button>

          {/* People / Participants Button */}
          <button
            id="call-drawer-people-btn"
            onClick={() => setActiveDrawer(activeDrawer === 'people' ? null : 'people')}
            title="Participants"
            className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors cursor-pointer ${
              activeDrawer === 'people'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-[#9aa0a6] hover:text-white hover:bg-[#202124]'
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-bold text-white">
              {participantCount}
            </span>
          </button>

          {/* In-Call Chat Button */}
          <button
            id="call-drawer-chat-btn"
            onClick={() => setActiveDrawer(activeDrawer === 'chat' ? null : 'chat')}
            title="In-call messages"
            className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors cursor-pointer ${
              activeDrawer === 'chat'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-[#9aa0a6] hover:text-white hover:bg-[#202124]'
            }`}
          >
            <MessageSquare className="h-5 w-5" />
            {messages.length > 0 && activeDrawer !== 'chat' && (
              <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            )}
          </button>

        </div>

      </footer>

    </div>
  );
};
