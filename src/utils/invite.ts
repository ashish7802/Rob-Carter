// Utility for generating invite links and Google Meet style room codes

export function generateMeetCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part3 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part1}-${part2}-${part3}`;
}

export function getRoomInviteUrl(roomCode: string): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  const cleanCode = encodeURIComponent(roomCode.trim().toLowerCase());
  return `${origin}/?room=${cleanCode}`;
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
  }
  return Promise.resolve(fallbackCopy(text));
}

function fallbackCopy(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  }
}

export function parseRoomFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Check query parameter '?room=...' or '?join=...' or '?code=...' or '?meet=...'
  const params = new URLSearchParams(window.location.search);
  const roomQuery = params.get('room') || params.get('join') || params.get('code') || params.get('meet');
  if (roomQuery && roomQuery.trim()) {
    return roomQuery.trim().toLowerCase();
  }

  // 2. Check path '/meet/abc-defg-hij', '/room/abc-defg-hij', or '/abc-defg-hij'
  const cleanPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (cleanPath) {
    const parts = cleanPath.split('/');
    const reservedWords = ['api', 'uploads', 'assets', 'index.html', 'favicon.ico', 'vite', 'src', 'node_modules'];

    if ((parts[0] === 'room' || parts[0] === 'meet') && parts[1]) {
      const code = parts[1].trim();
      if (code && !reservedWords.includes(code.toLowerCase())) {
        return code.toLowerCase();
      }
    } else if (parts.length === 1 && !reservedWords.includes(parts[0].toLowerCase())) {
      // Direct code pattern e.g. xxx-yyyy-zzz or custom-room
      if (/^[a-zA-Z0-9_-]{3,32}$/.test(parts[0])) {
        return parts[0].trim().toLowerCase();
      }
    }
  }

  return null;
}

export function updateUrlWithRoom(roomCode: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (roomCode) {
      url.searchParams.set('room', roomCode.trim().toLowerCase());
    } else {
      url.searchParams.delete('room');
      url.searchParams.delete('join');
      url.searchParams.delete('code');
      url.searchParams.delete('meet');
      if (url.pathname.startsWith('/room/') || url.pathname.startsWith('/meet/')) {
        url.pathname = '/';
      }
    }
    window.history.replaceState({}, '', url.toString());
  } catch (e) {
    console.warn('URL update failed:', e);
  }
}
