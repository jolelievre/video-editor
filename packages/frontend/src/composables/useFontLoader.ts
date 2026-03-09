import { BUNDLED_FONTS } from '@video-editor/shared/fonts';

let loaded = false;

export function useFontLoader() {
  if (loaded) return;
  loaded = true;

  const rules: string[] = [];
  for (const font of BUNDLED_FONTS) {
    rules.push(`@font-face {
  font-family: '${font.family}';
  font-weight: 400;
  font-style: normal;
  src: url('/api/fonts/${font.file}') format('truetype');
}`);

    if (font.boldFile) {
      rules.push(`@font-face {
  font-family: '${font.family}';
  font-weight: 700;
  font-style: normal;
  src: url('/api/fonts/${font.boldFile}') format('truetype');
}`);
    }

    if (font.italicFile) {
      rules.push(`@font-face {
  font-family: '${font.family}';
  font-weight: 400;
  font-style: italic;
  src: url('/api/fonts/${font.italicFile}') format('truetype');
}`);
    }

    if (font.boldItalicFile) {
      rules.push(`@font-face {
  font-family: '${font.family}';
  font-weight: 700;
  font-style: italic;
  src: url('/api/fonts/${font.boldItalicFile}') format('truetype');
}`);
    }
  }

  const style = document.createElement('style');
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}
