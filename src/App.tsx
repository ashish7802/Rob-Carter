import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AnonymousUser, VoiceFilterType, VideoFilterType, PeerState, ChatMessage } from './types';
import { generateRandomAlias } from './utils/alias';
import { useSocket } from './hooks/useSocket';
import { useWebRTC } from './hooks/useWebRTC';
import { Navbar } from './components/Navbar';
import { Lobby } from './components/Lobby';
import { CallView } from './components/CallView';
import { ChatPanel } from './components/ChatPanel';
import { WhiteboardModal } from './components/WhiteboardModal';
import { SoundboardModal } from './components/SoundboardModal';
import { SettingsModal } from './components/SettingsModal';
import { MessageSquare, Video, ArrowLeft, ShieldAlert } from 'lucide-react';

export default function App() {
  // Current user anonymous profile
  const [currentUser, setCurrentUser] = useState<AnonymousUser>(() => {
    const initial = generateRandomAlias();
    return {
      id: '',
      alias: initial.alias,
      avatarSeed: initial.avatarSeed,
      color: initial.color,
      status: 'idle',
    };
  });

  const [activeMode, setActiveMode] = useState<'stranger' | 'custom_room' | 'ai'>('stranger');
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'video' | 'chat'>('video');
  const [aiCompanionMessages, setAiCompanionMessages] = useState<ChatMessage[]>([]);

  // Socket Hook
  const {
    socket,
    isConnected,
    onlineStats,
    isSearching,
    currentRoomId,
    currentRoomCode,
    isInitiator,
    peerState,
    messages: socketMessages,
    isPeerTyping,
    floatingReactions,
    whiteboardStrokes,
    updateProfile,
    startStrangerSearch,
    cancelStrangerSearch,
    skipStranger,
    joinCustomRoom,
    sendMessage,
    sendTyping,
    sendReaction,
    emitStroke,
    emitClearWhiteboard,
    leaveSession,
  } = useSocket({
    currentUser,
    onMatched: (peer, roomId, initiator) => {
      console.log('[App]: Matched with peer:', peer.alias, 'Initiator:', initiator);
      if (initiator) {
        // Start WebRTC call as initiator
        setTimeout(() => {
          webrtc.startCall();
        }, 500);
      }
    },
    onPeerDisconnected: (reason) => {
      webrtc.endCall();
    },
  });

  // WebRTC Hook
  const webrtc = useWebRTC({
    socket,
    roomId: currentRoomId,
    isInitiator,
  });

  // Pre-initialize local media preview on mount
  useEffect(() => {
    webrtc.initLocalStream(true, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Regenerate Alias
  const handleRegenerateAlias = () => {
    const fresh = generateRandomAlias();
    const updated = {
      ...currentUser,
      alias: fresh.alias,
      avatarSeed: fresh.avatarSeed,
      color: fresh.color,
    };
    setCurrentUser(updated);
    updateProfile(fresh.alias, fresh.avatarSeed);
  };

  const handleUpdateUser = (alias: string, avatarSeed: string, color: string) => {
    const updated = { ...currentUser, alias, avatarSeed, color };
    setCurrentUser(updated);
    updateProfile(alias, avatarSeed);
  };

  // Stranger Match Handlers
  const handleStartStrangerMatch = (interests: string[]) => {
    setActiveMode('stranger');
    startStrangerSearch(interests);
  };

  // Custom Room Handlers
  const handleJoinCustomRoom = (roomCode: string) => {
    setActiveMode('custom_room');
    joinCustomRoom(roomCode);
    setTimeout(() => {
      webrtc.startCall();
    }, 800);
  };

  // AI Incognito Companion Mode Handlers
  const handleStartAiCompanion = () => {
    setActiveMode('ai');
    const welcomeMsg: ChatMessage = {
      id: `ai_${Date.now()}`,
      senderId: 'ai-phantom',
      senderAlias: 'Phantom AI',
      senderAvatarSeed: 'phantom-ai-matrix',
      text: "Greetings, traveler of the dark web. I am Phantom AI, your anonymous conversation companion. What thoughts or secrets would you like to explore today?",
      timestamp: Date.now(),
    };
    setAiCompanionMessages([welcomeMsg]);
  };

  const handleSendAiMessage = async (
    text?: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'audio' | 'voice_note',
    ephemeralSeconds?: number
  ) => {
    if (!text?.trim() && !mediaUrl) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      senderId: currentUser.id || 'local-user',
      senderAlias: currentUser.alias,
      senderAvatarSeed: currentUser.avatarSeed,
      text,
      mediaUrl,
      mediaType,
      ephemeralSeconds,
      timestamp: Date.now(),
    };

    setAiCompanionMessages((prev) => [...prev, userMsg]);

    if (text?.trim()) {
      try {
        const res = await fetch('/api/ai/companion-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...aiCompanionMessages, userMsg].map((m) => ({
              sender: m.senderId === 'ai-phantom' ? 'model' : 'user',
              text: m.text || '',
            })),
            userAlias: currentUser.alias,
          }),
        });
        const data = await res.json();
        const aiMsg: ChatMessage = {
          id: `ai_${Date.now()}`,
          senderId: 'ai-phantom',
          senderAlias: 'Phantom AI',
          senderAvatarSeed: 'phantom-ai-matrix',
          text: data.reply || "Transmission received.",
          timestamp: Date.now(),
        };
        setAiCompanionMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleLeaveSession = () => {
    leaveSession();
    webrtc.endCall();
    setAiCompanionMessages([]);
  };

  const isInSession = !!currentRoomId || activeMode === 'ai';
  const displayMessages = activeMode === 'ai' ? aiCompanionMessages : socketMessages;

  return (
    <div className="flex flex-col min-h-screen bg-[#080a0f] text-slate-100 overflow-hidden font-sans">
      {/* Floating Reactions overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            className="absolute bottom-24 text-4xl sm:text-5xl animate-out fade-out slide-out-to-top-32 duration-1000 select-none"
            style={{
              left: `${35 + Math.random() * 30}%`,
              animationDuration: '2.5s',
            }}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      {/* Top Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        onlineUsers={onlineStats.onlineUsers}
        audioLevel={webrtc.audioLevel}
        isInSession={isInSession}
        onRegenerateAlias={handleRegenerateAlias}
        onOpenSoundboard={() => setIsSoundboardOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      {!isInSession ? (
        <Lobby
          currentUser={currentUser}
          isSearching={isSearching}
          localStream={webrtc.localStream}
          isAudioEnabled={webrtc.isAudioEnabled}
          isVideoEnabled={webrtc.isVideoEnabled}
          activeVoiceFilter={webrtc.activeVoiceFilter}
          activeVideoFilter={webrtc.activeVideoFilter}
          audioLevel={webrtc.audioLevel}
          onStartSearch={handleStartStrangerMatch}
          onCancelSearch={cancelStrangerSearch}
          onJoinCustomRoom={handleJoinCustomRoom}
          onStartAiChat={handleStartAiCompanion}
          onToggleAudio={webrtc.toggleAudio}
          onToggleVideo={webrtc.toggleVideo}
          onChangeVoiceFilter={webrtc.changeVoiceFilter}
          onChangeVideoFilter={webrtc.changeVideoFilter}
        />
      ) : (
        <div className="relative flex flex-col md:flex-row flex-1 h-[calc(100vh-65px)] overflow-hidden">
          {/* Mobile View Switcher Tab bar */}
          <div className="flex md:hidden items-center justify-around border-b border-slate-800 bg-slate-950 p-2 shrink-0">
            <button
              onClick={() => setMobileTab('video')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold ${
                mobileTab === 'video' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
              }`}
            >
              <Video className="h-4 w-4" />
              <span>Video & Call</span>
            </button>
            <button
              onClick={() => setMobileTab('chat')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold ${
                mobileTab === 'chat' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Chat ({displayMessages.length})</span>
            </button>
          </div>

          {/* Video / Call Stage Component */}
          <div
            className={`flex-1 h-full ${
              mobileTab === 'video' ? 'flex' : 'hidden md:flex'
            }`}
          >
            <CallView
              currentUser={currentUser}
              peerState={peerState}
              mode={activeMode}
              roomCode={currentRoomCode}
              localStream={webrtc.localStream}
              remoteStream={webrtc.remoteStream}
              isAudioEnabled={webrtc.isAudioEnabled}
              isVideoEnabled={webrtc.isVideoEnabled}
              isScreenSharing={webrtc.isScreenSharing}
              activeVoiceFilter={webrtc.activeVoiceFilter}
              activeVideoFilter={webrtc.activeVideoFilter}
              audioLevel={webrtc.audioLevel}
              isWhiteboardOpen={isWhiteboardOpen}
              onToggleAudio={webrtc.toggleAudio}
              onToggleVideo={webrtc.toggleVideo}
              onToggleScreenShare={webrtc.toggleScreenShare}
              onChangeVoiceFilter={webrtc.changeVoiceFilter}
              onChangeVideoFilter={webrtc.changeVideoFilter}
              onToggleWhiteboard={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
              onOpenSoundboard={() => setIsSoundboardOpen(true)}
              onNextStranger={skipStranger}
              onEndCall={handleLeaveSession}
            />
          </div>

          {/* Encrypted Anonymous Chat Panel */}
          <div
            className={`h-full ${
              mobileTab === 'chat' ? 'flex flex-1' : 'hidden md:flex'
            }`}
          >
            <ChatPanel
              currentUser={currentUser}
              messages={displayMessages}
              isPeerTyping={isPeerTyping}
              activeVoiceFilter={webrtc.activeVoiceFilter}
              onSendMessage={
                activeMode === 'ai' ? handleSendAiMessage : sendMessage
              }
              onSendTyping={sendTyping}
              onSendReaction={sendReaction}
            />
          </div>
        </div>
      )}

      {/* Real-time Collaborative Whiteboard Modal */}
      <WhiteboardModal
        isOpen={isWhiteboardOpen}
        strokes={whiteboardStrokes}
        onEmitStroke={emitStroke}
        onClearWhiteboard={emitClearWhiteboard}
        onClose={() => setIsWhiteboardOpen(false)}
      />

      {/* Real-time Soundboard Modal */}
      <SoundboardModal
        isOpen={isSoundboardOpen}
        onTriggerSound={(sound) => sendReaction(undefined, sound)}
        onClose={() => setIsSoundboardOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        currentUser={currentUser}
        onUpdateUser={handleUpdateUser}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
