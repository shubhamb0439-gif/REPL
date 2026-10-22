import { Composition } from 'remotion'
import { RippleReel, defaultProps, type ReelProps } from './RippleReel'

export const RemotionRoot = () => (
  <Composition
    id="RippleReel"
    component={RippleReel}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={defaultProps}
    // Duration follows the scenes in the spec passed with --props
    calculateMetadata={({ props }: { props: ReelProps }) => ({
      durationInFrames: props.scenes.reduce((a, s) => a + s.durationInFrames, 0),
    })}
  />
)
