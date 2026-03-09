export interface BundledFont {
  family: string;
  file: string;
  boldFile: string | null;
  italicFile: string | null;
  boldItalicFile: string | null;
}

export const BUNDLED_FONTS: BundledFont[] = [
  {
    family: 'Roboto',
    file: 'Roboto-Regular.ttf',
    boldFile: 'Roboto-Bold.ttf',
    italicFile: 'Roboto-Italic.ttf',
    boldItalicFile: 'Roboto-BoldItalic.ttf',
  },
  {
    family: 'Open Sans',
    file: 'OpenSans-Regular.ttf',
    boldFile: 'OpenSans-Bold.ttf',
    italicFile: 'OpenSans-Italic.ttf',
    boldItalicFile: 'OpenSans-BoldItalic.ttf',
  },
  {
    family: 'Montserrat',
    file: 'Montserrat-Regular.ttf',
    boldFile: 'Montserrat-Bold.ttf',
    italicFile: 'Montserrat-Italic.ttf',
    boldItalicFile: 'Montserrat-BoldItalic.ttf',
  },
  {
    family: 'Lato',
    file: 'Lato-Regular.ttf',
    boldFile: 'Lato-Bold.ttf',
    italicFile: 'Lato-Italic.ttf',
    boldItalicFile: 'Lato-BoldItalic.ttf',
  },
  {
    family: 'Oswald',
    file: 'Oswald-Regular.ttf',
    boldFile: 'Oswald-Bold.ttf',
    italicFile: null,
    boldItalicFile: null,
  },
  {
    family: 'Playfair Display',
    file: 'PlayfairDisplay-Regular.ttf',
    boldFile: 'PlayfairDisplay-Bold.ttf',
    italicFile: 'PlayfairDisplay-Italic.ttf',
    boldItalicFile: 'PlayfairDisplay-BoldItalic.ttf',
  },
  {
    family: 'Source Code Pro',
    file: 'SourceCodePro-Regular.ttf',
    boldFile: 'SourceCodePro-Bold.ttf',
    italicFile: 'SourceCodePro-Italic.ttf',
    boldItalicFile: 'SourceCodePro-BoldItalic.ttf',
  },
  {
    family: 'Bebas Neue',
    file: 'BebasNeue-Regular.ttf',
    boldFile: null,
    italicFile: null,
    boldItalicFile: null,
  },
  {
    family: 'Permanent Marker',
    file: 'PermanentMarker-Regular.ttf',
    boldFile: null,
    italicFile: null,
    boldItalicFile: null,
  },
  {
    family: 'Dancing Script',
    file: 'DancingScript-Regular.ttf',
    boldFile: 'DancingScript-Bold.ttf',
    italicFile: null,
    boldItalicFile: null,
  },
];
