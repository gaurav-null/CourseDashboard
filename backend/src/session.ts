import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const DEFAULT_KEY = '0123456789abcdef0123456789abcdef';

function getKey(): Buffer {
  const raw = process.env.SESSION_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY ?? DEFAULT_KEY;
  const candidate = raw.length >= 32 ? raw.slice(0, 32) : raw.padEnd(32, '0');
  return Buffer.from(candidate, 'utf8');
}

export function encryptSession(value: unknown): string {
  const iv = randomBytes(12);
  const key = getKey();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const payload = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${Buffer.concat([encrypted, tag]).toString('hex')}`;
}

export function decryptSession(serialized: string): unknown {
  const [ivHex, encryptedHex] = serialized.split(':');
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted session payload.');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const combined = Buffer.from(encryptedHex, 'hex');
  const tagLength = 16;
  const ciphertext = combined.subarray(0, combined.length - tagLength);
  const tag = combined.subarray(combined.length - tagLength);
  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}
