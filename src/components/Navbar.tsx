import React from 'react';
import { AnonymousUser } from '../types';
import { getAvatarSvg } from '../utils/alias';
import { Shield, Sparkles, RefreshCw, Volume2, Settings2, Music, Radio } from 'lucide-react';

interface NavbarProps {
  currentUser: AnonymousUser;
  onlineUsers: number;
  audioLevel: number;
  isInSession: boolean;
  onRegenerateAlias: () => void;
  onOpenSoundboard: () => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onlineUsers,
  audioLevel,
  isInSession,
  onRegenerateAlias,
  onOpenSoundboard,
  onOpenSettings,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#090b10]/90 backdrop-blur-md px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-cyan-500/20 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white sm:text-lg">INCOGNITO</span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                P2P ENCRYPTED
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{onlineUsers} anonymous online</span>
            </div>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Live Mic Wave Indicator */}
          {isInSession && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300">
              <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
              <div className="flex items-end gap-0.5 h-3">
                <div
                  className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(3, (audioLevel / 100) * 12)}px` }}
                />
                <div
                  className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(3, (audioLevel / 100) * 16)}px` }}
                />
                <div
                  className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                  style={{ height: `${Math.max(3, (audioLevel / 100) * 10)}px` }}
                />
              </div>
            </div>
          )}

          {/* Soundboard button */}
          <button
            id="soundboard-nav-btn"
            onClick={onOpenSoundboard}
            title="Open Soundboard & Instant FX"
            className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs font-medium text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
          >
            <Music className="h-4 w-4 text-purple-400" />
            <span className="hidden sm:inline">Soundboard</span>
          </button>

          {/* Current User Alias Pill */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 p-1.5 pr-3 shadow-inner">
            <div
              className="h-7 w-7 rounded-lg overflow-hidden shrink-0 border border-slate-700"
              dangerouslySetInnerHTML={{ __html: getAvatarSvg(currentUser.avatarSeed, currentUser.color) }}
            />
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-200 truncate max-w-[110px] sm:max-w-[140px]">
                {currentUser.alias}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Zero Logs</span>
            </div>
            {!isInSession && (
              <button
                id="regen-alias-btn"
                onClick={onRegenerateAlias}
                title="Generate new anonymous identity"
                className="ml-1 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Settings button */}
          <button
            id="settings-nav-btn"
            onClick={onOpenSettings}
            title="Privacy & Audio/Video Settings"
            className="rounded-xl border border-slate-800 bg-slate-900/80 p-2 text-slate-400 hover:border-slate-700 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
