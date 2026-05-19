import { useEffect, useRef, useState } from 'react';
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
  label: string;
  hue: number; // 0..360
  // grid position inside the pad cluster (col, row), 0-indexed, 2x2 grid
  col: 0 | 1;
  row: 0 | 1;
}

const PADS: Pad[] = [
  { name: 'kick',   label: 'KICK',  hue: 350, col: 0, row: 0 },
  { name: 'clap',   label: 'CLAP',  hue: 35,  col: 1, row: 0 },
  { name: 'hi-hat', label: 'HAT',   hue: 190, col: 0, row: 1 },
  { name: 'synth',  label: 'SYNTH', hue: 270, col: 1, row: 1 },
];

// Pad cluster geometry (normalized 0..1, bottom-right corner)
const CLUSTER = { x: 0.62, y: 0.50, w: 0.33, h: 0.45, gap: 0.022 };

function padRect(pad: Pad) {
  const cellW = (CLUSTER.w - CLUSTER.gap) / 2;
  const cellH = (CLUSTER.h - CLUSTER.gap) / 2;
  return {
    x: CLUSTER.x + pad.col * (cellW + CLUSTER.gap),
    y: CLUSTER.y + pad.row * (cellH + CLUSTER.gap),
    w: cellW,
    h: cellH,
  };
}

function hitTest(px: number, py: number, pad: Pad): boolean {
  const r = padRect(pad);
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

const ACCENT = '#22d3ee';        // cyan-400
const SURFACE = 'rgba(15, 18, 24, 0.78)';
const SURFACE_SOLID = '#0f1218';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT = '#e6e8ee';
const MUTED = '#8a93a6';

export default function App() {
  const { hands, videoRef } = useHandTracking();
  const { start, playSample, isLoaded, config, updateConfig } = useBeatPadAudio();
  const {
    isRecording,
    isPlaying,
    toggleRecord,
    togglePlay,
    recordHit,
    loopProgress,
    clearLoop,
  } = useLoopStation(playSample);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hitAt, setHitAt] = useState<Record<string, number>>({});
  const prevPinchRef = useRef<boolean[]>([]);

  useEffect(() => {
    hands.forEach((hand, i) => {
      const wasPinching = prevPinchRef.current[i] ?? false;
      if (hand.isPinching && !wasPinching) {
        for (const pad of PADS) {
          if (hitTest(hand.x, hand.y, pad)) {
            playSample(pad.name);
            recordHit(pad.name);
            setHitAt((prev) => ({ ...prev, [pad.name]: performance.now() }));
            break;
          }
        }
      }
    });
    prevPinchRef.current = hands.map((h) => h.isPinching);
  }, [hands, playSample, recordHit]);

  // animation tick for pad flash decay
  const [now, setNow] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => { setNow(performance.now()); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#000', color: TEXT, fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <video
        ref={videoRef}
        autoPlay playsInline muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
      />
      {/* subtle vignette for legibility */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 80% at 50% 40%, transparent 40%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />

      {/* Start Audio overlay */}
      {!isLoaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.55)', zIndex: 50 }}>
          <button
            onClick={start}
            style={{
              padding: '14px 28px', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase',
              background: ACCENT, color: '#001014', border: 'none', borderRadius: 999,
              cursor: 'pointer', fontWeight: 700, boxShadow: `0 0 40px ${ACCENT}55`,
            }}
          >
            Start Audio
          </button>
        </div>
      )}

      {/* Transport bar (top center) */}
      <div style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 6, padding: 6, background: SURFACE, border: `1px solid ${BORDER}`,
        borderRadius: 12, backdropFilter: 'blur(12px)', zIndex: 10,
      }}>
        <TransportBtn onClick={togglePlay} active={isPlaying}>{isPlaying ? '■ Stop' : '▶ Play'}</TransportBtn>
        <TransportBtn onClick={toggleRecord} active={isRecording} danger>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isRecording ? '#ef4444' : '#6b7280' }} />
            {isRecording ? 'Recording' : 'Record'}
          </span>
        </TransportBtn>
        <TransportBtn onClick={clearLoop}>Clear</TransportBtn>
      </div>

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)}>
        <Section title="Kick" hue={350}>
          <Select value={config.kickNote} onChange={(v) => updateConfig({ kickNote: v })} options={KICK_NOTES} label="Note" />
        </Section>
        <Section title="Clap" hue={35}>
          <Select value={config.clapNoise} onChange={(v) => updateConfig({ clapNoise: v as ClapNoise })} options={CLAP_NOISES} label="Noise" />
        </Section>
        <Section title="Hi-Hat" hue={190}>
          <Select
            value={String(config.hatCutoff)}
            onChange={(v) => updateConfig({ hatCutoff: Number(v) })}
            options={HAT_CUTOFFS.map(String)}
            suffix=" Hz"
            label="Cutoff"
          />
        </Section>
        <Section title="Synth" hue={270}>
          <Select value={config.chordRoot} onChange={(v) => updateConfig({ chordRoot: v })} options={CHORD_ROOTS} label="Root" />
          <Select value={config.chordType} onChange={(v) => updateConfig({ chordType: v as ChordType })} options={CHORD_TYPES} label="Chord" />
        </Section>
      </Sidebar>

      {/* Beat pads (bottom-right) */}
      {PADS.map((pad) => {
        const r = padRect(pad);
        const last = hitAt[pad.name] ?? 0;
        const dt = now - last;
        const active = dt < 220;
        const t = active ? 1 - dt / 220 : 0; // 1..0
        const scale = 1 + t * 0.05;
        const glow = t;
        return (
          <div
            key={pad.name}
            style={{
              position: 'absolute',
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.w * 100}%`,
              height: `${r.h * 100}%`,
              borderRadius: 18,
              background: `linear-gradient(160deg, hsla(${pad.hue}, 70%, 22%, 0.85), hsla(${pad.hue}, 60%, 10%, 0.85))`,
              border: `1px solid hsla(${pad.hue}, 80%, ${40 + glow * 30}%, ${0.35 + glow * 0.5})`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px rgba(0,0,0,0.4), 0 0 ${glow * 60}px hsla(${pad.hue}, 90%, 55%, ${glow * 0.6})`,
              transform: `scale(${scale})`,
              transition: active ? 'none' : 'transform 180ms ease-out',
              boxSizing: 'border-box',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              padding: 14, pointerEvents: 'none', backdropFilter: 'blur(2px)',
            }}
          >
            <span style={{
              fontSize: 11, letterSpacing: 2, fontFamily: 'ui-monospace, monospace',
              color: `hsla(${pad.hue}, 90%, 80%, 0.9)`,
            }}>
              {pad.label}
            </span>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: `hsl(${pad.hue}, 90%, ${55 + glow * 20}%)`,
              boxShadow: `0 0 ${4 + glow * 16}px hsl(${pad.hue}, 90%, 60%)`,
            }} />
          </div>
        );
      })}

      {/* Hand indicators — line between thumb & index */}
      <HandOverlay hands={hands} />

      {/* Loop progress */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 3, background: 'rgba(255,255,255,0.06)', zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ width: `${loopProgress * 100}%`, height: '100%', background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` }} />
      </div>
    </div>
  );
}

/* ----------------- subcomponents ----------------- */

function TransportBtn({ children, onClick, active, danger }: { children: React.ReactNode; onClick: () => void; active?: boolean; danger?: boolean }) {
  const bg = active ? (danger ? 'rgba(239,68,68,0.18)' : 'rgba(34,211,238,0.18)') : 'transparent';
  const bd = active ? (danger ? 'rgba(239,68,68,0.5)' : 'rgba(34,211,238,0.5)') : BORDER;
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
        background: bg, color: TEXT, border: `1px solid ${bd}`, borderRadius: 8,
        cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function Sidebar({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <>
      <button
        onClick={onToggle}
        style={{
          position: 'absolute', top: '50%', left: open ? 248 : 8, transform: 'translateY(-50%)',
          zIndex: 12, width: 24, height: 48, borderRadius: 8, background: SURFACE,
          border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer',
          transition: 'left 220ms ease', backdropFilter: 'blur(12px)',
        }}
        aria-label="Toggle sidebar"
      >
        {open ? '‹' : '›'}
      </button>
      <aside style={{
        position: 'absolute', top: 16, bottom: 16, left: open ? 16 : -240, width: 224,
        background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, zIndex: 11,
        backdropFilter: 'blur(14px)', padding: 14, overflowY: 'auto',
        transition: 'left 220ms ease', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: MUTED, textTransform: 'uppercase' }}>
          Sound Design
        </div>
        {children}
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Select({ value, onChange, options, label, suffix }: { value: string; onChange: (v: string) => void; options: string[]; label?: string; suffix?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: MUTED }}>
      {label && <span style={{ width: 44 }}>{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1, padding: '6px 8px', background: SURFACE_SOLID, color: TEXT,
          border: `1px solid ${BORDER}`, borderRadius: 6, fontSize: 12,
          fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
        }}
      >
        {options.map((o) => <option key={o} value={o}>{o}{suffix ?? ''}</option>)}
      </select>
    </label>
  );
}

function HandOverlay({ hands }: { hands: ReturnType<typeof useHandTracking>['hands'] }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
      {hands.map((hand, i) => {
        const color = hand.isPinching ? ACCENT : 'rgba(255,255,255,0.85)';
        const tx = hand.thumb.x * 100;
        const ty = hand.thumb.y * 100;
        const ix = hand.index.x * 100;
        const iy = hand.index.y * 100;
        return (
          <g key={i}>
            <line
              x1={`${tx}%`} y1={`${ty}%`} x2={`${ix}%`} y2={`${iy}%`}
              stroke={color} strokeWidth={hand.isPinching ? 3 : 2} strokeLinecap="round"
              style={{ filter: hand.isPinching ? `drop-shadow(0 0 6px ${ACCENT})` : 'none' }}
            />
            <circle cx={`${tx}%`} cy={`${ty}%`} r={4} fill={color} />
            <circle cx={`${ix}%`} cy={`${iy}%`} r={4} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}
