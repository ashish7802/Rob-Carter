import React, { useState, useEffect, useCallback } from 'react';
import { AnonymousUser } from './types';
import { generateRandomAlias } from './utils/alias';
import { parseRoomFromUrl, updateUrlWithRoom } from './utils/invite';
import { useSocket } from './hooks/useSocket';
import { useWebRTC } from './hooks/useWebRTC';
import { Navbar } from './components/Navbar';
import { Lobby } from './components/Lobby';
import { CallView } from './components/CallView';
import { SettingsModal } from './components/SettingsModal';
import { InviteModal } from './components/InviteModal';

export const App: React.FC = () => {
  // Anonymous Identity
  const [currentUser, setCurrentUser] = useState<AnonymousUser>(() => {
    const saved = localStorage.getItem('anon_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    const initial = generateRandomAlias();
    const user: AnonymousUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      alias: initial.alias,
      avatarSeed: initial.avatarSeed,
      color: initial.color,
    };
    localStorage.setItem('anon_user', JSON.stringify(user));
    return user;
  });

  const [invitedRoomCode, setInvitedRoomCode] = useState<string | null>(() => parseRoomFromUrl());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // WebRTC remote stream handler callback
  const handleRemoteStream = useCallback((stream: MediaStream) => {
    console.log('[WebRTC Remote Stream Ready]:', stream.id);
  }, []);

  // Socket signaling hook with E2EE crypto support
  const {
    socket,
    isConnected,
    currentRoomId,
    currentRoomCode,
    isInitiator,
    peerState,
    messages,
    e2eeDetails,
    joinCustomRoom,
    sendMessage,
    handleP2PMessage,
    toggleHandRaise,
    leaveSession,
  } = useSocket({
    currentUser,
    onMatched: (peer, roomId, initiator) => {
      console.log('[Room Peer Connected]:', peer.alias, 'initiator:', initiator);
      if (initiator) {
        setTimeout(() => {
          webrtc.startCall();
        }, 400);
      }
    },
    onPeerDisconnected: (reason) => {
      console.log('[Peer Disconnected]:', reason);
      webrtc.endCall();
    },
  });

  // WebRTC Media, DataChannel & Calling hook
  const webrtc = useWebRTC({
    socket,
    roomId: currentRoomId,
    isInitiator,
    onRemoteStreamReady: handleRemoteStream,
    onDataChannelMessage: (msg) => {
      if (msg && msg.text) {
        handleP2PMessage(msg);
      }
    },
  });

  // Listen to URL changes for room invites
  useEffect(() => {
    const handlePopState = () => {
      const room = parseRoomFromUrl();
      if (room) {
        setInvitedRoomCode(room);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Pre-initialize local media preview on app mount
  useEffect(() => {
    webrtc.initLocalStream(true, true);
    webrtc.enumerateDevices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Regenerate random pseudonym
  const handleRegenerateUser = () => {
    const fresh = generateRandomAlias();
    const updated: AnonymousUser = {
      ...currentUser,
      alias: fresh.alias,
      avatarSeed: fresh.avatarSeed,
      color: fresh.color,
    };
    setCurrentUser(updated);
    localStorage.setItem('anon_user', JSON.stringify(updated));
    if (socket && isConnected) {
      socket.emit('user:register', {
        alias: updated.alias,
        avatarSeed: updated.avatarSeed,
      });
    }
  };

  // Rename alias
  const handleUpdateAlias = (newAlias: string) => {
    const updated: AnonymousUser = {
      ...currentUser,
      alias: newAlias,
    };
    setCurrentUser(updated);
    localStorage.setItem('anon_user', JSON.stringify(updated));
    if (socket && isConnected) {
      socket.emit('user:register', {
        alias: updated.alias,
        avatarSeed: updated.avatarSeed,
      });
    }
  };

  // Join or Start Meeting Room
  const handleJoinMeeting = (roomCode: string) => {
    const cleanCode = roomCode.trim().toLowerCase();
    updateUrlWithRoom(cleanCode);
    joinCustomRoom(cleanCode);
  };

  // Leave Active Call
  const handleLeaveCall = () => {
    leaveSession();
    webrtc.endCall();
    updateUrlWithRoom(null);
    setInvitedRoomCode(null);
  };

  const isInCall = !!currentRoomId;

  return (
    <div className="min-h-screen bg-[#121418] text-[#f1f3f4] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        isInCall={isInCall}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onRegenerateUser={handleRegenerateUser}
        onUpdateAlias={handleUpdateAlias}
      />

      {/* Main View: Lobby / Green Room vs Active Video Call */}
      {isInCall ? (
        <CallView
          currentUser={currentUser}
          peerState={peerState}
          localStream={webrtc.localStream}
          remoteStream={webrtc.remoteStream}
          isAudioEnabled={webrtc.isAudioEnabled}
          isVideoEnabled={webrtc.isVideoEnabled}
          isScreenSharing={webrtc.isScreenSharing}
          isDataChannelOpen={webrtc.isDataChannelOpen}
          audioLevel={webrtc.audioLevel}
          roomCode={currentRoomCode || 'MEETING'}
          messages={messages}
          e2eeDetails={e2eeDetails}
          onToggleAudio={webrtc.toggleAudio}
          onToggleVideo={webrtc.toggleVideo}
          onToggleScreenShare={webrtc.toggleScreenShare}
          onSendMessage={sendMessage}
          onToggleHandRaise={toggleHandRaise}
          onLeaveCall={handleLeaveCall}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      ) : (
        <Lobby
          currentUser={currentUser}
          localStream={webrtc.localStream}
          isAudioEnabled={webrtc.isAudioEnabled}
          isVideoEnabled={webrtc.isVideoEnabled}
          audioLevel={webrtc.audioLevel}
          invitedRoomCode={invitedRoomCode}
          onJoinRoom={handleJoinMeeting}
          onToggleAudio={webrtc.toggleAudio}
          onToggleVideo={webrtc.toggleVideo}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onRegenerateUser={handleRegenerateUser}
          onUpdateAlias={handleUpdateAlias}
        />
      )}

      {/* Audio & Video Device Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        audioInputs={webrtc.audioInputs}
        videoInputs={webrtc.videoInputs}
        audioOutputs={webrtc.audioOutputs}
        selectedAudioInput={webrtc.selectedAudioInput}
        selectedVideoInput={webrtc.selectedVideoInput}
        selectedAudioOutput={webrtc.selectedAudioOutput}
        onSelectAudioInput={(deviceId) => {
          webrtc.setSelectedAudioInput(deviceId);
          webrtc.initLocalStream(webrtc.isVideoEnabled, webrtc.isAudioEnabled, deviceId, webrtc.selectedVideoInput);
        }}
        onSelectVideoInput={(deviceId) => {
          webrtc.setSelectedVideoInput(deviceId);
          webrtc.initLocalStream(webrtc.isVideoEnabled, webrtc.isAudioEnabled, webrtc.selectedAudioInput, deviceId);
        }}
        onSelectAudioOutput={webrtc.setSelectedAudioOutput}
        audioLevel={webrtc.audioLevel}
      />

      {/* Invite Share Modal */}
      {currentRoomCode && (
        <InviteModal
          isOpen={isInviteModalOpen}
          roomCode={currentRoomCode}
          onClose={() => setIsInviteModalOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
