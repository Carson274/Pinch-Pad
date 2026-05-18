import { useEffect, useRef } from 'react';
import { useHandTracking } from './hooks/useHandTracking';
import { useBeatPadAudio, type SampleName } from './hooks/useBeatPadAudio';

interface Pad {
  name: SampleName;
  // All in normalized 0..1 coords, origin top-left.
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD_LAYOUT: Pad[] = [
  { name: 'kick',   x: 0.05, y: 0.65, w: 0.2, h: 0.25 },
  { name: 'clap',   x: 0.28, y: 0.65, w: 0.2, h: 0.25 },
  { name: 'hi-hat', x: 0.52, y: 0.65, w: 0.2, h: 0.25 },
  { name: 'synth', x: 0.75, y: 0.65, w: 0.2, h: 0.25 },
];

function hitTest(px: number, py: number, pad: Pad): boolean {
  return (
    px >= pad.x &&
    px <= pad.x + pad.w &&
    py >= pad.y &&
    py <= pad.y + pad.h
  );
}

export default function App() {
  const { x, y, isPinching, videoRef } = useHandTracking();
  const { start, playSample, isLoaded } = useBeatPadAudio();

  // Rising-edge detection: only trigger when isPinching flips false -> true.
  const prevPinchRef = useRef(false);
  useEffect(() => {
    if (isPinching && !prevPinchRef.current) {
      for (const pad of PAD_LAYOUT) {
        if (hitTest(x, y, pad)) {
          playSample(pad.name);
          break;
        }
      }
    }
    prevPinchRef.current = isPinching;
  }, [isPinching, x, y, playSample]);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#000' }}>
      {/* Webcam feed, mirrored for selfie view. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)',
        }}
      />

      {/* Start Audio button — must be a real user gesture for Tone.start(). */}
      {!isLoaded && (
        <button
          onClick={start}
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            padding: '8px 16px',
            zIndex: 10,
          }}
        >
          Start Audio
        </button>
      )}

      {/* Pads — plain gray squares, no styling. */}
      {PAD_LAYOUT.map((pad) => (
        <div
          key={pad.name}
          style={{
            position: 'absolute',
            left: `${pad.x * 100}%`,
            top: `${pad.y * 100}%`,
            width: `${pad.w * 100}%`,
            height: `${pad.h * 100}%`,
            background: 'rgba(128, 128, 128, 0.5)',
            border: '1px solid #fff',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'monospace',
            pointerEvents: 'none',
          }}
        >
          {pad.name}
        </div>
      ))}

      {/* Cursor dot. */}
      <div
        style={{
          position: 'absolute',
          left: `${x * 100}%`,
          top: `${y * 100}%`,
          width: 16,
          height: 16,
          marginLeft: -8,
          marginTop: -8,
          borderRadius: '50%',
          background: isPinching ? '#ff0' : '#f00',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
    </div>
  );
}