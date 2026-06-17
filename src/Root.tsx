import {Composition} from 'remotion';
import {SaasAd} from './SaasAd';
import {DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH} from './theme';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SaasAd"
      component={SaasAd}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
