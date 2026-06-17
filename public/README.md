# Real screenshots (optional)

Scenes 17-21s ("Identifies true market structure") and 21-25s
("High probability setups / Only real zones") currently render a built-in
SVG mock chart (`src/components/MockChart.tsx`) so the video is complete
without external assets.

To use your real app screenshots instead:

1. Drop the images in this folder, e.g. `public/structure.png` and
   `public/setups.png`.
2. In `src/SaasAd.tsx`, inside `SceneScreenshot`, replace the `<MockChart .../>`
   block with:

   ```tsx
   import {Img, staticFile} from 'remotion';
   // ...
   <Img src={staticFile('structure.png')} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
   ```

The portrait frame is 1080x1920; screenshots look best cropped to a tall
aspect ratio.
