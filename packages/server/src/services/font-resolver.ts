import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUNDLED_FONTS } from '@video-editor/shared';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FONTS_DIR = join(__dirname, '../../assets/fonts');

export function getFontsDir(): string {
  return FONTS_DIR;
}

export function resolveFontPath(family: string, bold: boolean, italic: boolean): string {
  const font = BUNDLED_FONTS.find((f) => f.family === family);
  if (!font) {
    // Fallback to Roboto
    return resolveFontPath('Roboto', bold, italic);
  }

  // Try exact match first, then fallback
  const candidates: (string | null)[] = [];

  if (bold && italic) {
    candidates.push(font.boldItalicFile, font.boldFile, font.italicFile, font.file);
  } else if (bold) {
    candidates.push(font.boldFile, font.file);
  } else if (italic) {
    candidates.push(font.italicFile, font.file);
  } else {
    candidates.push(font.file);
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    const fullPath = join(FONTS_DIR, candidate);
    if (existsSync(fullPath)) return fullPath;
  }

  // Last resort: return regular file path even if it doesn't exist
  return join(FONTS_DIR, font.file);
}
