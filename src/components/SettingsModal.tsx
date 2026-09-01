import React, { useState } from 'react';
import { AnonymousUser } from '../types';
import { getAvatarSvg, generateRandomAlias } from '../utils/alias';
import {
  Settings2,
  X,
  RefreshCw,
  ShieldCheck,
  Lock,
  Cpu,
  Eye,
  Sliders,
  Check,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  currentUser: AnonymousUser;
  onUpdateUser: (alias: string, avatarSeed: string, color: string) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  currentUser,
  onUpdateUser,
  onClose,
}) => {
  const [customAlias, setCustomAlias] = useState(currentUser.alias);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleRegenerate = () => {
    const generated = generateRandomAlias();
    setCustomAlias(generated.alias);
    onUpdateUser(generated.alias, generated.avatarSeed, generated.color);
  };

  const handleSaveAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (customAlias.trim()) {
      onUpdateUser(customAlias.trim(), currentUser.avatarSeed, currentUser.color);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-[#090b10] shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-300 border border-slate-700">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Anonymous Identity & Privacy</h3>
              <p className="text-[11px] text-slate-400">Manage your incognito persona and security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Identity Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Current Mask & Alias
            </label>
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
              <div
                className="h-12 w-12 rounded-xl overflow-hidden shadow-md border border-slate-700 shrink-0"
                dangerouslySetInnerHTML={{ __html: getAvatarSvg(currentUser.avatarSeed, currentUser.color) }}
              />
              <div className="flex-1">
                <input
                  id="settings-alias-input"
                  type="text"
                  value={customAlias}
                  onChange={(e) => setCustomAlias(e.target.value)}
                  maxLength={24}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-medium text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                id="settings-regen-btn"
                onClick={handleRegenerate}
                title="Randomize identity"
                className="rounded-lg border border-slate-800 bg-slate-800 p-2 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <button
            id="settings-save-alias-btn"
            onClick={handleSaveAlias}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-semibold text-slate-200 transition-colors cursor-pointer border border-slate-700"
          >
            {savedSuccess ? <Check className="h-4 w-4 text-emerald-400" /> : null}
            <span>{savedSuccess ? 'Alias Updated!' : 'Save Custom Alias'}</span>
          </button>

          {/* Privacy Protocol Checklist */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Privacy & Cryptographic Security Architecture</span>
            </h4>
            
            <div className="flex items-start gap-2 text-[11px] text-slate-400">
              <Lock className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong className="text-slate-300">P2P Direct WebRTC:</strong> Audio, Video & Screen Streams flow directly between browsers using STUN peer-to-peer tunnels.</span>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-slate-400">
              <Eye className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span><strong className="text-slate-300">Local Filter Pipeline:</strong> Privacy blur, pixelation, and voice pitch modification are computed strictly on your device GPU/WebAudio before stream transmission.</span>
            </div>

            <div className="flex items-start gap-2 text-[11px] text-slate-400">
              <Cpu className="h-3.5 w-3.5 text-purple-400 shrink-0 mt-0.5" />
              <span><strong className="text-slate-300">Zero Persistent Storage:</strong> No databases, no chat logs, no cookies, no tracking telemetry.</span>
            </div>
          </div>
        </div>

        {/* Close button */}
        <div className="mt-5">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
