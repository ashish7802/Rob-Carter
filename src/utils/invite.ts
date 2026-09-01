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

  // 1. Check query parameter '?room=...' or '?join=...'
  const params = new URLSearchParams(window.location.search);
  const roomQuery = params.get('room') || params.get('join') || params.get('code') || params.get('meet');
  if (roomQuery && roomQuery.trim()) {
    return roomQuery.trim().toLowerCase();
  }

  // 2. Check path '/room/abc-defg-hij' or '/abc-defg-hij'
  const path = window.location.pathname;
  const match = path.match(/^\/(?:room\/)?([a-zA-Z0-9_-]{3,24})/i);
  if (match && match[1] && match[1].toLowerCase() !== 'index.html' && match[1].toLowerCase() !== 'api') {
    return match[1].trim().toLowerCase();
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
      if (url.pathname.startsWith('/room/')) {
        url.pathname = '/';
      }
    }
    window.history.replaceState({}, '', url.toString());
  } catch (e) {
    console.warn('URL update failed:', e);
  }
}
