import React, { useState, useEffect, useRef } from 'react';
import { AnonymousUser, VoiceFilterType, VideoFilterType } from '../types';
import { getAvatarSvg } from '../utils/alias';
import {
  Users,
  KeyRound,
  Bot,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Sparkles,
  ShieldCheck,
  Zap,
  Lock,
  Tag,
  Radio,
  Eye,
  Sliders,
  Volume2,
  Tv,
} from 'lucide-react';

interface LobbyProps {
  currentUser: AnonymousUser;
  isSearching: boolean;
  localStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  activeVoiceFilter: VoiceFilterType;
  activeVideoFilter: VideoFilterType;
  audioLevel: number;
  onStartSearch: (interests: string[]) => void;
  onCancelSearch: () => void;
  onJoinCustomRoom: (roomCode: string) => void;
  onStartAiChat: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onChangeVoiceFilter: (filter: VoiceFilterType) => void;
  onChangeVideoFilter: (filter: VideoFilterType) => void;
}

const INTEREST_TAGS = [
  'Random',
  'Deep Talk',
  'Tech & Code',
  'Gaming',
  'Late Night',
  'Philosophy',
  'Music & Beats',
  'Movies & Shows',
  'Confessions',
  'Cybersecurity',
  'Debates',
  'Anime',
];

const VOICE_FILTER_OPTIONS: { id: VoiceFilterType; label: string; desc: string }[] = [
  { id: 'none', label: 'Natural', desc: 'No pitch modification' },
  { id: 'deep', label: 'Deep Voice', desc: 'Low bass anonymizer' },
  { id: 'helium', label: 'Helium', desc: 'High pitch modifier' },
  { id: 'robot', label: 'Cyber Robot', desc: 'Ring-modulated robotic voice' },
  { id: 'whisper', label: 'Whisper Spy', desc: 'Compressed stealth tone' },
  { id: 'radio', label: 'Walkie-Talkie', desc: 'Lo-fi military comm effect' },
];

const VIDEO_FILTER_OPTIONS: { id: VideoFilterType; label: string }[] = [
  { id: 'none', label: 'Standard' },
  { id: 'privacy_blur', label: 'Privacy Blur' },
  { id: 'cyber_hologram', label: 'Cyber Holo' },
  { id: 'night_vision', label: 'Night Vision' },
  { id: 'pixelate', label: 'Mosaic Pixel' },
  { id: 'matrix', label: 'Matrix Code' },
  { id: 'noir', label: 'Noir B&W' },
];

export const Lobby: React.FC<LobbyProps> = ({
  currentUser,
  isSearching,
  localStream,
  isAudioEnabled,
  isVideoEnabled,
  activeVoiceFilter,
  activeVideoFilter,
  audioLevel,
  onStartSearch,
  onCancelSearch,
  onJoinCustomRoom,
  onStartAiChat,
  onToggleAudio,
  onToggleVideo,
  onChangeVoiceFilter,
  onChangeVideoFilter,
}) => {
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['Random']);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [activeTab, setActiveTab] = useState<'stranger' | 'custom_room' | 'ai'>('stranger');
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Attach local stream to preview element
  useEffect(() => {
    if (videoPreviewRef.current && localStream) {
      videoPreviewRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const toggleInterest = (tag: string) => {
    if (tag === 'Random') {
      setSelectedInterests(['Random']);
      return;
    }
    const filtered = selectedInterests.filter((t) => t !== 'Random');
    if (filtered.includes(tag)) {
      const next = filtered.filter((t) => t !== tag);
      setSelectedInterests(next.length === 0 ? ['Random'] : next);
    } else {
      setSelectedInterests([...filtered, tag]);
    }
  };

  const handleGenerateRoomCode = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'ANON-';
    for (let i = 0; i < 4; i++) {
      code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    setRoomCodeInput(code);
  };

  return (
    <main className="relative min-h-[calc(100vh-65px)] bg-cyber-grid bg-[#080a0f] p-4 sm:p-6 lg:p-8 flex items-center justify-center">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Device & Privacy Preview Card (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-slate-200">Hardware & Privacy Setup</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Ready
                </span>
              </div>

              {/* Camera Preview Box */}
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center group shadow-inner">
                {localStream && isVideoEnabled ? (
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover -scale-x-100"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
                    <div
                      className="h-16 w-16 rounded-2xl overflow-hidden shadow-lg border border-slate-700"
                      dangerouslySetInnerHTML={{ __html: getAvatarSvg(currentUser.avatarSeed, currentUser.color) }}
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-300">{currentUser.alias}</p>
                      <p className="text-[11px] text-slate-500">Camera is muted or off</p>
                    </div>
                  </div>
                )}

                {/* Video Filter label badge */}
                {activeVideoFilter !== 'none' && isVideoEnabled && (
                  <div className="absolute top-2.5 left-2.5 rounded-md bg-slate-950/80 px-2 py-1 text-[10px] font-mono text-cyan-400 border border-cyan-500/30 backdrop-blur-sm">
                    Filter: {VIDEO_FILTER_OPTIONS.find((f) => f.id === activeVideoFilter)?.label}
                  </div>
                )}

                {/* Bottom hardware toggle buttons on preview */}
                <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between rounded-lg bg-slate-950/70 p-1.5 backdrop-blur-md border border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <button
                      id="lobby-toggle-mic-btn"
                      onClick={onToggleAudio}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                        isAudioEnabled
                          ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {isAudioEnabled ? <Mic className="h-3.5 w-3.5 text-emerald-400" /> : <MicOff className="h-3.5 w-3.5" />}
                      <span>{isAudioEnabled ? 'Mic On' : 'Muted'}</span>
                    </button>

                    <button
                      id="lobby-toggle-cam-btn"
                      onClick={onToggleVideo}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                        isVideoEnabled
                          ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {isVideoEnabled ? <Video className="h-3.5 w-3.5 text-cyan-400" /> : <VideoOff className="h-3.5 w-3.5" />}
                      <span>{isVideoEnabled ? 'Cam On' : 'Off'}</span>
                    </button>
                  </div>

                  {/* Audio level meter */}
                  <div className="flex items-center gap-1.5 px-2">
                    <div className="flex items-end gap-0.5 h-3">
                      <div
                        className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(2, (audioLevel / 100) * 12)}px` }}
                      />
                      <div
                        className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(2, (audioLevel / 100) * 16)}px` }}
                      />
                      <div
                        className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                        style={{ height: `${Math.max(2, (audioLevel / 100) * 10)}px` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Privacy Video Filters Selector */}
              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center justify-between">
                  <span>Privacy Video Mask / Filter</span>
                  <span className="text-[10px] text-slate-500">Processed locally</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {VIDEO_FILTER_OPTIONS.map((filter) => (
                    <button
                      key={filter.id}
                      id={`video-filter-${filter.id}`}
                      onClick={() => onChangeVideoFilter(filter.id)}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-medium border text-center transition-all cursor-pointer truncate ${
                        activeVideoFilter === filter.id
                          ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice Disguiser / Pitch Shifter Selector */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-purple-400" />
                    <span>Voice Anonymizer / Pitch FX</span>
                  </span>
                  <span className="text-[10px] font-mono text-purple-400">
                    {VOICE_FILTER_OPTIONS.find((v) => v.id === activeVoiceFilter)?.label}
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {VOICE_FILTER_OPTIONS.map((voice) => (
                    <button
                      key={voice.id}
                      id={`voice-filter-${voice.id}`}
                      onClick={() => onChangeVoiceFilter(voice.id)}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-medium border text-center transition-all cursor-pointer truncate ${
                        activeVoiceFilter === voice.id
                          ? 'border-purple-500/60 bg-purple-500/15 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {voice.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Privacy Guarantee Pill */}
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3.5 flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Lock className="h-4 w-4" />
              </div>
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-slate-300">100% Anonymity:</span> Direct peer-to-peer WebRTC encryption. No chat logs, no account signup, self-destructing data.
              </div>
            </div>
          </div>

          {/* Right Column: Matchmaker / Room Center (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl">
              {/* Top Navigation Tabs */}
              <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800/80 mb-6">
                <button
                  id="tab-stranger-btn"
                  onClick={() => setActiveTab('stranger')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'stranger'
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="h-4 w-4 text-emerald-400" />
                  <span>Random Stranger</span>
                </button>
                <button
                  id="tab-custom-room-btn"
                  onClick={() => setActiveTab('custom_room')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'custom_room'
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <KeyRound className="h-4 w-4 text-cyan-400" />
                  <span>Private Room Code</span>
                </button>
                <button
                  id="tab-ai-btn"
                  onClick={() => setActiveTab('ai')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'ai'
                      ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border border-purple-500/30 shadow-md'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Bot className="h-4 w-4 text-purple-400" />
                  <span>Phantom AI</span>
                </button>
              </div>

              {/* Tab Content 1: Random Stranger */}
              {activeTab === 'stranger' && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-base font-bold text-white flex items-center gap-2">
                        <Tag className="h-4 w-4 text-emerald-400" />
                        <span>Match by Interests & Topics</span>
                      </h2>
                      <span className="text-xs text-slate-400 font-mono">
                        {selectedInterests.length} selected
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-3">
                      Select interests to be paired with someone who shares your topics, or leave on &quot;Random&quot; for instant discovery.
                    </p>

                    {/* Interest Tags Grid */}
                    <div className="flex flex-wrap gap-2">
                      {INTEREST_TAGS.map((tag) => {
                        const isSelected = selectedInterests.includes(tag);
                        return (
                          <button
                            key={tag}
                            id={`interest-tag-${tag.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                            onClick={() => toggleInterest(tag)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-medium border transition-all cursor-pointer ${
                              isSelected
                                ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                            }`}
                          >
                            {isSelected ? '✓ ' : ''}{tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Searching State or Action Button */}
                  {isSearching ? (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center space-y-4">
                      <div className="relative mx-auto h-20 w-20 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border border-emerald-500/40 animate-ping" />
                        <div className="absolute inset-2 rounded-full border-2 border-dashed border-emerald-400 animate-spin" />
                        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <Users className="h-5 w-5" />
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-white">Scanning for an Anonymous Stranger...</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Looking for matching interests: <span className="text-emerald-400 font-mono">{selectedInterests.join(', ')}</span>
                        </p>
                      </div>

                      <button
                        id="cancel-search-btn"
                        onClick={onCancelSearch}
                        className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-6 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/25 transition-all cursor-pointer"
                      >
                        Cancel Search
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        id="start-stranger-match-btn"
                        onClick={() => onStartSearch(selectedInterests)}
                        className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-6 py-4 text-base font-bold text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.35)] hover:shadow-[0_0_35px_rgba(16,185,129,0.5)] hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer"
                      >
                        <Zap className="h-5 w-5 fill-slate-950" />
                        <span>Start Anonymous Instant Match</span>
                      </button>
                      <p className="text-center text-[11px] text-slate-500">
                        Zero trace. Full Video, Audio, Screen Share and Real-time Chat ready on connect.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Content 2: Private Custom Room */}
              {activeTab === 'custom_room' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                      <KeyRound className="h-4 w-4 text-cyan-400" />
                      <span>Direct Secret Room Code</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Create or join a private ephemeral room code. Share the code with someone to meet directly in a secure anonymous space.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Room Code (4-12 characters)
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="room-code-input"
                          type="text"
                          value={roomCodeInput}
                          onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                          placeholder="e.g. ANON-892"
                          maxLength={16}
                          className="flex-1 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm font-mono tracking-wider text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                        />
                        <button
                          id="generate-code-btn"
                          onClick={handleGenerateRoomCode}
                          className="rounded-xl border border-slate-800 bg-slate-800/80 px-4 py-3 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white transition-all cursor-pointer whitespace-nowrap"
                        >
                          Auto Generate
                        </button>
                      </div>
                    </div>

                    <button
                      id="join-room-btn"
                      onClick={() => onJoinCustomRoom(roomCodeInput || 'ANON-777')}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <Lock className="h-4 w-4" />
                      <span>Enter Private Room ({roomCodeInput || 'ANON-777'})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Tab Content 3: Phantom AI Incognito Companion */}
              {activeTab === 'ai' && (
                <div className="space-y-6">
                  <div className="flex items-start gap-3 rounded-xl border border-purple-500/30 bg-purple-950/20 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-white">Phantom AI Incognito Partner</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Practice voice/video filters, have deep late-night philosophical conversations, or debate intriguing topics with a privacy-respecting AI companion powered by Gemini.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      id="start-ai-companion-btn"
                      onClick={onStartAiChat}
                      className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4 text-base font-bold text-white shadow-[0_0_25px_rgba(168,85,247,0.3)] hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <Bot className="h-5 w-5" />
                      <span>Connect with Phantom AI</span>
                    </button>
                    <p className="text-center text-[11px] text-slate-500">
                      Zero conversation history is logged. All responses run ephemeral on server.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Features Featurette Bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-center">
                <Tv className="h-4 w-4 mx-auto text-cyan-400 mb-1" />
                <h4 className="text-xs font-semibold text-slate-200">Screen Sharing</h4>
                <p className="text-[10px] text-slate-500">Share apps or browser tabs</p>
              </div>
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-center">
                <Radio className="h-4 w-4 mx-auto text-purple-400 mb-1" />
                <h4 className="text-xs font-semibold text-slate-200">Voice Shifter</h4>
                <p className="text-[10px] text-slate-500">Deep, robot & helium filters</p>
              </div>
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-center">
                <ShieldCheck className="h-4 w-4 mx-auto text-emerald-400 mb-1" />
                <h4 className="text-xs font-semibold text-slate-200">Ephemeral Chat</h4>
                <p className="text-[10px] text-slate-500">Self-destructing messages</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
};
