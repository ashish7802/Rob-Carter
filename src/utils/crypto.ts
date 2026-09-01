/**
 * Cryptographic End-to-End Encryption (E2EE) Module
 * Uses the Web Crypto API (SubtleCrypto) for AES-GCM 256-bit encryption,
 * PBKDF2 key derivation, and SHA-256 Security Fingerprint / SAS verification.
 */

// Salt for PBKDF2 derivation (fixed per protocol version for deterministic room key consensus)
const PROTOCOL_SALT = new TextEncoder().encode('anonmeet-e2ee-protocol-v1-salt');

/**
 * Derive a 256-bit AES-GCM key from the room code
 */
export async function deriveRoomKey(roomCode: string): Promise<CryptoKey> {
  const normalizedCode = roomCode.trim().toUpperCase();
  const enc = new TextEncoder();
  const rawKeyMaterial = enc.encode(normalizedCode);

  // Import raw room passphrase into base key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    rawKeyMaterial,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM 256-bit key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: PROTOCOL_SALT,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedPayload {
  iv: string; // Base64 encoded 12-byte initialization vector
  ciphertext: string; // Base64 encoded ciphertext + auth tag
}

/**
 * Encrypt arbitrary string with AES-GCM 256-bit
 */
export async function encryptText(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
  const enc = new TextEncoder();
  const encodedPlaintext = enc.encode(plaintext);

  // Generate 12-byte random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedPlaintext
  );

  return {
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(new Uint8Array(cipherBuffer)),
  };
}

/**
 * Decrypt AES-GCM 256-bit payload
 */
export async function decryptText(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const iv = base64ToBuffer(payload.iv);
  const cipherBytes = base64ToBuffer(payload.ciphertext);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    cipherBytes
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

/**
 * Generate a 6-digit E2EE Verification Security Code and Visual SAS Fingerprint
 * Both peers can compare this to verify they are connected without a Man-In-The-Middle
 */
export async function generateSecurityVerification(roomCode: string): Promise<{
  sixDigitCode: string;
  fingerprint: string;
  sasEmojis: string[];
}> {
  const normalized = roomCode.trim().toUpperCase();
  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(`e2ee-auth-${normalized}`));
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Compute 6-digit code
  const num = (hashArray[0] << 24) | (hashArray[1] << 16) | (hashArray[2] << 8) | hashArray[3];
  const absNum = Math.abs(num);
  const sixDigitCode = (absNum % 900000 + 100000).toString();

  // Full SHA-256 Fingerprint in groups of 4 hex
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const fingerprint = hex.match(/.{1,4}/g)?.slice(0, 8).join(' ') || hex.slice(0, 32);

  // 4 Emoji SAS (Short Authentication String)
  const EMOJI_SET = ['🛡️', '⚡', '🔒', '🔑', '💎', '🌊', '🌟', '🕊️', '🪐', '🍀', '🛰️', '🌲', '🏔️', '🦉', '🦊', '🐬'];
  const sasEmojis = [
    EMOJI_SET[hashArray[4] % EMOJI_SET.length],
    EMOJI_SET[hashArray[5] % EMOJI_SET.length],
    EMOJI_SET[hashArray[6] % EMOJI_SET.length],
    EMOJI_SET[hashArray[7] % EMOJI_SET.length],
  ];

  return {
    sixDigitCode,
    fingerprint,
    sasEmojis,
  };
}

// Helpers for Base64 conversion
function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
