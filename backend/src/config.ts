import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'),
});

export const PORT = Number(process.env.PORT ?? 3001);
export const API_PREFIX = '/api';
export const AI_PROVIDER = process.env.AI_PROVIDER ?? (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'gemini');
