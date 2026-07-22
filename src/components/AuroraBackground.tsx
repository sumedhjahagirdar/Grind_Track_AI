/**
 * A few soft, slow-drifting glow blobs fixed behind the app shell.
 * Dark mode only (see .aurora-bg in index.css). Uses only transform/opacity
 * via Tailwind's animate-aurora1/aurora2 keyframes, so it stays cheap and
 * GPU-accelerated, and prefers-reduced-motion freezes it automatically.
 */
export default function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <div
        className="aurora-blob animate-aurora1"
        style={{
          top: '-10%',
          left: '-5%',
          width: '38vw',
          height: '38vw',
          background: 'radial-gradient(circle, #19a874 0%, transparent 70%)',
        }}
      />
      <div
        className="aurora-blob animate-aurora2"
        style={{
          top: '20%',
          right: '-10%',
          width: '32vw',
          height: '32vw',
          background: 'radial-gradient(circle, #6d5efc 0%, transparent 70%)',
        }}
      />
      <div
        className="aurora-blob animate-aurora1"
        style={{
          bottom: '-15%',
          left: '20%',
          width: '30vw',
          height: '30vw',
          background: 'radial-gradient(circle, #3cc590 0%, transparent 70%)',
          animationDuration: '34s',
        }}
      />
    </div>
  )
}
