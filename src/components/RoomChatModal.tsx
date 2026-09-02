import React, { useState, useEffect, useRef } from 'react';
import { AnonymousUser, ChatMessage, ChatAttachment } from '../types';
import {
  X,
  MessageSquare,
  Paperclip,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Mic,
  Square,
  Clock,
  Download,
  Eye,
  Loader2,
  Trash2,
  Send,
  Video,
  Lock,
  Search,
} from 'lucide-react';
import { MediaViewerModal } from './MediaViewerModal';

interface RoomChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AnonymousUser;
  onJoinVideoCall: (roomCode: string) => void;
}

export const RoomChatModal: React.FC<RoomChatModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onJoinVideoCall,
}) => {
  const [roomCode, setRoomCode] = useState('');
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeMedia, setActiveMedia] = useState<ChatAttachment | null>(null);

  // Audio recording
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const cancelledRecordingRef = useRef<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch room messages
  const fetchRoomMessages = async (code: string, isBackground = false) => {
    if (!code.trim()) return;
    if (!isBackground) setIsLoading(true);
    try {
      const res = await fetch(`/api/chat/history/${encodeURIComponent(code.trim().toUpperCase())}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
        setActiveRoomCode(code.trim().toUpperCase());
      }
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  // Auto-refresh chat messages every 4 seconds while modal is open
  useEffect(() => {
    if (!isOpen || !activeRoomCode) return;
    const interval = setInterval(() => {
      fetchRoomMessages(activeRoomCode, true);
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen, activeRoomCode]);

  useEffect(() => {
    if (activeRoomCode) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeRoomCode]);

  if (!isOpen) return null;

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      fetchRoomMessages(roomCode.trim());
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const removeSelectedFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Audio recording
  const startAudioRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.warn('Microphone access is not supported in this browser.');
        return;
      }
      cancelledRecordingRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        if (!cancelledRecordingRef.current && audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, {
            type: 'audio/webm',
          });
          setSelectedFiles((prev) => [...prev, audioFile]);
        }
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch (e) {
      console.warn('Microphone recording error:', e);
      setIsRecordingAudio(false);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      cancelledRecordingRef.current = false;
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      cancelledRecordingRef.current = true;
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // Send message via REST API
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoomCode || (!inputText.trim() && selectedFiles.length === 0)) return;

    let uploadedAttachments: ChatAttachment[] = [];

    if (selectedFiles.length > 0) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        selectedFiles.forEach((file) => formData.append('files', file));

        const res = await fetch('/api/chat/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          uploadedAttachments = data.attachments || [];
        }
      } catch (err) {
        console.error('Upload failed:', err);
      } finally {
        setIsUploading(false);
      }
    }

    const currentText = inputText.trim();
    setInputText('');
    setSelectedFiles([]);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: activeRoomCode,
          senderId: currentUser.id,
          senderAlias: currentUser.alias,
          senderAvatarSeed: currentUser.avatarSeed,
          text: currentText,
          attachments: uploadedAttachments,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
        }
      }
    } catch (err) {
      console.error('Failed to post message to room:', err);
    }

    // Refresh history
    fetchRoomMessages(activeRoomCode);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await fetch('/api/chat/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          emoji,
          userAlias: currentUser.alias,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
        );
      }
    } catch (err) {
      console.error('Failed to add reaction:', err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl h-[85vh] flex flex-col rounded-3xl border border-[#2d3139] bg-[#171a1f] shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="h-16 border-b border-[#2d3139] bg-[#121418] px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-['Google_Sans',sans-serif]">
                  Room Chat & File Hub
                </h3>
                <p className="text-[11px] text-[#9aa0a6] flex items-center gap-1">
                  <Clock className="h-3 w-3 text-amber-400" />
                  <span>30-Day Auto-Purge History • Share Files, Photos & Videos</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeRoomCode && (
                <button
                  onClick={() => onJoinVideoCall(activeRoomCode)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md transition-colors"
                >
                  <Video className="h-3.5 w-3.5" />
                  <span>Join Video Call</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-[#282d36] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Room Selector Bar */}
          <div className="p-3 bg-[#1e2229] border-b border-[#2d3139] flex items-center gap-3">
            <form onSubmit={handleLookup} className="flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter Room Code (e.g. abc-defg-hij)"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="w-full rounded-xl border border-[#3c4043] bg-[#121418] pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none font-mono uppercase"
                />
              </div>
              <button
                type="submit"
                disabled={!roomCode.trim() || isLoading}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Open Chat'}
              </button>
            </form>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#15171b]">
            {!activeRoomCode ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#9aa0a6]">
                <MessageSquare className="h-12 w-12 text-slate-600 mb-3" />
                <h4 className="text-sm font-semibold text-white">Enter a Room Code</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  View recent messages, photos, videos, and files shared in this room. All files auto-delete 30 days after posting.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#9aa0a6]">
                <Clock className="h-10 w-10 text-amber-400/60 mb-2" />
                <h4 className="text-sm font-semibold text-white">No active messages in room {activeRoomCode}</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Be the first to send a message or attach photos, videos, or documents!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isSelf =
                  msg.senderId === currentUser.id || msg.senderAlias === currentUser.alias;
                const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const expiryDate = new Date(msg.expiresAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div key={msg.id} className="space-y-1">
                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className={`font-semibold ${isSelf ? 'text-cyan-400' : 'text-slate-200'}`}>
                        {isSelf ? 'You' : msg.senderAlias}
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        exp {expiryDate} • {timeStr}
                      </span>
                    </div>

                    <div
                      className={`rounded-2xl border p-3 text-xs text-white break-words ${
                        isSelf ? 'bg-[#232832] border-[#363c48]' : 'bg-[#1c2027] border-[#2d3139]'
                      }`}
                    >
                      {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className={`space-y-2 ${msg.text ? 'mt-2 pt-2 border-t border-[#363c48]' : ''}`}>
                          {msg.attachments.map((att) => {
                            if (att.fileType === 'image') {
                              return (
                                <div
                                  key={att.id}
                                  onClick={() => setActiveMedia(att)}
                                  className="relative rounded-lg overflow-hidden border border-[#3c4043] cursor-pointer max-w-xs"
                                >
                                  <img
                                    src={att.url}
                                    alt={att.fileName}
                                    referrerPolicy="no-referrer"
                                    className="w-full max-h-40 object-cover"
                                  />
                                </div>
                              );
                            }

                            if (att.fileType === 'video') {
                              return (
                                <div key={att.id} className="max-w-sm rounded-lg overflow-hidden border border-[#3c4043]">
                                  <video controls src={att.url} className="w-full max-h-40 bg-black" />
                                </div>
                              );
                            }

                            return (
                              <div
                                key={att.id}
                                className="flex items-center justify-between p-2 rounded-xl bg-[#121418] border border-[#3c4043]"
                              >
                                <div className="flex items-center gap-2 truncate max-w-[200px]">
                                  <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                                  <span className="text-[11px] truncate">{att.fileName}</span>
                                </div>
                                <a
                                  href={att.url}
                                  download={att.fileName}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 rounded bg-[#282d36] text-slate-300 hover:text-white"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending files tray */}
          {selectedFiles.length > 0 && (
            <div className="p-2 bg-[#15171b] border-t border-[#2d3139] flex flex-wrap gap-2">
              {selectedFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 bg-[#242830] border border-[#3c4043] rounded-lg px-2 py-1 text-[11px] text-white"
                >
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <button onClick={() => removeSelectedFile(i)} className="text-slate-400 hover:text-rose-400">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input tray if room selected */}
          {activeRoomCode && (
            <form onSubmit={handleSend} className="p-3 border-t border-[#2d3139] bg-[#121418]">
              <div className="flex items-center gap-2 rounded-2xl border border-[#2d3139] bg-[#1e2229] px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach Files"
                  className="text-slate-400 hover:text-cyan-400"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                {!isRecordingAudio && (
                  <button
                    type="button"
                    onClick={startAudioRecording}
                    title="Voice Note"
                    className="text-slate-400 hover:text-emerald-400"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}

                {isRecordingAudio ? (
                  <div className="flex-1 flex items-center justify-between px-2 text-rose-400 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                      <span>REC {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={cancelAudioRecording}
                        className="text-slate-400 hover:text-rose-400 text-xs px-2 py-1 rounded"
                        title="Cancel recording"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={stopAudioRecording}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2.5 py-1 rounded-lg"
                        title="Attach voice note"
                      >
                        <Square className="h-3 w-3 fill-current" /> Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Send a message or media to this room..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
                    />

                    <button
                      type="submit"
                      disabled={!inputText.trim() && selectedFiles.length === 0}
                      className="h-7 w-7 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center disabled:opacity-40"
                    >
                      {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </button>
                  </>
                )}
              </div>
            </form>
          )}

          <input
            type="file"
            ref={fileInputRef}
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
          />
        </div>
      </div>

      <MediaViewerModal attachment={activeMedia} onClose={() => setActiveMedia(null)} />
    </>
  );
};
