import React from 'react';
import {Composition} from 'remotion';
import {SaasAd} from './SaasAd';
import {SamsungAd, SAMSUNG_DURATION} from './SamsungAd';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './theme';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SaasAd"
        component={SaasAd}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="SamsungAd"
        component={SamsungAd}
        durationInFrames={SAMSUNG_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
