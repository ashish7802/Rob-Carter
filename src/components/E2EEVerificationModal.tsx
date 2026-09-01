import React, { useState } from 'react';
import { E2EESecurityDetails } from '../types';
import { ShieldCheck, Lock, Check, Copy, Key, ServerOff, Radio } from 'lucide-react';

interface E2EEVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  details: E2EESecurityDetails | null;
}

export const E2EEVerificationModal: React.FC<E2EEVerificationModalProps> = ({
  isOpen,
  onClose,
  details,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !details) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `AnonMeet E2EE Safety Code: ${details.sixDigitCode} | Fingerprint: ${details.fingerprint}`
    );
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-3xl border border-[#3c4043] bg-[#202124] p-6 shadow-2xl space-y-6 text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#3c4043]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white font-['Google_Sans',sans-serif]">
                End-to-End Encryption
              </h3>
              <p className="text-xs text-emerald-400 font-medium">Verified & Active</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#9aa0a6] hover:text-white hover:bg-[#303134] transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 6-Digit Security Number & Visual SAS Emojis */}
        <div className="p-4 rounded-2xl bg-[#282a2d] border border-[#3c4043] space-y-3 text-center">
          <div className="text-xs text-[#9aa0a6] uppercase tracking-wider font-semibold">
            Security Verification Code
          </div>
          
          {/* Large digits */}
          <div className="text-3xl font-mono font-bold tracking-widest text-cyan-300">
            {details.sixDigitCode.slice(0, 3)} {details.sixDigitCode.slice(3)}
          </div>

          {/* Visual SAS Emojis */}
          <div className="flex items-center justify-center gap-3 pt-1 text-2xl">
            {details.sasEmojis.map((emoji, idx) => (
              <span
                key={idx}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#202124] border border-[#3c4043] shadow-inner"
              >
                {emoji}
              </span>
            ))}
          </div>

          <p className="text-[11px] text-[#9aa0a6] leading-relaxed pt-1">
            Compare this 6-digit code or symbols with the other person in this meeting to verify that no one is intercepting your call.
          </p>
        </div>

        {/* Cryptographic Details List */}
        <div className="space-y-2.5 text-xs text-[#9aa0a6]">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#282a2d] border border-[#3c4043]">
            <div className="flex items-center gap-2 text-slate-200">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span>Media Streams</span>
            </div>
            <span className="font-mono text-[11px] text-emerald-400 font-semibold">
              DTLS-SRTP (WebRTC)
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#282a2d] border border-[#3c4043]">
            <div className="flex items-center gap-2 text-slate-200">
              <Key className="h-4 w-4 text-cyan-400" />
              <span>Messages & Signaling</span>
            </div>
            <span className="font-mono text-[11px] text-cyan-300 font-semibold">
              AES-GCM 256-bit
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#282a2d] border border-[#3c4043]">
            <div className="flex items-center gap-2 text-slate-200">
              <ServerOff className="h-4 w-4 text-purple-400" />
              <span>Server Access</span>
            </div>
            <span className="font-mono text-[11px] text-purple-300 font-semibold">
              Zero Server Decryption
            </span>
          </div>
        </div>

        {/* SHA-256 Fingerprint */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-medium text-[#9aa0a6]">Cryptographic Fingerprint</div>
          <div className="p-2.5 rounded-xl bg-[#121418] border border-[#3c4043] font-mono text-[10px] text-slate-300 break-all select-all">
            {details.fingerprint}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#303134] hover:bg-[#3c4043] text-xs font-medium text-white transition-colors cursor-pointer"
          >
            {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            <span>{copiedCode ? 'Copied' : 'Copy verification info'}</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
