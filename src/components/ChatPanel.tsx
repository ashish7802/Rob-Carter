import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, AnonymousUser } from '../types';
import { Send, X, ShieldAlert, MessageSquare } from 'lucide-react';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  currentUser: AnonymousUser;
  onSendMessage: (text: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  currentUser,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  return (
    <aside className="w-full sm:w-80 md:w-96 flex flex-col h-full bg-[#202124] border-l border-[#3c4043] z-20 animate-in slide-in-from-right duration-200 shadow-2xl">
      {/* Drawer Header */}
      <div className="h-14 border-b border-[#3c4043] px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white font-['Google_Sans',sans-serif]">
            In-call messages
          </h2>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Ephemeral Notice Banner */}
      <div className="p-3 bg-[#282a2d] border-b border-[#3c4043] flex items-start gap-2 text-[11px] text-[#9aa0a6]">
        <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <span>
          Messages can only be seen by people in this call and are deleted permanently when the call ends.
        </span>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-[#9aa0a6] px-4">
            <MessageSquare className="h-8 w-8 text-[#5f6368] mb-2 stroke-1" />
            <p className="text-xs font-medium">No messages yet</p>
            <p className="text-[11px] text-[#5f6368] mt-1">
              Send a message to everyone in this call
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === currentUser.id || msg.senderAlias === currentUser.alias;
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={msg.id} className="space-y-1">
                <div className="flex items-baseline justify-between text-[11px]">
                  <span className={`font-semibold ${isSelf ? 'text-cyan-400' : 'text-slate-200'}`}>
                    {isSelf ? 'You' : msg.senderAlias}
                  </span>
                  <span className="text-[#9aa0a6] text-[10px]">{timeStr}</span>
                </div>
                <div className="rounded-2xl bg-[#282a2d] border border-[#3c4043] px-3 py-2 text-xs text-white break-words leading-relaxed">
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-3 border-t border-[#3c4043] bg-[#202124]">
        <div className="flex items-center gap-2 rounded-full border border-[#3c4043] bg-[#282a2d] px-3 py-1.5 focus-within:border-cyan-500 transition-colors">
          <input
            id="chat-input"
            type="text"
            placeholder="Send a message to everyone"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 bg-transparent text-xs text-white placeholder-[#9aa0a6] focus:outline-none"
            maxLength={1000}
          />
          <button
            id="chat-send-btn"
            type="submit"
            disabled={!inputText.trim()}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors cursor-pointer ${
              inputText.trim()
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                : 'text-[#5f6368] cursor-not-allowed'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </aside>
  );
};
