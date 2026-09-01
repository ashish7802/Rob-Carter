import React from 'react';
import { X, Mic, Video, Volume2, ShieldCheck, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  selectedAudioInput: string;
  selectedVideoInput: string;
  selectedAudioOutput: string;
  onSelectAudioInput: (deviceId: string) => void;
  onSelectVideoInput: (deviceId: string) => void;
  onSelectAudioOutput: (deviceId: string) => void;
  audioLevel: number;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  audioInputs,
  videoInputs,
  audioOutputs,
  selectedAudioInput,
  selectedVideoInput,
  selectedAudioOutput,
  onSelectAudioInput,
  onSelectVideoInput,
  onSelectAudioOutput,
  audioLevel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-[#3c4043] bg-[#202124] shadow-2xl p-6 text-[#e8eaed]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#3c4043] mb-5">
          <h3 className="text-base font-semibold text-white font-['Google_Sans',sans-serif]">
            Audio & Video Settings
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#303134] text-[#9aa0a6] hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Device Selectors */}
        <div className="space-y-5">
          {/* Microphone */}
          <div>
            <label className="block text-xs font-medium text-[#bdc1c6] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5 text-cyan-400" />
                <span>Microphone</span>
              </span>
              <span className="text-[10px] text-[#9aa0a6]">
                {audioInputs.length} detected
              </span>
            </label>
            <select
              value={selectedAudioInput}
              onChange={(e) => onSelectAudioInput(e.target.value)}
              className="w-full rounded-xl border border-[#3c4043] bg-[#282a2d] px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none cursor-pointer"
            >
              {audioInputs.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Microphone ${i + 1}`}
                </option>
              ))}
              {audioInputs.length === 0 && <option value="">Default Microphone</option>}
            </select>

            {/* Live Mic Visualizer Bar */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-[#9aa0a6]">Mic Test:</span>
              <div className="flex-1 h-1.5 rounded-full bg-[#303134] overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-75"
                  style={{ width: `${Math.max(4, audioLevel)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Camera */}
          <div>
            <label className="block text-xs font-medium text-[#bdc1c6] mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5 text-cyan-400" />
                <span>Camera</span>
              </span>
              <span className="text-[10px] text-[#9aa0a6]">
                {videoInputs.length} detected
              </span>
            </label>
            <select
              value={selectedVideoInput}
              onChange={(e) => onSelectVideoInput(e.target.value)}
              className="w-full rounded-xl border border-[#3c4043] bg-[#282a2d] px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none cursor-pointer"
            >
              {videoInputs.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
              {videoInputs.length === 0 && <option value="">Default Camera</option>}
            </select>
          </div>

          {/* Speakers / Audio Output */}
          {audioOutputs.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[#bdc1c6] mb-1.5 flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>Speakers / Headphones</span>
              </label>
              <select
                value={selectedAudioOutput}
                onChange={(e) => onSelectAudioOutput(e.target.value)}
                className="w-full rounded-xl border border-[#3c4043] bg-[#282a2d] px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none cursor-pointer"
              >
                {audioOutputs.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Speaker ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Security Guarantee Banner */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-[#9aa0a6]">
              <strong className="text-emerald-300">End-to-End Encryption:</strong> Audio, video, and screen streams flow directly peer-to-peer via WebRTC (DTLS-SRTP). No media is routed through or recorded on any server.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full bg-cyan-600 hover:bg-cyan-500 px-5 py-2 text-xs font-medium text-white transition-colors cursor-pointer shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
