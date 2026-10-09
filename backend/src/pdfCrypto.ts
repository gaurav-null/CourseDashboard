import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

const DEFAULT_KEY = '0123456789abcdef0123456789abcdef';

export const PDF_CHUNK_SIZE = 64 * 1024; // 64 KB chunks

export function getMasterKey(): Buffer {
  const raw = process.env.SESSION_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY ?? DEFAULT_KEY;
  const candidate = raw.length >= 32 ? raw.slice(0, 32) : raw.padEnd(32, '0');
  return Buffer.from(candidate, 'utf8');
}

export function deriveDocumentKey(token: string): Buffer {
  const masterKey = getMasterKey();
  return createHmac('sha256', masterKey).update(token).digest();
}

export interface EncryptedChunk {
  chunkIndex: number;
  iv: string; // hex
  authTag: string; // hex
  encryptedData: Buffer;
}

export function isPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}

/**
 * Splits a PDF buffer into 64KB chunks and encrypts each chunk with AES-256-GCM.
 */
export function chunkAndEncryptPdf(
  pdfBuffer: Buffer,
  token: string,
  chunkSize = PDF_CHUNK_SIZE,
): {
  chunks: EncryptedChunk[];
  totalChunks: number;
  fileSize: number;
} {
  const key = deriveDocumentKey(token);
  const chunks: EncryptedChunk[] = [];
  let chunkIndex = 0;

  for (let offset = 0; offset < pdfBuffer.length; offset += chunkSize) {
    const chunkSlice = pdfBuffer.subarray(offset, Math.min(offset + chunkSize, pdfBuffer.length));
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const encryptedData = Buffer.concat([cipher.update(chunkSlice), cipher.final()]);
    const authTag = cipher.getAuthTag();

    chunks.push({
      chunkIndex,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encryptedData,
    });

    chunkIndex += 1;
  }

  return {
    chunks,
    totalChunks: chunks.length,
    fileSize: pdfBuffer.length,
  };
}

/**
 * Decrypts all chunks of an encrypted PDF and reassembles the original PDF Buffer.
 */
export function decryptAndAssemblePdf(
  chunks: Array<{ chunk_index: number; iv: string; auth_tag: string; encrypted_data: Buffer }>,
  token: string,
): Buffer {
  if (!chunks || chunks.length === 0) {
    throw new Error('No encrypted chunks provided for decryption.');
  }

  const key = deriveDocumentKey(token);
  const sorted = [...chunks].sort((a, b) => a.chunk_index - b.chunk_index);
  const decryptedParts: Buffer[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const chunk = sorted[i];
    if (chunk.chunk_index !== i) {
      throw new Error(`Corrupted chunk sequence: expected index ${i}, found ${chunk.chunk_index}`);
    }

    const iv = Buffer.from(chunk.iv, 'hex');
    const authTag = Buffer.from(chunk.auth_tag, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(chunk.encrypted_data), decipher.final()]);
    decryptedParts.push(decrypted);
  }

  const assembled = Buffer.concat(decryptedParts);
  if (!isPdfBuffer(assembled)) {
    throw new Error('Decrypted data does not match a valid PDF header.');
  }

  return assembled;
}

