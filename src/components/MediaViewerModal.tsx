import React, { useState } from 'react';
import { ChatAttachment } from '../types';
import { X, Download, ZoomIn, ZoomOut, RotateCw, FileText, Film, Music, ShieldCheck } from 'lucide-react';

interface MediaViewerModalProps {
  attachment: ChatAttachment | null;
  onClose: () => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({ attachment, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!attachment) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formattedSize =
    attachment.fileSize < 1024 * 1024
      ? `${(attachment.fileSize / 1024).toFixed(1)} KB`
      : `${(attachment.fileSize / (1024 * 1024)).toFixed(1)} MB`;

  const expiryDate = new Date(attachment.expiresAt).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3 text-white truncate max-w-md">
          {attachment.fileType === 'image' && <ZoomIn className="h-5 w-5 text-cyan-400 shrink-0" />}
          {attachment.fileType === 'video' && <Film className="h-5 w-5 text-purple-400 shrink-0" />}
          {attachment.fileType === 'audio' && <Music className="h-5 w-5 text-emerald-400 shrink-0" />}
          {attachment.fileType === 'document' && <FileText className="h-5 w-5 text-amber-400 shrink-0" />}
          <div className="truncate">
            <h3 className="text-sm font-medium truncate">{attachment.fileName}</h3>
            <p className="text-[11px] text-slate-400">
              {formattedSize} • <span className="text-cyan-400">Auto-deletes {expiryDate}</span>
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {attachment.fileType === 'image' && (
            <>
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.25, 3))}
                title="Zoom In"
                className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                title="Zoom Out"
                className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Rotate"
                className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            </>
          )}

          <button
            onClick={handleDownload}
            title="Download File"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download</span>
          </button>

          <button
            onClick={onClose}
            title="Close"
            className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors ml-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-5xl max-h-[80vh] w-full h-full flex items-center justify-center overflow-hidden select-none">
        {attachment.fileType === 'image' && (
          <img
            src={attachment.url}
            alt={attachment.fileName}
            referrerPolicy="no-referrer"
            className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl transition-transform duration-150"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          />
        )}

        {attachment.fileType === 'video' && (
          <video
            controls
            autoPlay
            src={attachment.url}
            className="max-h-[80vh] max-w-full rounded-lg shadow-2xl bg-black"
          />
        )}

        {attachment.fileType === 'audio' && (
          <div className="w-full max-w-md p-8 rounded-2xl bg-[#1e2229] border border-[#3c4043] flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Music className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-white">{attachment.fileName}</h4>
              <p className="text-xs text-slate-400">{formattedSize}</p>
            </div>
            <audio controls src={attachment.url} className="w-full mt-2" />
          </div>
        )}

        {attachment.fileType !== 'image' &&
          attachment.fileType !== 'video' &&
          attachment.fileType !== 'audio' && (
            <div className="w-full max-w-md p-8 rounded-2xl bg-[#1e2229] border border-[#3c4043] flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <FileText className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-white">{attachment.fileName}</h4>
                <p className="text-xs text-slate-400">{formattedSize} • {attachment.mimeType}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>30-Day Auto-Purge Protection Active</span>
              </div>
              <button
                onClick={handleDownload}
                className="mt-3 flex items-center gap-2 px-6 py-2.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors cursor-pointer shadow-lg shadow-cyan-950/40"
              >
                <Download className="h-4 w-4" />
                <span>Download Attachment</span>
              </button>
            </div>
          )}
      </div>
    </div>
  );
};
