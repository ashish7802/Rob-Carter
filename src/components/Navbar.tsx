import React, { useState, useEffect } from 'react';
import { AnonymousUser } from '../types';
import { ShieldCheck, Video, Settings, User, RefreshCw, Lock } from 'lucide-react';

interface NavbarProps {
  currentUser: AnonymousUser;
  isInCall: boolean;
  onOpenSettings: () => void;
  onRegenerateUser: () => void;
  onUpdateAlias: (newAlias: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  isInCall,
  onOpenSettings,
  onRegenerateUser,
  onUpdateAlias,
}) => {
  const [timeString, setTimeString] = useState('');
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState(currentUser.alias);

  useEffect(() => {
    setAliasInput(currentUser.alias);
  }, [currentUser.alias]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }) +
          ' • ' +
          now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveAlias = (e: React.FormEvent) => {
    e.preventDefault();
    if (aliasInput.trim()) {
      onUpdateAlias(aliasInput.trim());
    }
    setIsEditingAlias(false);
  };

  return (
    <header className="h-16 border-b border-[#2d3139] bg-[#121418] px-4 sm:px-6 flex items-center justify-between select-none z-30">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 text-white shadow-md shadow-cyan-950/40">
          <Video className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white font-['Google_Sans',sans-serif]">
              AnonMeet
            </span>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
              <Lock className="h-3 w-3" />
              <span>E2EE</span>
            </span>
          </div>
          <p className="text-[11px] text-[#9aa0a6] hidden sm:block">
            Anonymous & End-to-End Encrypted Video Meetings
          </p>
        </div>
      </div>

      {/* Center / Right: Time & User Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Real-time Clock */}
        <div className="text-xs text-[#9aa0a6] font-medium hidden md:block">
          {timeString}
        </div>

        {/* E2EE Info Pill */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-[#1e2229] px-3 py-1 text-xs text-[#9aa0a6] border border-[#2d3139]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Zero Accounts • Direct P2P</span>
        </div>

        {/* Device Settings Button */}
        <button
          id="navbar-settings-btn"
          onClick={onOpenSettings}
          title="Audio & Video Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e2229] text-[#9aa0a6] hover:text-white hover:bg-[#282d36] transition-colors cursor-pointer border border-[#2d3139]"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* Anonymous Profile Pill */}
        <div className="flex items-center gap-2 rounded-full bg-[#1e2229] p-1 sm:pr-3 border border-[#2d3139]">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-slate-950 font-mono shadow-inner"
            style={{ backgroundColor: currentUser.color || '#10b981' }}
          >
            {currentUser.alias.charAt(0).toUpperCase()}
          </div>

          {isEditingAlias ? (
            <form onSubmit={handleSaveAlias} className="flex items-center">
              <input
                type="text"
                autoFocus
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onBlur={handleSaveAlias}
                className="w-28 bg-[#121418] text-xs font-medium text-white px-1.5 py-0.5 rounded border border-cyan-500 focus:outline-none"
                maxLength={24}
              />
            </form>
          ) : (
            <button
              onClick={() => setIsEditingAlias(true)}
              title="Click to rename your anonymous alias"
              className="text-xs font-medium text-slate-200 hover:text-cyan-400 transition-colors hidden sm:block truncate max-w-[120px] cursor-pointer text-left"
            >
              {currentUser.alias}
            </button>
          )}

          {!isInCall && (
            <button
              id="navbar-regenerate-alias-btn"
              onClick={onRegenerateUser}
              title="Generate new random anonymous alias"
              className="text-[#9aa0a6] hover:text-white transition-colors cursor-pointer ml-0.5 p-1 rounded-full hover:bg-[#282d36]"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
