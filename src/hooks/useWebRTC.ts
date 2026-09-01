import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

interface UseWebRTCProps {
  socket: Socket | null;
  roomId: string | null;
  isInitiator: boolean;
  onRemoteStreamReady?: (stream: MediaStream) => void;
}

export function useWebRTC({ socket, roomId, isInitiator, onRemoteStreamReady }: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Available devices
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

  // Enumerate input and output devices
  const enumerateDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const aIn = devices.filter((d) => d.kind === 'audioinput');
      const vIn = devices.filter((d) => d.kind === 'videoinput');
      const aOut = devices.filter((d) => d.kind === 'audiooutput');

      setAudioInputs(aIn);
      setVideoInputs(vIn);
      setAudioOutputs(aOut);

      if (!selectedAudioInput && aIn.length > 0) setSelectedAudioInput(aIn[0].deviceId);
      if (!selectedVideoInput && vIn.length > 0) setSelectedVideoInput(vIn[0].deviceId);
      if (!selectedAudioOutput && aOut.length > 0) setSelectedAudioOutput(aOut[0].deviceId);
    } catch (err) {
      console.warn('Enumerate devices failed:', err);
    }
  }, [selectedAudioInput, selectedVideoInput, selectedAudioOutput]);

  // Audio level analyzer loop for Google Meet speaking wave rings
  const startAudioAnalyzer = useCallback((stream: MediaStream) => {
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 255) * 100)));
        }
        animFrameRef.current = requestAnimationFrame(checkLevel);
      };
      checkLevel();
    } catch (e) {
      console.warn('Audio analyzer error:', e);
    }
  }, []);

  // Initialize Local Media Stream
  const initLocalStream = useCallback(
    async (videoDesired = true, audioDesired = true, audioDeviceId?: string, videoDeviceId?: string) => {
      try {
        setCameraError(null);

        // Stop existing tracks if any
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        const constraints: MediaStreamConstraints = {
          video: videoDesired
            ? {
                deviceId: videoDeviceId ? { exact: videoDeviceId } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
              }
            : false,
          audio: audioDesired
            ? {
                deviceId: audioDeviceId ? { exact: audioDeviceId } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              }
            : false,
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err: any) {
          console.warn('Could not acquire full stream, attempting audio fallback...', err);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setIsVideoEnabled(false);
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        // Analyze audio for speaking activity
        startAudioAnalyzer(stream);

        // Re-enumerate devices to update labels
        enumerateDevices();

        return stream;
      } catch (err: any) {
        console.error('Failed to get user media:', err);
        setCameraError('Please allow camera & microphone permissions to join the call.');
        return null;
      }
    },
    [startAudioAnalyzer, enumerateDevices]
  );

  // Toggle Mic Audio
  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !isAudioEnabled;
      });
      const newState = !isAudioEnabled;
      setIsAudioEnabled(newState);
      if (socket && roomId) {
        socket.emit('media:state_change', {
          audio: newState,
          video: isVideoEnabled,
          screenShare: isScreenSharing,
        });
      }
    }
  }, [isAudioEnabled, isVideoEnabled, isScreenSharing, socket, roomId]);

  // Toggle Camera Video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !isVideoEnabled;
      });
      const newState = !isVideoEnabled;
      setIsVideoEnabled(newState);
      if (socket && roomId) {
        socket.emit('media:state_change', {
          audio: isAudioEnabled,
          video: newState,
          screenShare: isScreenSharing,
        });
      }
    }
  }, [isAudioEnabled, isVideoEnabled, isScreenSharing, socket, roomId]);

  // Toggle Screen Sharing (Present now)
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop Screen Share -> Revert to camera
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);

      if (localStreamRef.current && pcRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender && videoTrack) {
          videoSender.replaceTrack(videoTrack);
        }
      }

      if (socket && roomId) {
        socket.emit('media:state_change', {
          audio: isAudioEnabled,
          video: isVideoEnabled,
          screenShare: false,
        });
      }
    } else {
      // Start Screen Share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        const screenVideoTrack = screenStream.getVideoTracks()[0];

        // Replace track in peer connection
        if (pcRef.current) {
          const senders = pcRef.current.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender && screenVideoTrack) {
            videoSender.replaceTrack(screenVideoTrack);
          }
        }

        // Handle user stopping screen share via browser's native floating bar
        screenVideoTrack.onended = () => {
          setIsScreenSharing(false);
          if (localStreamRef.current && pcRef.current) {
            const cameraTrack = localStreamRef.current.getVideoTracks()[0];
            const senders = pcRef.current.getSenders();
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender && cameraTrack) {
              videoSender.replaceTrack(cameraTrack);
            }
          }
          if (socket && roomId) {
            socket.emit('media:state_change', {
              audio: isAudioEnabled,
              video: isVideoEnabled,
              screenShare: false,
            });
          }
        };

        if (socket && roomId) {
          socket.emit('media:state_change', {
            audio: isAudioEnabled,
            video: isVideoEnabled,
            screenShare: true,
          });
        }
      } catch (err) {
        console.warn('Screen share cancelled or denied:', err);
      }
    }
  }, [isScreenSharing, isAudioEnabled, isVideoEnabled, socket, roomId]);

  // Create RTCPeerConnection instance
  const createPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Attach local stream tracks
    const currentStream = localStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        pc.addTrack(track, currentStream);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        setRemoteStream(stream);
        if (onRemoteStreamReady) onRemoteStreamReady(stream);
      }
    };

    // Send local ICE candidates to peer via socket
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && roomId) {
        socket.emit('signal:ice_candidate', {
          candidate: event.candidate,
          roomId,
        });
      }
    };

    // Monitor connection states
    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    return pc;
  }, [socket, roomId, onRemoteStreamReady]);

  // Start Call (Initiate Offer)
  const startCall = useCallback(async () => {
    if (!socket || !roomId) return;
    const pc = createPeerConnection();

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      socket.emit('signal:offer', {
        sdp: pc.localDescription,
        roomId,
      });
    } catch (err) {
      console.error('Failed to create WebRTC offer:', err);
    }
  }, [socket, roomId, createPeerConnection]);

  // Handle incoming Offer
  const handleReceiveOffer = useCallback(
    async (sdp: RTCSessionDescriptionInit) => {
      if (!socket || !roomId) return;
      const pc = createPeerConnection();

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Process buffered ICE candidates
        while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift();
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('signal:answer', {
          sdp: pc.localDescription,
          roomId,
        });
      } catch (err) {
        console.error('Failed to handle incoming WebRTC offer:', err);
      }
    },
    [socket, roomId, createPeerConnection]
  );

  // Handle incoming Answer
  const handleReceiveAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    if (!pcRef.current) return;
    try {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));

      // Process buffered ICE candidates
      while (iceCandidatesQueue.current.length > 0) {
        const candidate = iceCandidatesQueue.current.shift();
        if (candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    } catch (err) {
      console.error('Failed to handle incoming WebRTC answer:', err);
    }
  }, []);

  // Handle incoming ICE Candidate
  const handleReceiveCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = pcRef.current;
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding received ICE candidate:', err);
      }
    } else {
      iceCandidatesQueue.current.push(candidate);
    }
  }, []);

  // Socket Signaling Event Listeners
  useEffect(() => {
    if (!socket) return;

    const onOffer = (data: { sdp: RTCSessionDescriptionInit }) => {
      handleReceiveOffer(data.sdp);
    };

    const onAnswer = (data: { sdp: RTCSessionDescriptionInit }) => {
      handleReceiveAnswer(data.sdp);
    };

    const onIceCandidate = (data: { candidate: RTCIceCandidateInit }) => {
      handleReceiveCandidate(data.candidate);
    };

    socket.on('signal:offer', onOffer);
    socket.on('signal:answer', onAnswer);
    socket.on('signal:ice_candidate', onIceCandidate);

    return () => {
      socket.off('signal:offer', onOffer);
      socket.off('signal:answer', onAnswer);
      socket.off('signal:ice_candidate', onIceCandidate);
    };
  }, [socket, handleReceiveOffer, handleReceiveAnswer, handleReceiveCandidate]);

  // End Call & Cleanup
  const endCall = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setRemoteStream(null);
    setIsScreenSharing(false);
    setConnectionState('closed');
    iceCandidatesQueue.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, []);

  return {
    localStream,
    remoteStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    audioLevel,
    connectionState,
    cameraError,
    audioInputs,
    videoInputs,
    audioOutputs,
    selectedAudioInput,
    selectedVideoInput,
    selectedAudioOutput,
    setSelectedAudioInput,
    setSelectedVideoInput,
    setSelectedAudioOutput,
    initLocalStream,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    startCall,
    endCall,
    enumerateDevices,
  };
}
