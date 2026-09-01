import React, { useState, useEffect, useRef } from 'react';
import { AnonymousUser } from '../types';
import { generateMeetCode, getRoomInviteUrl, copyToClipboard } from '../utils/invite';
import { RoomChatModal } from './RoomChatModal';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Keyboard,
  Plus,
  Link2,
  ShieldCheck,
  Lock,
  ArrowRight,
  Settings,
  Copy,
  Check,
  Share2,
  Sparkles,
  Info,
  RefreshCw,
  MessageSquare,
  Clock,
} from 'lucide-react';

interface LobbyProps {
  currentUser: AnonymousUser;
  localStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  audioLevel: number;
  invitedRoomCode?: string | null;
  onJoinRoom: (roomCode: string) => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onOpenSettings: () => void;
  onRegenerateUser: () => void;
  onUpdateAlias: (newAlias: string) => void;
}

export const Lobby: React.FC<LobbyProps> = ({
  currentUser,
  localStream,
  isAudioEnabled,
  isVideoEnabled,
  audioLevel,
  invitedRoomCode,
  onJoinRoom,
  onToggleAudio,
  onToggleVideo,
  onOpenSettings,
  onRegenerateUser,
  onUpdateAlias,
}) => {
  const [meetingInput, setMeetingInput] = useState(invitedRoomCode || '');
  const [showNewMeetingMenu, setShowNewMeetingMenu] = useState(false);
  const [createdLaterLink, setCreatedLaterLink] = useState<string | null>(null);
  const [copiedLaterLink, setCopiedLaterLink] = useState(false);
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState(currentUser.alias);
  const [isRoomChatOpen, setIsRoomChatOpen] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync invitedRoomCode
  useEffect(() => {
    if (invitedRoomCode) {
      setMeetingInput(invitedRoomCode);
    }
  }, [invitedRoomCode]);

  useEffect(() => {
    setAliasInput(currentUser.alias);
  }, [currentUser.alias]);

  // Attach local stream to video preview
  useEffect(() => {
    if (videoPreviewRef.current && localStream) {
      videoPreviewRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoEnabled]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNewMeetingMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartInstantMeeting = () => {
    const code = generateMeetCode();
    onJoinRoom(code);
  };

  const handleCreateMeetingForLater = () => {
    const code = generateMeetCode();
    const url = getRoomInviteUrl(code);
    setCreatedLaterLink(url);
    setShowNewMeetingMenu(false);
  };

  const handleJoinFromInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingInput.trim()) return;

    // Clean up input if user pasted a full URL or query param
    let cleanCode = meetingInput.trim();
    if (cleanCode.includes('?room=')) {
      cleanCode = cleanCode.split('?room=')[1].split('&')[0];
    } else if (cleanCode.includes('/room/')) {
      cleanCode = cleanCode.split('/room/')[1].split('?')[0];
    } else if (cleanCode.startsWith('http')) {
      const parts = cleanCode.split('/');
      cleanCode = parts[parts.length - 1];
    }

    onJoinRoom(cleanCode);
  };

  const handleCopyLaterLink = async () => {
    if (!createdLaterLink) return;
    const success = await copyToClipboard(createdLaterLink);
    if (success) {
      setCopiedLaterLink(true);
      setTimeout(() => setCopiedLaterLink(false), 2500);
    }
  };

  const handleSaveAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (aliasInput.trim()) {
      onUpdateAlias(aliasInput.trim());
    }
    setIsEditingAlias(false);
  };

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#121418] text-[#f1f3f4] flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* LEFT COLUMN: Actions & Info */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white font-['Google_Sans',sans-serif] leading-tight">
              Anonymous video calls. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                End-to-End Encrypted.
              </span>
            </h1>
            <p className="text-sm sm:text-base text-[#9aa0a6] max-w-lg leading-relaxed">
              Experience private video conferencing with direct peer-to-peer WebRTC encryption, instant 1-click invite links, and zero accounts.
            </p>
          </div>

          {/* Action Row: New Meeting & Join Input */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* New Meeting Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  id="new-meeting-btn"
                  onClick={() => setShowNewMeetingMenu(!showNewMeetingMenu)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full bg-cyan-600 hover:bg-cyan-500 active:scale-98 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-cyan-950/50 transition-all cursor-pointer"
                >
                  <Video className="h-4 w-4" />
                  <span>New meeting</span>
                </button>

                {showNewMeetingMenu && (
                  <div className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-[#3c4043] bg-[#202124] shadow-2xl p-2 z-40 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      id="start-instant-meeting-btn"
                      onClick={handleStartInstantMeeting}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-left text-[#e8eaed] hover:bg-[#303134] transition-colors cursor-pointer"
                    >
                      <Plus className="h-4 w-4 text-cyan-400" />
                      <div>
                        <div className="font-medium text-white">Start an instant meeting</div>
                        <div className="text-[11px] text-[#9aa0a6]">Get connected immediately</div>
                      </div>
                    </button>

                    <button
                      id="create-meeting-later-btn"
                      onClick={handleCreateMeetingForLater}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-left text-[#e8eaed] hover:bg-[#303134] transition-colors cursor-pointer mt-1"
                    >
                      <Link2 className="h-4 w-4 text-emerald-400" />
                      <div>
                        <div className="font-medium text-white">Create a meeting for later</div>
                        <div className="text-[11px] text-[#9aa0a6]">Get a shareable link to send</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Code or Link Input Form */}
              <form onSubmit={handleJoinFromInput} className="flex-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <Keyboard className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9aa0a6]" />
                  <input
                    id="meeting-code-input"
                    type="text"
                    placeholder="Enter a code or link"
                    value={meetingInput}
                    onChange={(e) => setMeetingInput(e.target.value)}
                    className="w-full rounded-full border border-[#3c4043] bg-[#1e2229] pl-10 pr-4 py-3 text-sm text-white placeholder-[#9aa0a6] focus:border-cyan-500 focus:outline-none transition-colors"
                  />
                </div>
                <button
                  id="join-meeting-btn"
                  type="submit"
                  disabled={!meetingInput.trim()}
                  className={`rounded-full px-5 py-3 text-sm font-medium transition-all cursor-pointer ${
                    meetingInput.trim()
                      ? 'text-cyan-400 hover:bg-cyan-500/10 font-semibold'
                      : 'text-[#5f6368] cursor-not-allowed'
                  }`}
                >
                  Join
                </button>
              </form>
            </div>

            {/* Room Chat & File Sharing Quick Button */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1e2229] border border-[#2d3139]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <span>Room Chat & File Hub</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                      30-Day Purge
                    </span>
                  </div>
                  <div className="text-[11px] text-[#9aa0a6]">
                    Share photos, videos, voice notes & files with room history
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsRoomChatOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#282d36] hover:bg-cyan-600 hover:text-white text-cyan-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Open Chat
              </button>
            </div>

            {/* Created Later Link Banner */}
            {createdLaterLink && (
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/30 p-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Here's your joining link</span>
                  </span>
                  <button
                    onClick={() => setCreatedLaterLink(null)}
                    className="text-xs text-[#9aa0a6] hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-[#3c4043] bg-[#121418] p-1.5">
                  <input
                    type="text"
                    readOnly
                    value={createdLaterLink}
                    className="flex-1 bg-transparent px-2.5 py-1 text-xs font-mono text-cyan-300 focus:outline-none select-all truncate"
                  />
                  <button
                    onClick={handleCopyLaterLink}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      copiedLaterLink ? 'bg-emerald-600 text-white' : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    }`}
                  >
                    {copiedLaterLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedLaterLink ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Invited Room Alert Card (if joined via invite link) */}
          {invitedRoomCode && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Link2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Meeting Invitation
                </div>
                <p className="text-xs text-[#e8eaed] mt-0.5">
                  You are invited to join meeting <strong className="font-mono text-cyan-300">{invitedRoomCode}</strong>. Check your camera & mic on the right and click <strong>Join now</strong> when you're ready.
                </p>
              </div>
            </div>
          )}

          {/* Security Features Bullet Points */}
          <div className="pt-4 border-t border-[#2d3139] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#9aa0a6]">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>Direct WebRTC P2P Encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
              <span>Zero logs, cookies, or trackers</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Green Room Video Preview Card */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full max-w-md space-y-4">
            
            {/* Live Camera View Box */}
            <div className="relative aspect-[16/10] w-full rounded-3xl border border-[#3c4043] bg-[#202124] overflow-hidden shadow-2xl flex items-center justify-center">
              {isVideoEnabled && localStream ? (
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="h-full w-full object-cover -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div
                    className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-slate-950 font-mono shadow-xl"
                    style={{ backgroundColor: currentUser.color || '#10b981' }}
                  >
                    {currentUser.alias.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-xs font-medium text-[#9aa0a6]">
                    Camera is off
                  </div>
                </div>
              )}

              {/* Audio Speaking Ring Overlay when mic is active */}
              {isAudioEnabled && audioLevel > 12 && (
                <div
                  className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-slate-950/80 px-2.5 py-1 text-[11px] text-emerald-400 backdrop-blur-md border border-emerald-500/30"
                >
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Speaking</span>
                </div>
              )}

              {/* Bottom Center Media Controls Pill */}
              <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-3 z-10">
                <button
                  id="preview-toggle-mic-btn"
                  onClick={onToggleAudio}
                  title={isAudioEnabled ? 'Turn off microphone' : 'Turn on microphone'}
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition-all cursor-pointer shadow-lg ${
                    isAudioEnabled
                      ? 'bg-[#3c4043] hover:bg-[#4a4e51] text-white'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                </button>

                <button
                  id="preview-toggle-camera-btn"
                  onClick={onToggleVideo}
                  title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
                  className={`flex h-11 w-11 items-center justify-center rounded-full transition-all cursor-pointer shadow-lg ${
                    isVideoEnabled
                      ? 'bg-[#3c4043] hover:bg-[#4a4e51] text-white'
                      : 'bg-rose-600 hover:bg-rose-500 text-white'
                  }`}
                >
                  {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </button>

                <button
                  id="preview-open-settings-btn"
                  onClick={onOpenSettings}
                  title="Device settings"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3c4043] hover:bg-[#4a4e51] text-white transition-all cursor-pointer shadow-lg"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Joining Identity & Quick Join CTA */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[#2d3139] bg-[#1e2229]">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-slate-950 font-mono shadow-inner"
                  style={{ backgroundColor: currentUser.color || '#10b981' }}
                >
                  {currentUser.alias.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-[11px] text-[#9aa0a6]">Joining as</div>
                  {isEditingAlias ? (
                    <form onSubmit={handleSaveAlias} className="flex items-center">
                      <input
                        type="text"
                        autoFocus
                        value={aliasInput}
                        onChange={(e) => setAliasInput(e.target.value)}
                        onBlur={handleSaveAlias}
                        className="w-32 bg-[#121418] text-xs font-medium text-white px-1.5 py-0.5 rounded border border-cyan-500 focus:outline-none"
                        maxLength={24}
                      />
                    </form>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsEditingAlias(true)}
                        className="text-xs font-bold text-white hover:text-cyan-400 transition-colors cursor-pointer text-left truncate max-w-[140px]"
                      >
                        {currentUser.alias}
                      </button>
                      <button
                        onClick={onRegenerateUser}
                        title="Randomize display name"
                        className="text-[#9aa0a6] hover:text-white transition-colors cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Ready to Join Action */}
              <button
                id="green-room-join-btn"
                onClick={() => onJoinRoom(meetingInput.trim() || generateMeetCode())}
                className="flex items-center gap-2 rounded-full bg-cyan-600 hover:bg-cyan-500 active:scale-95 px-5 py-2.5 text-xs font-semibold text-white shadow-md transition-all cursor-pointer"
              >
                <span>{invitedRoomCode ? 'Join now' : 'Start meeting'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Room Chat & File Hub Modal */}
      <RoomChatModal
        isOpen={isRoomChatOpen}
        onClose={() => setIsRoomChatOpen(false)}
        currentUser={currentUser}
        onJoinVideoCall={(code) => {
          setIsRoomChatOpen(false);
          onJoinRoom(code);
        }}
      />
    </main>
  );
};
