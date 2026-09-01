import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AnonymousUser, VoiceFilterType } from '../types';
import { getAvatarSvg } from '../utils/alias';
import {
  Send,
  Flame,
  Mic,
  Square,
  Sparkles,
  Smile,
  Image as ImageIcon,
  EyeOff,
  Eye,
  Trash2,
  Lock,
  Play,
  Pause,
  Clock,
} from 'lucide-react';

interface ChatPanelProps {
  currentUser: AnonymousUser;
  messages: ChatMessage[];
  isPeerTyping: boolean;
  activeVoiceFilter: VoiceFilterType;
  onSendMessage: (
    text?: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'audio' | 'voice_note',
    ephemeralSeconds?: number,
    spoiler?: boolean
  ) => void;
  onSendTyping: (isTyping: boolean) => void;
  onSendReaction: (emoji: string) => void;
}

const EPHEMERAL_OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '5s', seconds: 5 },
  { label: '10s', seconds: 10 },
  { label: '30s', seconds: 30 },
];

const REACTION_EMOJIS = ['🔥', '👻', '🎭', '⚡', '🎉', '💜', '🤫', '👀'];

export const ChatPanel: React.FC<ChatPanelProps> = ({
  currentUser,
  messages,
  isPeerTyping,
  activeVoiceFilter,
  onSendMessage,
  onSendTyping,
  onSendReaction,
}) => {
  const [inputText, setInputText] = useState('');
  const [ephemeralSecs, setEphemeralSecs] = useState<number>(0);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isLoadingIcebreaker, setIsLoadingIcebreaker] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPeerTyping]);

  // Handle typing debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onSendTyping(true);
  };

  const handleSendText = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText, undefined, undefined, ephemeralSecs, false);
    setInputText('');
    onSendTyping(false);
  };

  // Image Upload with optional spoiler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onSendMessage(undefined, dataUrl, 'image', ephemeralSecs, true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Voice Note Recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64Audio = reader.result as string;
          onSendMessage(undefined, base64Audio, 'voice_note', ephemeralSecs, false);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setRecordingDuration(0);

      recordTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.warn('Voice recording failed:', err);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecordingVoice) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    }
  };

  // Fetch AI Icebreaker Prompt
  const fetchIcebreaker = async () => {
    try {
      setIsLoadingIcebreaker(true);
      const res = await fetch('/api/ai/icebreaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'Deep anonymous conversation starters' }),
      });
      const data = await res.json();
      if (data.prompt) {
        setInputText(data.prompt);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingIcebreaker(false);
    }
  };

  const toggleSpoiler = (id: string) => {
    setRevealedSpoilers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className="flex flex-col h-full w-full sm:w-80 lg:w-96 border-l border-slate-800/80 bg-[#090b10] shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Encrypted Channel
          </span>
        </div>

        {/* Ephemeral Timer Selector */}
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800">
          <Flame className={`h-3 w-3 ${ephemeralSecs > 0 ? 'text-amber-400 fill-amber-400' : 'text-slate-500'}`} />
          {EPHEMERAL_OPTIONS.map((opt) => (
            <button
              key={opt.seconds}
              id={`ephemeral-opt-${opt.seconds}`}
              onClick={() => setEphemeralSecs(opt.seconds)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-all cursor-pointer ${
                ephemeralSecs === opt.seconds
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
            <div className="h-10 w-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              <Lock className="h-5 w-5 text-emerald-500/60" />
            </div>
            <p className="text-xs">End-to-end ephemeral session established. No chat logs are retained on any database.</p>
            
            {/* Quick Icebreaker button */}
            <button
              id="chat-empty-icebreaker-btn"
              onClick={fetchIcebreaker}
              disabled={isLoadingIcebreaker}
              className="flex items-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-950/30 px-3 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-900/40 transition-all cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isLoadingIcebreaker ? 'Generating...' : 'Get Conversation Starter'}</span>
            </button>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUser.id;
            const isRevealed = revealedSpoilers[msg.id];

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} space-y-1`}
              >
                {/* Sender alias & time */}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono px-1">
                  <span>{isSelf ? 'You' : msg.senderAlias}</span>
                  <span>•</span>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {msg.ephemeralSeconds ? (
                    <span className="flex items-center gap-0.5 text-amber-400 bg-amber-500/10 px-1 rounded">
                      <Flame className="h-2.5 w-2.5" /> {msg.ephemeralSeconds}s
                    </span>
                  ) : null}
                </div>

                {/* Message Bubble */}
                <div
                  className={`relative max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed break-words shadow-md ${
                    isSelf
                      ? 'bg-gradient-to-br from-emerald-600/90 to-teal-700/90 text-white rounded-tr-xs'
                      : 'bg-slate-800/90 text-slate-200 border border-slate-700/70 rounded-tl-xs'
                  }`}
                >
                  {/* Text Content */}
                  {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}

                  {/* Image Attachment with Blur Spoiler */}
                  {msg.mediaUrl && msg.mediaType === 'image' && (
                    <div className="relative rounded-lg overflow-hidden mt-1 max-w-full">
                      <img
                        src={msg.mediaUrl}
                        alt="Shared media"
                        referrerPolicy="no-referrer"
                        className={`w-full max-h-48 object-cover rounded-lg transition-all ${
                          msg.spoiler && !isRevealed ? 'filter blur-md scale-105 select-none' : ''
                        }`}
                      />
                      {msg.spoiler && !isRevealed && (
                        <button
                          onClick={() => toggleSpoiler(msg.id)}
                          className="absolute inset-0 m-auto h-8 w-28 flex items-center justify-center gap-1.5 rounded-full bg-slate-950/80 px-2 py-1 text-[11px] font-semibold text-white border border-slate-700 backdrop-blur-md cursor-pointer hover:bg-slate-900"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Tap to view</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Voice Note Player */}
                  {msg.mediaUrl && (msg.mediaType === 'voice_note' || msg.mediaType === 'audio') && (
                    <div className="flex items-center gap-2 mt-1 py-1">
                      <audio controls src={msg.mediaUrl} className="h-8 max-w-[200px]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Peer Typing Indicator */}
        {isPeerTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic px-2">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
            </span>
            <span>Stranger is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Reactions Bar */}
      <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-950/50 flex items-center gap-1.5 overflow-x-auto">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            id={`reaction-btn-${emoji}`}
            onClick={() => onSendReaction(emoji)}
            className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-sm hover:scale-110 active:scale-90 transition-transform cursor-pointer shrink-0 border border-slate-800"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950">
        {isRecordingVoice ? (
          <div className="flex items-center justify-between bg-rose-950/30 border border-rose-500/40 rounded-2xl p-2.5">
            <div className="flex items-center gap-2 text-xs text-rose-400 font-mono">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <span>Recording Voice Note ({recordingDuration}s)...</span>
            </div>
            <button
              id="stop-voice-rec-btn"
              onClick={stopVoiceRecording}
              className="flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-500 transition-colors cursor-pointer"
            >
              <Square className="h-3 w-3 fill-white" />
              <span>Send</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Image attachment button */}
            <button
              type="button"
              id="chat-attach-img-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Send anonymous image (with spoiler)"
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-cyan-400 transition-colors cursor-pointer shrink-0"
            >
              <ImageIcon className="h-4 w-4" />
            </button>

            {/* Voice note recorder button */}
            <button
              type="button"
              id="chat-record-voice-btn"
              onClick={startVoiceRecording}
              title="Record anonymous voice note"
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-purple-400 transition-colors cursor-pointer shrink-0"
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* Icebreaker Prompt Generator button */}
            <button
              type="button"
              id="chat-icebreaker-btn"
              onClick={fetchIcebreaker}
              disabled={isLoadingIcebreaker}
              title="Generate AI Icebreaker / Debate Question"
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-amber-400 transition-colors cursor-pointer shrink-0"
            >
              <Sparkles className="h-4 w-4" />
            </button>

            {/* Text input */}
            <input
              id="chat-input-text"
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Send anonymous message..."
              className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />

            {/* Send button */}
            <button
              type="submit"
              id="chat-submit-btn"
              disabled={!inputText.trim()}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 p-2 text-slate-950 font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0 shadow-md"
            >
              <Send className="h-4 w-4 fill-slate-950" />
            </button>
          </form>
        )}
      </div>
    </aside>
  );
};
