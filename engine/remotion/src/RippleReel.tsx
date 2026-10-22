import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion'

export type Scene = {
  durationInFrames: number
  text: string
  motion?: 'slam' | 'rise' | 'counter' | 'flip' | 'logo'
  accent?: boolean
}

export type ReelProps = {
  brand: { name: string; handle: string; colors: { primary: string; secondary: string; accent: string; bg: string } }
  scenes: Scene[]
}

export const defaultProps: ReelProps = {
  brand: { name: 'AXIon', handle: '@axion.ai', colors: { primary: '#C6FF3D', secondary: '#7C5CFF', accent: '#22D3EE', bg: '#05050A' } },
  scenes: [
    { durationInFrames: 45, text: 'Still replying to DMs at midnight?', motion: 'slam' },
    { durationInFrames: 45, text: '11:47 PM — “Hi, what are your prices?”', motion: 'rise' },
    { durationInFrames: 60, text: 'Replied in 3 seconds', motion: 'counter', accent: true },
    { durationInFrames: 60, text: 'Appointment booked ✓', motion: 'flip' },
    { durationInFrames: 75, text: 'DM “DEMO” to see it live', motion: 'logo' },
  ],
}

const FONT = 'Unbounded, Inter, system-ui, sans-serif'

function Ripples({ color, frame }: { color: string; frame: number }) {
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2, 3].map((i) => {
        const t = ((frame + i * 12) % 48) / 48
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 500,
              height: 500,
              borderRadius: '50%',
              border: `3px solid ${color}`,
              transform: `scale(${0.3 + t * 2.6})`,
              opacity: (1 - t) * 0.6,
            }}
          />
        )
      })}
    </AbsoluteFill>
  )
}

function SceneView({ scene, index, brand }: { scene: Scene; index: number; brand: ReelProps['brand'] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const c = brand.colors
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 160 } })
  const exit = interpolate(frame, [scene.durationInFrames - 8, scene.durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const color = scene.accent ? c.primary : '#FFFFFF'

  let transform = ''
  if (scene.motion === 'slam') transform = `scale(${interpolate(enter, [0, 1], [2.2, 1])})`
  else if (scene.motion === 'rise') transform = `translateY(${interpolate(enter, [0, 1], [180, 0])}px)`
  else if (scene.motion === 'flip') transform = `perspective(1200px) rotateX(${interpolate(enter, [0, 1], [90, 0])}deg)`
  else transform = `scale(${interpolate(enter, [0, 1], [0.8, 1])})`

  const counter = scene.motion === 'counter' ? Math.min(3, Math.floor(interpolate(frame, [0, 24], [0, 3.99], { extrapolateRight: 'clamp' }))) : null

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at ${30 + index * 12}% ${25 + index * 10}%, ${index % 2 ? c.secondary : c.primary}44, ${c.bg} 62%)`,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 110,
      }}
    >
      {(scene.motion === 'slam' || scene.motion === 'logo') && <Ripples color={c.primary} frame={frame} />}
      <div style={{ opacity: exit, transform, textAlign: 'center' }}>
        {counter !== null && (
          <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: 340, color: c.primary, lineHeight: 1, textShadow: `0 0 80px ${c.primary}88` }}>{counter}s</div>
        )}
        <div
          style={{
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: scene.motion === 'slam' ? 108 : 84,
            lineHeight: 1.05,
            color,
            textTransform: scene.motion === 'slam' ? 'uppercase' : 'none',
          }}
        >
          {scene.text}
        </div>
        {scene.motion === 'logo' && (
          <div style={{ marginTop: 70, fontFamily: FONT, fontSize: 44, letterSpacing: 12, color: 'white', opacity: 0.8 }}>
            {brand.name.toUpperCase()} · {brand.handle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  )
}

export const RippleReel = ({ brand, scenes }: ReelProps) => {
  const frame = useCurrentFrame()
  const total = scenes.reduce((a, s) => a + s.durationInFrames, 0)
  let from = 0
  return (
    <AbsoluteFill style={{ background: brand.colors.bg }}>
      {scenes.map((s, i) => {
        const seq = (
          <Sequence key={i} from={from} durationInFrames={s.durationInFrames}>
            <SceneView scene={s} index={i} brand={brand} />
          </Sequence>
        )
        from += s.durationInFrames
        return seq
      })}
      {/* progress bar, Stories-style */}
      <div style={{ position: 'absolute', top: 120, left: 80, right: 80, height: 8, borderRadius: 8, background: 'rgba(255,255,255,.15)' }}>
        <div style={{ width: `${(frame / total) * 100}%`, height: '100%', borderRadius: 8, background: brand.colors.primary }} />
      </div>
    </AbsoluteFill>
  )
}
