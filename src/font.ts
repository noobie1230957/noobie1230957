import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Self-hosted Inter (bundled in public/fonts) so rendering needs no network.
export const fontFamily = 'Inter';

const weights = ['400', '600', '700', '800', '900'] as const;

weights.forEach((weight) => {
  loadFont({
    family: fontFamily,
    url: staticFile(`fonts/inter-latin-${weight}-normal.woff2`),
    weight,
    style: 'normal',
  });
});
