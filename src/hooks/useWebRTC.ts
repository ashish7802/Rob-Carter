import { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { VoiceFilterType, VideoFilterType } from '../types';
import { AudioProcessor } from '../utils/audioFilter';
import { VideoProcessor } from '../utils/videoFilter';

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
  const [activeVoiceFilter, setActiveVoiceFilter] = useState<VoiceFilterType>('none');
  const [activeVideoFilter, setActiveVideoFilter] = useState<VideoFilterType>('none');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const videoProcessorRef = useRef<VideoProcessor | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Audio level analyzer loop for visualizer
  const startAudioAnalyzer = useCallback((analyser: AnalyserNode) => {
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
  }, []);

  // Initialize Local Media Stream
  const initLocalStream = useCallback(async (videoDesired = true, audioDesired = true) => {
    try {
      setCameraError(null);
      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoDesired ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
          audio: audioDesired ? { echoCancellation: true, noiseSuppression: true } : false,
        });
      } catch (err: any) {
        console.warn('Could not get video+audio, trying audio only...', err);
        // Fallback to audio only if camera is unavailable or denied
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsVideoEnabled(false);
      }

      rawStreamRef.current = stream;

      // Initialize Audio Filter Processor
      const audioProc = new AudioProcessor();
      const { processedStream: processedAudioStream, analyser } = audioProc.init(stream);
      audioProcessorRef.current = audioProc;
      startAudioAnalyzer(analyser);

      // Initialize Video Filter Processor if video track exists
      let finalStream: MediaStream;
      if (stream.getVideoTracks().length > 0) {
        const videoProc = new VideoProcessor();
        const { processedStream: processedVideoStream } = videoProc.init(stream);
        videoProcessorRef.current = videoProc;

        // Combine processed audio & processed video into single stream
        const combinedTracks = [
          ...processedVideoStream.getVideoTracks(),
          ...processedAudioStream.getAudioTracks(),
        ];
        finalStream = new MediaStream(combinedTracks);
      } else {
        finalStream = processedAudioStream;
      }

      setLocalStream(finalStream);
      return finalStream;
    } catch (err: any) {
      console.error('Failed to get media devices:', err);
      setCameraError('Microphone or Camera access was denied or not found.');
      return null;
    }
  }, [startAudioAnalyzer]);

  // Set Voice Filter
  const changeVoiceFilter = useCallback((filter: VoiceFilterType) => {
    setActiveVoiceFilter(filter);
    if (audioProcessorRef.current) {
      audioProcessorRef.current.applyFilter(filter);
    }
  }, []);

  // Set Video Filter
  const changeVideoFilter = useCallback((filter: VideoFilterType) => {
    setActiveVideoFilter(filter);
    if (videoProcessorRef.current) {
      videoProcessorRef.current.setFilter(filter);
    }
  }, []);

  // Toggle Mic Audio
  const toggleAudio = useCallback(() => {
    if (rawStreamRef.current) {
      rawStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !isAudioEnabled;
      });
      setIsAudioEnabled(!isAudioEnabled);
      if (socket && roomId) {
        socket.emit('media:state_change', {
          audio: !isAudioEnabled,
          video: isVideoEnabled,
          screenShare: isScreenSharing,
        });
      }
    }
  }, [isAudioEnabled, isVideoEnabled, isScreenSharing, socket, roomId]);

  // Toggle Video Camera
  const toggleVideo = useCallback(async () => {
    if (rawStreamRef.current) {
      const tracks = rawStreamRef.current.getVideoTracks();
      if (tracks.length > 0) {
        const nextState = !isVideoEnabled;
        tracks.forEach((t) => {
          t.enabled = nextState;
        });
        setIsVideoEnabled(nextState);
        if (socket && roomId) {
          socket.emit('media:state_change', {
            audio: isAudioEnabled,
            video: nextState,
            screenShare: isScreenSharing,
          });
        }
      } else if (!isVideoEnabled) {
        // Attempt to request video track if not present initially
        try {
          const videoOnly = await navigator.mediaDevices.getUserMedia({ video: true });
          const newTrack = videoOnly.getVideoTracks()[0];
          rawStreamRef.current.addTrack(newTrack);

          if (!videoProcessorRef.current) {
            const videoProc = new VideoProcessor();
            const { processedStream } = videoProc.init(rawStreamRef.current);
            videoProcessorRef.current = videoProc;
            const procTrack = processedStream.getVideoTracks()[0];
            localStream?.addTrack(procTrack);

            if (pcRef.current && procTrack) {
              pcRef.current.addTrack(procTrack, localStream!);
            }
          }
          setIsVideoEnabled(true);
        } catch (e) {
          console.warn('Cannot enable camera:', e);
        }
      }
    }
  }, [isVideoEnabled, isAudioEnabled, isScreenSharing, localStream, socket, roomId]);

  // Toggle Screen Sharing
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      // Stop Screen Share
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);

      // Revert video sender to local video track if available
      if (pcRef.current && localStream) {
        const videoSender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
        const localVideoTrack = localStream.getVideoTracks()[0];
        if (videoSender && localVideoTrack) {
          videoSender.replaceTrack(localVideoTrack);
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
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as any,
          audio: true,
        });

        screenStreamRef.current = displayStream;
        setIsScreenSharing(true);

        const screenVideoTrack = displayStream.getVideoTracks()[0];

        // Replace video track in peer connection
        if (pcRef.current) {
          const videoSender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
          if (videoSender && screenVideoTrack) {
            videoSender.replaceTrack(screenVideoTrack);
          } else if (screenVideoTrack) {
            pcRef.current.addTrack(screenVideoTrack, displayStream);
          }
        }

        // When user clicks browser's native "Stop Sharing" floating button
        screenVideoTrack.onended = () => {
          setIsScreenSharing(false);
          if (pcRef.current && localStream) {
            const videoSender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
            const localVideoTrack = localStream.getVideoTracks()[0];
            if (videoSender && localVideoTrack) {
              videoSender.replaceTrack(localVideoTrack);
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
      } catch (err: any) {
        console.warn('Screen share cancelled or failed:', err);
      }
    }
  }, [isScreenSharing, localStream, socket, roomId, isAudioEnabled, isVideoEnabled]);

  // Establish WebRTC Connection
  const createPeerConnection = useCallback((currentLocalStream: MediaStream) => {
    if (pcRef.current) {
      pcRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    // Track remote stream
    const rStream = new MediaStream();
    setRemoteStream(rStream);

    pc.ontrack = (event) => {
      console.log('[WebRTC ontrack]:', event.track.kind);
      event.streams[0]?.getTracks().forEach((track) => {
        rStream.addTrack(track);
      });
      if (onRemoteStreamReady) {
        onRemoteStreamReady(rStream);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket && roomId) {
        socket.emit('signal:ice_candidate', {
          candidate: event.candidate,
          roomId,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC Connection State]:', pc.connectionState);
      setConnectionState(pc.connectionState);
    };

    // Add local tracks to peer connection
    currentLocalStream.getTracks().forEach((track) => {
      pc.addTrack(track, currentLocalStream);
    });

    return pc;
  }, [socket, roomId, onRemoteStreamReady]);

  // Signaling message listeners
  useEffect(() => {
    if (!socket || !roomId) return;

    const handleOffer = async (data: { sdp: RTCSessionDescriptionInit; senderId: string }) => {
      console.log('[WebRTC]: Received offer');
      let stream = localStream;
      if (!stream) {
        stream = await initLocalStream();
      }
      if (!stream) return;

      let pc = pcRef.current;
      if (!pc || pc.connectionState === 'closed') {
        pc = createPeerConnection(stream);
      }

      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('signal:answer', {
        sdp: answer,
        roomId,
      });
    };

    const handleAnswer = async (data: { sdp: RTCSessionDescriptionInit; senderId: string }) => {
      console.log('[WebRTC]: Received answer');
      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }
    };

    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      try {
        if (pcRef.current && data.candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (e) {
        console.warn('Error adding ICE candidate:', e);
      }
    };

    socket.on('signal:offer', handleOffer);
    socket.on('signal:answer', handleAnswer);
    socket.on('signal:ice_candidate', handleIceCandidate);

    return () => {
      socket.off('signal:offer', handleOffer);
      socket.off('signal:answer', handleAnswer);
      socket.off('signal:ice_candidate', handleIceCandidate);
    };
  }, [socket, roomId, localStream, initLocalStream, createPeerConnection]);

  // Initiate call if user is initiator
  const startCall = useCallback(async () => {
    let stream = localStream;
    if (!stream) {
      stream = await initLocalStream();
    }
    if (!stream || !socket || !roomId) return;

    const pc = createPeerConnection(stream);
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);

    socket.emit('signal:offer', {
      sdp: offer,
      roomId,
    });
  }, [localStream, socket, roomId, initLocalStream, createPeerConnection]);

  // Cleanup on leave/unmount
  const endCall = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    setRemoteStream(null);
    setConnectionState('new');
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioProcessorRef.current) {
        audioProcessorRef.current.destroy();
      }
      if (videoProcessorRef.current) {
        videoProcessorRef.current.destroy();
      }
      if (rawStreamRef.current) {
        rawStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      endCall();
    };
  }, [endCall]);

  return {
    localStream,
    remoteStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    activeVoiceFilter,
    activeVideoFilter,
    audioLevel,
    connectionState,
    cameraError,
    initLocalStream,
    changeVoiceFilter,
    changeVideoFilter,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    startCall,
    endCall,
  };
}
