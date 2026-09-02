import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, AnonymousUser, ChatAttachment } from '../types';
import {
  Send,
  X,
  ShieldCheck,
  MessageSquare,
  Lock,
  Radio,
  Paperclip,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  Mic,
  Square,
  Clock,
  Smile,
  Download,
  Eye,
  Loader2,
  Trash2,
} from 'lucide-react';
import { MediaViewerModal } from './MediaViewerModal';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentUser: AnonymousUser;
  onSendMessage: (text: string, attachments?: ChatAttachment[]) => void;
  typingPeers?: string[];
  onTyping?: (isTyping: boolean) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  roomCode?: string | null;
}

const COMMON_EMOJIS = ['❤️', '👍', '🔥', '😂', '🎉', '🔒'];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  currentUser,
  onSendMessage,
  typingPeers = [],
  onTyping,
  onReaction,
  roomCode,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeMedia, setActiveMedia] = useState<ChatAttachment | null>(null);

  // Audio Recording State
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, selectedFiles]);

  if (!isOpen) return null;

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (onTyping) {
      onTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false);
      }, 2000);
    }
  };

  // Handle file selection
  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setSelectedFiles((prev) => [...prev, ...fileArray]);
  };

  // Remove file from pending upload tray
  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  // Voice Note Recording
  const startAudioRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.warn('Microphone access is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice-note-${Date.now()}.webm`, {
          type: 'audio/webm',
        });
        setSelectedFiles((prev) => [...prev, audioFile]);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Failed to access microphone for recording:', err);
      setIsRecordingAudio(false);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      audioChunksRef.current = [];
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  // Upload files and send message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && selectedFiles.length === 0) return;

    let uploadedAttachments: ChatAttachment[] = [];

    if (selectedFiles.length > 0) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        selectedFiles.forEach((file) => {
          formData.append('files', file);
        });

        const res = await fetch('/api/chat/upload', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          uploadedAttachments = data.attachments || [];
        } else {
          console.error('File upload failed');
        }
      } catch (err) {
        console.error('Error uploading files:', err);
      } finally {
        setIsUploading(false);
      }
    }

    onSendMessage(inputText.trim(), uploadedAttachments);
    setInputText('');
    setSelectedFiles([]);
    if (onTyping) onTyping(false);
  };

  return (
    <>
      <aside
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="relative w-full sm:w-88 md:w-96 flex flex-col h-full bg-[#1b1e23] border-l border-[#2d3139] z-20 animate-in slide-in-from-right duration-200 shadow-2xl"
      >
        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-30 bg-cyan-950/80 backdrop-blur-sm border-2 border-dashed border-cyan-400 flex flex-col items-center justify-center text-center p-6 pointer-events-none">
            <Paperclip className="h-10 w-10 text-cyan-400 animate-bounce mb-2" />
            <p className="text-sm font-semibold text-white">Drop files here to attach</p>
            <p className="text-xs text-cyan-300 mt-1">Images, videos, audio, and documents (up to 50MB)</p>
          </div>
        )}

        {/* Header */}
        <div className="h-14 border-b border-[#2d3139] px-4 flex items-center justify-between bg-[#15171b]">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-cyan-400" />
            <div>
              <h2 className="text-sm font-semibold text-white font-['Google_Sans',sans-serif]">
                Room Chat
              </h2>
              {roomCode && (
                <span className="text-[10px] text-slate-400 font-mono">
                  Room: <span className="text-cyan-400">{roomCode}</span>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#9aa0a6] hover:text-white hover:bg-[#282d36] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 30-Day Auto-Purge & E2EE Notice Banner */}
        <div className="p-2.5 bg-[#171a1f] border-b border-[#2d3139] flex items-start gap-2.5 text-[11px] text-[#9aa0a6]">
          <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-semibold text-amber-400 flex items-center gap-1.5">
              <span>⏳ 30-Day Auto-Purge Active</span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/30 flex items-center gap-0.5 font-mono">
                <Lock className="h-2.5 w-2.5" /> E2EE
              </span>
            </div>
            <p className="leading-tight text-[10.5px] text-slate-400">
              All messages, images, videos, and files automatically and permanently delete 30 days after posting.
            </p>
          </div>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#9aa0a6] px-4 py-8">
              <div className="h-12 w-12 rounded-full bg-[#242830] flex items-center justify-center mb-3">
                <MessageSquare className="h-6 w-6 text-cyan-400" />
              </div>
              <p className="text-xs font-semibold text-white">No messages yet</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">
                Share text, images, videos, audio notes, and files with everyone in this room.
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
                <div key={msg.id} className="space-y-1 group">
                  {/* Sender & Timestamp Info */}
                  <div className="flex items-baseline justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold ${isSelf ? 'text-cyan-400' : 'text-slate-200'}`}>
                        {isSelf ? 'You' : msg.senderAlias}
                      </span>
                      {msg.isDirectP2P && (
                        <span className="flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                          <Radio className="h-2.5 w-2.5" /> P2P
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[#9aa0a6] text-[10px]">
                      <span className="text-slate-500" title={`Auto-purges on ${expiryDate}`}>
                        exp {expiryDate}
                      </span>
                      <span>•</span>
                      <span>{timeStr}</span>
                    </div>
                  </div>

                  {/* Message Bubble Container */}
                  <div
                    className={`rounded-2xl border px-3 py-2 text-xs text-white break-words leading-relaxed ${
                      isSelf
                        ? 'bg-[#232832] border-[#363c48]'
                        : 'bg-[#1c2027] border-[#2d3139]'
                    }`}
                  >
                    {/* Plaintext */}
                    {msg.text && (
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    )}

                    {/* Attachments Section */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className={`space-y-2 ${msg.text ? 'mt-2.5 pt-2 border-t border-[#363c48]' : ''}`}>
                        {msg.attachments.map((att) => {
                          const sizeStr =
                            att.fileSize < 1024 * 1024
                              ? `${(att.fileSize / 1024).toFixed(1)} KB`
                              : `${(att.fileSize / (1024 * 1024)).toFixed(1)} MB`;

                          if (att.fileType === 'image') {
                            return (
                              <div
                                key={att.id}
                                className="relative rounded-lg overflow-hidden border border-[#3c4043] bg-black/40 group/media cursor-pointer"
                                onClick={() => setActiveMedia(att)}
                              >
                                <img
                                  src={att.url}
                                  alt={att.fileName}
                                  className="w-full max-h-48 object-cover rounded-lg hover:scale-105 transition-transform duration-200"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <span className="flex items-center gap-1 text-[11px] font-medium bg-black/70 px-2.5 py-1 rounded-full text-white">
                                    <Eye className="h-3 w-3" /> View Photo
                                  </span>
                                </div>
                                <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[9px] text-slate-300 font-mono">
                                  {sizeStr}
                                </div>
                              </div>
                            );
                          }

                          if (att.fileType === 'video') {
                            return (
                              <div
                                key={att.id}
                                className="rounded-lg overflow-hidden border border-[#3c4043] bg-black/60"
                              >
                                <video
                                  controls
                                  preload="metadata"
                                  src={att.url}
                                  className="w-full max-h-48 rounded-t-lg bg-black"
                                />
                                <div className="p-2 flex items-center justify-between bg-[#15171b] text-[10px] text-slate-300">
                                  <div className="flex items-center gap-1 truncate max-w-[180px]">
                                    <Film className="h-3 w-3 text-purple-400 shrink-0" />
                                    <span className="truncate">{att.fileName}</span>
                                  </div>
                                  <span className="font-mono text-slate-400">{sizeStr}</span>
                                </div>
                              </div>
                            );
                          }

                          if (att.fileType === 'audio') {
                            return (
                              <div
                                key={att.id}
                                className="rounded-xl p-2.5 bg-[#15171b] border border-[#3c4043] space-y-1.5"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <div className="flex items-center gap-1.5 text-emerald-400">
                                    <Music className="h-3.5 w-3.5" />
                                    <span className="font-medium truncate max-w-[160px]">
                                      {att.fileName}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {sizeStr}
                                  </span>
                                </div>
                                <audio controls src={att.url} className="w-full h-8" />
                              </div>
                            );
                          }

                          // Documents & Generic Files
                          return (
                            <div
                              key={att.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-[#15171b] border border-[#3c4043] hover:border-cyan-500 transition-colors"
                            >
                              <div className="flex items-center gap-2 truncate max-w-[180px]">
                                <div className="h-8 w-8 rounded-lg bg-cyan-950/60 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <div className="truncate text-left">
                                  <p className="text-[11px] font-medium text-white truncate">
                                    {att.fileName}
                                  </p>
                                  <p className="text-[9px] text-slate-400 font-mono">{sizeStr}</p>
                                </div>
                              </div>
                              <a
                                href={att.url}
                                download={att.fileName}
                                target="_blank"
                                rel="noreferrer"
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#282d36] text-slate-300 hover:text-white hover:bg-cyan-600 transition-colors"
                                title="Download File"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Emoji Reactions Tray & Picker */}
                  <div className="flex items-center justify-between px-1">
                    {/* Existing reactions list */}
                    <div className="flex flex-wrap items-center gap-1">
                      {msg.reactions &&
                        Object.entries(msg.reactions).map(([emoji, rawList]) => {
                          const usersList = (rawList || []) as string[];
                          if (usersList.length === 0) return null;
                          const hasReacted = usersList.includes(currentUser.alias);
                          return (
                            <button
                              key={emoji}
                              onClick={() => onReaction && onReaction(msg.id, emoji)}
                              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                                hasReacted
                                  ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                                  : 'bg-[#15171b] border-[#2d3139] text-slate-300 hover:border-slate-500'
                              }`}
                              title={usersList.join(', ')}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] font-medium">{usersList.length}</span>
                            </button>
                          );
                        })}
                    </div>

                    {/* Quick Reaction buttons on hover */}
                    {onReaction && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-[#15171b] border border-[#2d3139] rounded-full px-1 py-0.5">
                        {COMMON_EMOJIS.slice(0, 4).map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => onReaction(msg.id, emoji)}
                            className="text-xs hover:scale-125 transition-transform p-0.5 cursor-pointer"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Indicator */}
          {typingPeers.length > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-cyan-400 italic animate-pulse px-1">
              <Smile className="h-3.5 w-3.5" />
              <span>{typingPeers.join(', ')} {typingPeers.length > 1 ? 'are' : 'is'} typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Selected Files Tray (Pending Upload) */}
        {selectedFiles.length > 0 && (
          <div className="p-2 bg-[#15171b] border-t border-[#2d3139] flex flex-wrap gap-2 max-h-28 overflow-y-auto">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 bg-[#242830] border border-[#3c4043] rounded-lg px-2 py-1 text-[11px] text-white"
              >
                {file.type.startsWith('image/') ? (
                  <ImageIcon className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                ) : file.type.startsWith('video/') ? (
                  <Film className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                ) : file.type.startsWith('audio/') ? (
                  <Music className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                )}
                <span className="truncate max-w-[110px]">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeSelectedFile(idx)}
                  className="text-slate-400 hover:text-rose-400 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Audio Recording Active Banner */}
        {isRecordingAudio && (
          <div className="p-2.5 bg-rose-950/80 border-t border-rose-800 flex items-center justify-between text-xs text-white animate-pulse">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-rose-500 animate-ping" />
              <span className="font-semibold text-rose-300">Recording Voice Note...</span>
              <span className="font-mono text-white">
                {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={cancelAudioRecording}
                className="p-1 rounded text-rose-300 hover:text-white"
                title="Cancel"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={stopAudioRecording}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs"
              >
                <Square className="h-3 w-3" />
                <span>Done</span>
              </button>
            </div>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          onChange={(e) => handleFileSelect(e.target.value ? e.target.files : null)}
          className="hidden"
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar,.xls,.xlsx,.csv,.ppt,.pptx,.json"
        />

        {/* Input & Action Bar */}
        <form onSubmit={handleSend} className="p-3 border-t border-[#2d3139] bg-[#15171b]">
          <div className="flex items-center gap-1.5 rounded-2xl border border-[#2d3139] bg-[#1e2229] px-2.5 py-1.5 focus-within:border-cyan-500 transition-colors">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach File, Image, Video, or Audio (Auto-deletes in 30 days)"
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-cyan-400 hover:bg-[#282d36] transition-colors cursor-pointer"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            {/* Voice Record Button */}
            {!isRecordingAudio && (
              <button
                type="button"
                onClick={startAudioRecording}
                title="Record Voice Note"
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-emerald-400 hover:bg-[#282d36] transition-colors cursor-pointer"
              >
                <Mic className="h-4 w-4" />
              </button>
            )}

            {/* Text Input */}
            <input
              id="chat-input"
              type="text"
              placeholder={isUploading ? 'Uploading files...' : 'Send message or drop files...'}
              value={inputText}
              onChange={handleInputChange}
              disabled={isUploading}
              className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
              maxLength={2000}
            />

            {/* Send Button */}
            <button
              id="chat-send-btn"
              type="submit"
              disabled={(!inputText.trim() && selectedFiles.length === 0) || isUploading}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors cursor-pointer ${
                (inputText.trim() || selectedFiles.length > 0) && !isUploading
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-950/40'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              {isUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </form>
      </aside>

      {/* Media Viewer Lightbox */}
      <MediaViewerModal attachment={activeMedia} onClose={() => setActiveMedia(null)} />
    </>
  );
};
