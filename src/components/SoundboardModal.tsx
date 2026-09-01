import React from 'react';
import { soundFx } from '../utils/soundEffects';
import {
  Music,
  X,
  Volume2,
  Sparkles,
  Zap,
  Radio,
  Flame,
} from 'lucide-react';

interface SoundboardModalProps {
  isOpen: boolean;
  onTriggerSound: (soundId: string) => void;
  onClose: () => void;
}

const SOUNDS = [
  { id: 'applause', label: 'Applause & Cheers', icon: '👏', desc: 'Crowd clapping burst' },
  { id: 'drumroll', label: 'Drum Roll', icon: '🥁', desc: 'Suspenseful snare crescendo' },
  { id: 'mystery', label: 'Mystery Chime', icon: '🔮', desc: 'Enigmatic synthesizer chord' },
  { id: 'laser', label: 'Cyber Laser', icon: '⚡', desc: 'Sci-fi energy beam' },
  { id: 'buzzer', label: 'Wrong Buzzer', icon: '❌', desc: 'Loud game show fail buzz' },
  { id: 'robot', label: 'Glitch Laugh', icon: '🤖', desc: '8-bit robotic arpeggio' },
];

export const SoundboardModal: React.FC<SoundboardModalProps> = ({
  isOpen,
  onTriggerSound,
  onClose,
}) => {
  if (!isOpen) return null;

  const handlePlay = (soundId: string) => {
    soundFx.playSoundboard(soundId);
    onTriggerSound(soundId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-[#090b10] shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Music className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Incognito Soundboard</h3>
              <p className="text-[11px] text-slate-400">Play real-time synthesized FX for both peers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Sound Buttons Grid */}
        <div className="grid grid-cols-2 gap-3">
          {SOUNDS.map((s) => (
            <button
              key={s.id}
              id={`soundboard-trigger-${s.id}`}
              onClick={() => handlePlay(s.id)}
              className="flex flex-col items-start p-3.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:border-purple-500/50 hover:bg-purple-950/20 active:scale-95 transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <span className="text-xl group-hover:scale-125 transition-transform">{s.icon}</span>
                <Volume2 className="h-3.5 w-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
              </div>
              <span className="text-xs font-semibold text-slate-200 group-hover:text-purple-300">
                {s.label}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">{s.desc}</span>
            </button>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span>Synthesized in real-time</span>
          <span className="text-purple-400 font-mono">0 KB Bandwidth</span>
        </div>
      </div>
    </div>
  );
};
