import React, { useState } from 'react';
import { getRoomInviteUrl, copyToClipboard } from '../utils/invite';
import {
  Link2,
  Copy,
  Check,
  Share2,
  X,
  Lock,
  ShieldCheck,
  Send,
  MessageCircle,
} from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  roomCode: string;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  roomCode,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const inviteUrl = getRoomInviteUrl(roomCode);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    const success = await copyToClipboard(inviteUrl);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my meeting - ${roomCode}`,
          text: `Join my anonymous encrypted video meeting (Room: ${roomCode}). No account required:`,
          url: inviteUrl,
        });
      } catch (err) {
        // Ignored
      }
    } else {
      handleCopyLink();
    }
  };

  const shareText = encodeURIComponent(
    `Join my anonymous E2EE video meeting (${roomCode}). Zero accounts, direct P2P: ${inviteUrl}`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-[#3c4043] bg-[#202124] shadow-2xl p-6 text-[#e8eaed]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#3c4043] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white font-['Google_Sans',sans-serif]">
                Here's your meeting link
              </h3>
              <p className="text-xs text-[#9aa0a6]">
                Copy this link and send it to people you want to meet with
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#303134] text-[#9aa0a6] hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Copy Box */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-1.5 rounded-xl border border-[#3c4043] bg-[#282a2d]">
            <input
              id="invite-modal-url-input"
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 bg-transparent px-3 py-1.5 text-xs font-mono text-cyan-300 select-all focus:outline-none truncate"
            />
            <button
              id="invite-modal-copy-btn"
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-all cursor-pointer ${
                copiedLink
                  ? 'bg-emerald-600 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
              }`}
            >
              {copiedLink ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Quick Sharing options */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleNativeShare}
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-[#3c4043] bg-[#282a2d] text-xs font-medium text-[#e8eaed] hover:bg-[#303134] transition-colors cursor-pointer"
            >
              <Share2 className="h-3.5 w-3.5 text-cyan-400" />
              <span>Share</span>
            </button>

            <a
              href={`https://api.whatsapp.com/send?text=${shareText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-[#3c4043] bg-[#282a2d] text-xs font-medium text-[#e8eaed] hover:bg-[#303134] transition-colors cursor-pointer"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
              <span>WhatsApp</span>
            </a>

            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(`Join my video meeting (${roomCode})`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-[#3c4043] bg-[#282a2d] text-xs font-medium text-[#e8eaed] hover:bg-[#303134] transition-colors cursor-pointer"
            >
              <Send className="h-3.5 w-3.5 text-blue-400" />
              <span>Telegram</span>
            </a>
          </div>

          {/* Security Note */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-start gap-2.5 text-xs text-[#9aa0a6]">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-emerald-300">Direct WebRTC E2EE:</span> Your video and voice call are directly encrypted between peers. No meeting history or recordings are saved.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full bg-[#303134] hover:bg-[#3c4043] px-5 py-2 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
