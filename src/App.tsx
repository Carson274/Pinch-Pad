import { useEffect, useRef } from 'react';
import { useHandTracking } from './hooks/useHandTracking';
import {
  useBeatPadAudio,
  KICK_NOTES,
  HAT_CUTOFFS,
  CHORD_ROOTS,
  CHORD_TYPES,
  CLAP_NOISES,
  type SampleName,
  type ChordType,
  type ClapNoise,
} from './hooks/useBeatPadAudio';
import { useLoopStation } from './hooks/useLoopStation';

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
  const { hands, videoRef } = useHandTracking();
  const { start, playSample, isLoaded, config, updateConfig } =
    useBeatPadAudio();
  const {
    isRecording,
    isPlaying,
    toggleRecord,
    togglePlay,
    recordHit,
    loopProgress,
    clearLoop,
  } = useLoopStation(playSample);

  const prevPinchRef = useRef<boolean[]>([]);
  useEffect(() => {
    hands.forEach((hand, i) => {
      const wasPinching = prevPinchRef.current[i] ?? false;
      if (hand.isPinching && !wasPinching) {
        for (const pad of PAD_LAYOUT) {
          if (hitTest(hand.x, hand.y, pad)) {
            playSample(pad.name);
            recordHit(pad.name);
            break;
          }
        }
      }
    });
    prevPinchRef.current = hands.map((hand) => hand.isPinching);
  }, [hands, playSample, recordHit]);

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

      {hands.map((hand, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${hand.x * 100}%`,
            top: `${hand.y * 100}%`,
            width: 16,
            height: 16,
            marginLeft: -8,
            marginTop: -8,
            borderRadius: '50%',
            background: hand.isPinching ? '#ff0' : '#f00',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          gap: 8,
          zIndex: 10,
        }}
      >
        <button onClick={togglePlay} style={{ padding: '8px 16px' }}>
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        <button onClick={toggleRecord} style={{ padding: '8px 16px' }}>
          {isRecording ? 'Recording...' : 'Record'}
        </button>
        <button onClick={clearLoop} style={{ padding: '8px 16px' }}>
          Clear
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: 8,
          background: 'rgba(0, 0, 0, 0.6)',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        <label>
          kick{' '}
          <select
            value={config.kickNote}
            onChange={(e) => updateConfig({ kickNote: e.target.value })}
          >
            {KICK_NOTES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          clap{' '}
          <select
            value={config.clapNoise}
            onChange={(e) =>
              updateConfig({ clapNoise: e.target.value as ClapNoise })
            }
          >
            {CLAP_NOISES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          hi-hat{' '}
          <select
            value={config.hatCutoff}
            onChange={(e) =>
              updateConfig({ hatCutoff: Number(e.target.value) })
            }
          >
            {HAT_CUTOFFS.map((n) => (
              <option key={n} value={n}>
                {n} Hz
              </option>
            ))}
          </select>
        </label>
        <label>
          synth root{' '}
          <select
            value={config.chordRoot}
            onChange={(e) => updateConfig({ chordRoot: e.target.value })}
          >
            {CHORD_ROOTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          synth chord{' '}
          <select
            value={config.chordType}
            onChange={(e) =>
              updateConfig({ chordType: e.target.value as ChordType })
            }
          >
            {CHORD_TYPES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: 6,
          background: 'rgba(255, 255, 255, 0.2)',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: `${loopProgress * 100}%`,
            height: '100%',
            background: '#0f0',
          }}
        />
      </div>
    </div>
  );
}