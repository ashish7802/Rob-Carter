import { VideoFilterType } from '../types';

export class VideoProcessor {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private sourceVideo: HTMLVideoElement | null = null;
  private animationFrameId: number | null = null;
  private outputStream: MediaStream | null = null;
  private currentFilter: VideoFilterType = 'none';
  private frameCount = 0;

  public init(rawStream: MediaStream): { processedStream: MediaStream; videoElement: HTMLVideoElement } {
    this.destroy();

    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    this.sourceVideo = document.createElement('video');
    this.sourceVideo.autoplay = true;
    this.sourceVideo.playsInline = true;
    this.sourceVideo.muted = true;
    this.sourceVideo.srcObject = rawStream;

    this.sourceVideo.play().catch(() => {});

    // Start rendering loop
    this.renderLoop();

    // Create stream from canvas
    this.outputStream = this.canvas.captureStream(30);

    return {
      processedStream: this.outputStream,
      videoElement: this.sourceVideo,
    };
  }

  public setFilter(filterType: VideoFilterType) {
    this.currentFilter = filterType;
  }

  private renderLoop = () => {
    this.frameCount++;
    if (this.ctx && this.canvas && this.sourceVideo && this.sourceVideo.readyState >= 2) {
      const w = this.canvas.width;
      const h = this.canvas.height;

      // Draw original frame
      if (this.currentFilter === 'none') {
        this.ctx.filter = 'none';
        this.ctx.drawImage(this.sourceVideo, 0, 0, w, h);
      } else if (this.currentFilter === 'privacy_blur') {
        // Privacy Face & Background Blur
        this.ctx.filter = 'blur(16px) saturate(1.2)';
        this.ctx.drawImage(this.sourceVideo, 0, 0, w, h);
        this.ctx.filter = 'none';

        // Add subtle incognito privacy shield badge overlay
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
        this.ctx.fillRect(0, 0, w, h);
        this.ctx.fillStyle = '#10b981';
        this.ctx.font = '600 14px monospace';
        this.ctx.fillText('[INCOGNITO PRIVACY BLUR]', 20, 36);
      } else if (this.currentFilter === 'pixelate') {
        // Mosaic Pixelation
        const pixelSize = 16;
        const smallW = Math.max(1, Math.floor(w / pixelSize));
        const smallH = Math.max(1, Math.floor(h / pixelSize));

        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(this.sourceVideo, 0, 0, smallW, smallH);
        this.ctx.drawImage(this.canvas, 0, 0, smallW, smallH, 0, 0, w, h);
        this.ctx.imageSmoothingEnabled = true;

        this.ctx.fillStyle = '#06b6d4';
        this.ctx.font = '600 13px monospace';
        this.ctx.fillText('[ANON MOSAIC 16PX]', 20, 36);
      } else if (this.currentFilter === 'cyber_hologram') {
        // Cyber Hologram Cyan/Magenta Chromatic Aberration + Scanlines
        this.ctx.filter = 'contrast(1.4) brightness(1.1)';
        this.ctx.drawImage(this.sourceVideo, 0, 0, w, h);
        this.ctx.filter = 'none';

        const imgData = this.ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        for (let i = 0; i < data.length; i += 4) {
          // Boost Cyan & Magenta, cut yellow
          data[i] = Math.min(255, data[i] * 1.2); // R
          data[i + 1] = Math.min(255, data[i + 1] * 1.3); // G
          data[i + 2] = Math.min(255, data[i + 2] * 1.6); // B
        }
        this.ctx.putImageData(imgData, 0, 0);

        // Scanlines
        this.ctx.fillStyle = 'rgba(0, 255, 240, 0.08)';
        for (let y = 0; y < h; y += 4) {
          this.ctx.fillRect(0, y, w, 1);
        }

        // Glitch flicker
        if (this.frameCount % 45 === 0) {
          this.ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
          this.ctx.fillRect(0, (this.frameCount * 7) % h, w, 8);
        }

        this.ctx.fillStyle = '#06b6d4';
        this.ctx.font = '600 13px monospace';
        this.ctx.fillText('// CYBER HOLO LINK', 20, 36);
      } else if (this.currentFilter === 'night_vision') {
        // Emerald Night Vision
        this.ctx.filter = 'grayscale(100%) contrast(1.5) brightness(1.2)';
        this.ctx.drawImage(this.sourceVideo, 0, 0, w, h);
        this.ctx.filter = 'none';

        // Emerald Tint Overlay
        this.ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
        this.ctx.fillRect(0, 0, w, h);

        // Vignette
        const gradient = this.ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, w / 1.5);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.fillStyle = '#34d399';
        this.ctx.font = '600 13px monospace';
        this.ctx.fillText('● REC [NV-GEN3]', 20, 36);
      } else if (this.currentFilter === 'matrix') {
        // Matrix Green digital rain look
        this.ctx.filter = 'grayscale(100%) contrast(2.0)';
        this.ctx.drawImage(this.sourceVideo, 0, 0, w, h);
        this.ctx.filter = 'none';

        this.ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
        this.ctx.fillRect(0, 0, w, h);

        // Fast digital characters on borders
        this.ctx.fillStyle = '#4ade80';
        this.ctx.font = '10px monospace';
        for (let col = 10; col < w; col += 40) {
          const char = String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96));
          const y = ((this.frameCount * 4) + col * 3) % h;
          this.ctx.fillText(char, col, y);
        }

        this.ctx.fillStyle = '#22c55e';
        this.ctx.font = '600 13px monospace';
        this.ctx.fillText('[MATRIX PROTOCOL]', 20, 36);
      } else if (this.currentFilter === 'noir') {
        // High Contrast Film Noir Monochrome
        this.ctx.filter = 'grayscale(100%) contrast(1.9) brightness(0.9)';
        this.ctx.drawImage(this.sourceVideo, 0, 0, w, h);
        this.ctx.filter = 'none';

        // Film grain noise
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        for (let k = 0; k < 1200; k++) {
          const rx = Math.random() * w;
          const ry = Math.random() * h;
          this.ctx.fillRect(rx, ry, 1, 1);
        }

        this.ctx.fillStyle = '#e2e8f0';
        this.ctx.font = '600 13px monospace';
        this.ctx.fillText('[NOIR CLASSIFIED]', 20, 36);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  public destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.sourceVideo) {
      this.sourceVideo.srcObject = null;
      this.sourceVideo = null;
    }
    this.canvas = null;
    this.ctx = null;
    this.outputStream = null;
  }
}
