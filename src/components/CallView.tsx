import React, { useState, useEffect, useRef } from 'react';
import { PeerState, AnonymousUser, VoiceFilterType, VideoFilterType } from '../types';
import { getAvatarSvg } from '../utils/alias';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Tv,
  Radio,
  Sliders,
  PhoneOff,
  SkipForward,
  PenTool,
  Maximize2,
  Minimize2,
  Volume2,
  Lock,
  Sparkles,
  Smile,
  Shield,
  Eye,
  Layers,
} from 'lucide-react';

interface CallViewProps {
  currentUser: AnonymousUser;
  peerState: PeerState | null;
  mode: 'stranger' | 'custom_room' | 'ai';
  roomCode: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  activeVoiceFilter: VoiceFilterType;
  activeVideoFilter: VideoFilterType;
  audioLevel: number;
  isWhiteboardOpen: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onChangeVoiceFilter: (filter: VoiceFilterType) => void;
  onChangeVideoFilter: (filter: VideoFilterType) => void;
  onToggleWhiteboard: () => void;
  onOpenSoundboard: () => void;
  onNextStranger: () => void;
  onEndCall: () => void;
}

const VOICE_FILTER_OPTIONS: { id: VoiceFilterType; label: string }[] = [
  { id: 'none', label: 'Natural Voice' },
  { id: 'deep', label: 'Deep Bass' },
  { id: 'helium', label: 'Helium' },
  { id: 'robot', label: 'Cyber Robot' },
  { id: 'whisper', label: 'Whisper Spy' },
  { id: 'radio', label: 'Walkie-Talkie' },
];

const VIDEO_FILTER_OPTIONS: { id: VideoFilterType; label: string }[] = [
  { id: 'none', label: 'Natural' },
  { id: 'privacy_blur', label: 'Privacy Blur' },
  { id: 'cyber_hologram', label: 'Cyber Holo' },
  { id: 'night_vision', label: 'Night Vision' },
  { id: 'pixelate', label: 'Pixelate 16px' },
  { id: 'matrix', label: 'Matrix Code' },
  { id: 'noir', label: 'Film Noir' },
];

export const CallView: React.FC<CallViewProps> = ({
  currentUser,
  peerState,
  mode,
  roomCode,
  localStream,
  remoteStream,
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  activeVoiceFilter,
  activeVideoFilter,
  audioLevel,
  isWhiteboardOpen,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onChangeVoiceFilter,
  onChangeVideoFilter,
  onToggleWhiteboard,
  onOpenSoundboard,
  onNextStranger,
  onEndCall,
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipPosition, setPipPosition] = useState<'top-right' | 'bottom-right'>('bottom-right');

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);

  // Call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format seconds -> MM:SS
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Attach streams
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Fullscreen toggler
  const toggleFullscreen = () => {
    if (!stageContainerRef.current) return;
    if (!document.fullscreenElement) {
      stageContainerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={stageContainerRef}
      className="relative flex-1 flex flex-col h-full bg-[#07090e] overflow-hidden select-none"
    >
      {/* Top Floating Status Overlay */}
      <div className="absolute top-4 inset-x-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Left: Peer Identity badge */}
        <div className="flex items-center gap-2.5 rounded-xl bg-slate-950/80 px-3 py-1.5 backdrop-blur-md border border-slate-800 pointer-events-auto shadow-lg">
          <div className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-200">
            {peerState ? peerState.alias : mode === 'ai' ? 'Phantom AI' : 'Connecting Stranger...'}
          </span>
          {roomCode && (
            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400 border border-cyan-500/20">
              #{roomCode}
            </span>
          )}
          {peerState?.sharedInterests && peerState.sharedInterests.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-slate-800">
              {peerState.sharedInterests.slice(0, 2).map((tag) => (
                <span key={tag} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: Duration & Security badge */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-950/80 px-3 py-1.5 backdrop-blur-md border border-slate-800 text-xs font-mono text-slate-300 shadow-lg">
            <Lock className="h-3 w-3 text-emerald-400" />
            <span>{formatDuration(callDuration)}</span>
          </div>

          <button
            id="call-fullscreen-btn"
            onClick={toggleFullscreen}
            className="rounded-xl bg-slate-950/80 p-2 text-slate-300 backdrop-blur-md border border-slate-800 hover:bg-slate-800 hover:text-white transition-all cursor-pointer shadow-lg"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Video Stage */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-cyber-dots bg-slate-950">
        {/* Remote Video Stream or Avatar Fallback */}
        {remoteStream && remoteStream.getVideoTracks().length > 0 && peerState?.videoEnabled !== false ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 text-center p-6">
            <div
              className="h-28 w-28 sm:h-36 sm:w-36 rounded-3xl overflow-hidden shadow-2xl border border-slate-700/80 ring-4 ring-slate-800/40 animate-pulse"
              dangerouslySetInnerHTML={{
                __html: getAvatarSvg(peerState?.avatarSeed || 'stranger-avatar', '#10b981'),
              }}
            />
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {peerState?.alias || (mode === 'ai' ? 'Phantom AI' : 'Incognito Peer')}
              </h3>
              <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1.5">
                {peerState?.audioEnabled ? (
                  <>
                    <Mic className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Voice Connected (Encrypted)</span>
                  </>
                ) : (
                  <>
                    <MicOff className="h-3.5 w-3.5 text-slate-500" />
                    <span>Microphone Off</span>
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Local Self PiP Preview (Draggable / Positioned) */}
        <div
          className={`absolute ${
            pipPosition === 'bottom-right' ? 'bottom-20 right-4' : 'top-16 right-4'
          } z-20 w-36 sm:w-52 aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-700/80 shadow-2xl backdrop-blur-md transition-all group`}
        >
          {localStream && isVideoEnabled ? (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover -scale-x-100"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center bg-slate-950 p-2 text-center">
              <div
                className="h-10 w-10 rounded-xl overflow-hidden shadow-md border border-slate-700"
                dangerouslySetInnerHTML={{ __html: getAvatarSvg(currentUser.avatarSeed, currentUser.color) }}
              />
              <span className="text-[10px] text-slate-400 mt-1 font-mono">You (Anon)</span>
            </div>
          )}

          {/* Local overlay indicators */}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
            {!isAudioEnabled && (
              <span className="rounded bg-rose-500/80 p-1 text-white">
                <MicOff className="h-2.5 w-2.5" />
              </span>
            )}
            {activeVideoFilter !== 'none' && (
              <span className="rounded bg-cyan-500/80 px-1 py-0.5 text-[9px] font-mono text-slate-950 font-bold">
                FX
              </span>
            )}
            {activeVoiceFilter !== 'none' && (
              <span className="rounded bg-purple-500/80 px-1 py-0.5 text-[9px] font-mono text-white font-bold">
                VOICE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Floating Control Bar */}
      <div className="relative z-30 w-full p-4 flex items-center justify-center">
        <div className="flex items-center gap-2 sm:gap-3 rounded-2xl bg-slate-900/90 p-2 backdrop-blur-xl border border-slate-800 shadow-2xl">
          
          {/* Mic Toggle + Voice Filter Popup */}
          <div className="relative">
            <div className="flex items-center rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <button
                id="call-toggle-mic-btn"
                onClick={onToggleAudio}
                title={isAudioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
                className={`p-3 transition-colors cursor-pointer ${
                  isAudioEnabled
                    ? 'text-emerald-400 hover:bg-slate-800'
                    : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                }`}
              >
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>
              <button
                id="call-voice-fx-dropdown-btn"
                onClick={() => {
                  setShowVoiceMenu(!showVoiceMenu);
                  setShowVideoMenu(false);
                }}
                title="Voice Disguiser & Pitch FX"
                className={`p-2 border-l border-slate-800 transition-colors cursor-pointer ${
                  activeVoiceFilter !== 'none' ? 'text-purple-400 bg-purple-500/10' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Radio className="h-4 w-4" />
              </button>
            </div>

            {/* Voice Filter Dropup Menu */}
            {showVoiceMenu && (
              <div className="absolute bottom-full mb-2 left-0 w-44 rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-2xl backdrop-blur-xl z-50">
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Voice Disguiser
                </div>
                {VOICE_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onChangeVoiceFilter(opt.id);
                      setShowVoiceMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${
                      activeVoiceFilter === opt.id
                        ? 'bg-purple-500/20 text-purple-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {activeVoiceFilter === opt.id && <span className="text-purple-400">●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Camera Toggle + Video Filter Popup */}
          <div className="relative">
            <div className="flex items-center rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <button
                id="call-toggle-cam-btn"
                onClick={onToggleVideo}
                title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                className={`p-3 transition-colors cursor-pointer ${
                  isVideoEnabled
                    ? 'text-cyan-400 hover:bg-slate-800'
                    : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                }`}
              >
                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
              <button
                id="call-video-fx-dropdown-btn"
                onClick={() => {
                  setShowVideoMenu(!showVideoMenu);
                  setShowVoiceMenu(false);
                }}
                title="Privacy Video Filters & Masks"
                className={`p-2 border-l border-slate-800 transition-colors cursor-pointer ${
                  activeVideoFilter !== 'none' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Sliders className="h-4 w-4" />
              </button>
            </div>

            {/* Video Filter Dropup Menu */}
            {showVideoMenu && (
              <div className="absolute bottom-full mb-2 left-0 w-44 rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-2xl backdrop-blur-xl z-50">
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Privacy Filters
                </div>
                {VIDEO_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      onChangeVideoFilter(opt.id);
                      setShowVideoMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${
                      activeVideoFilter === opt.id
                        ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {activeVideoFilter === opt.id && <span className="text-cyan-400">●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Screen Share Toggle */}
          <button
            id="call-toggle-screenshare-btn"
            onClick={onToggleScreenShare}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              isScreenSharing
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                : 'border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Tv className="h-5 w-5" />
          </button>

          {/* Collaborative Whiteboard Toggle */}
          <button
            id="call-toggle-whiteboard-btn"
            onClick={onToggleWhiteboard}
            title="Open Collaborative Whiteboard"
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              isWhiteboardOpen
                ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <PenTool className="h-5 w-5" />
          </button>

          {/* Soundboard Trigger */}
          <button
            id="call-open-soundboard-btn"
            onClick={onOpenSoundboard}
            title="Instant Sound FX & Reactions"
            className="p-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-purple-400 transition-all cursor-pointer"
          >
            <Smile className="h-5 w-5" />
          </button>

          {/* Mode-specific Action: Next Stranger or Leave */}
          {mode === 'stranger' ? (
            <button
              id="call-next-stranger-btn"
              onClick={onNextStranger}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-xs font-bold text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:brightness-110 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <SkipForward className="h-4 w-4 fill-slate-950" />
              <span>Next Stranger</span>
            </button>
          ) : (
            <button
              id="call-end-call-btn"
              onClick={onEndCall}
              className="flex items-center gap-2 rounded-xl bg-rose-500/20 border border-rose-500/40 px-4 py-3 text-xs font-bold text-rose-300 hover:bg-rose-500/30 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <PhoneOff className="h-4 w-4" />
              <span>Leave</span>
            </button>
          )}

        </div>
      </div>
    </div>
  );
};
