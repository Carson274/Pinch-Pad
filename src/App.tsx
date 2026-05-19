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
const SURFACE = 'rgba(15, 18, 24, 0.32)';
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
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const prevPinchRef = useRef<boolean[]>([]);
  const handsRef = useRef(hands);

  useEffect(() => {
    handsRef.current = hands;
    hands.forEach((hand, i) => {
      const wasPinching = prevPinchRef.current[i] ?? false;
      if (hand.isPinching && !wasPinching) {
        let hitPad = false;
        for (const pad of PADS) {
          if (hitTest(hand.x, hand.y, pad)) {
            playSample(pad.name);
            recordHit(pad.name);
            setHitAt((prev) => ({ ...prev, [pad.name]: performance.now() }));
            hitPad = true;
            break;
          }
        }
        if (!hitPad) {
          const el = document.elementFromPoint(
            hand.x * window.innerWidth,
            hand.y * window.innerHeight,
          );
          el?.closest<HTMLElement>('[data-pinch]')?.click();
        }
      }
    });
    prevPinchRef.current = hands.map((h) => h.isPinching);
  }, [hands, playSample, recordHit]);

  // animation tick for pad flash decay + finger hover detection
  const [now, setNow] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setNow(performance.now());
      const lead = handsRef.current[0];
      if (lead) {
        const el = document.elementFromPoint(
          lead.x * window.innerWidth,
          lead.y * window.innerHeight,
        );
        setHoverKey(el?.closest<HTMLElement>('[data-pinch]')?.dataset.pinch ?? null);
      } else {
        setHoverKey(null);
      }
      raf = requestAnimationFrame(loop);
    };
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
              padding: '22px 48px', fontSize: 18, letterSpacing: 2, textTransform: 'uppercase',
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
        display: 'flex', gap: 10, padding: 10, background: SURFACE, border: `1px solid ${BORDER}`,
        borderRadius: 14, backdropFilter: 'blur(12px)', zIndex: 10,
      }}>
        <TransportBtn onClick={togglePlay} active={isPlaying} pinchKey="play" hoverKey={hoverKey}>{isPlaying ? '■ Stop' : '▶ Play'}</TransportBtn>
        <TransportBtn onClick={toggleRecord} active={isRecording} danger pinchKey="record" hoverKey={hoverKey}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isRecording ? '#ef4444' : '#6b7280' }} />
            {isRecording ? 'Recording' : 'Record'}
          </span>
        </TransportBtn>
        <TransportBtn onClick={clearLoop} pinchKey="clear" hoverKey={hoverKey}>Clear</TransportBtn>
      </div>

      {/* Sidebar */}
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} hoverKey={hoverKey}>
        <Section title="Kick" hue={350}>
          <Cycle label="Note" value={config.kickNote} onChange={(v) => updateConfig({ kickNote: v })} options={KICK_NOTES} pinchKey="kick-note" hoverKey={hoverKey} />
        </Section>
        <Section title="Clap" hue={35}>
          <Cycle label="Noise" value={config.clapNoise} onChange={(v) => updateConfig({ clapNoise: v as ClapNoise })} options={CLAP_NOISES} pinchKey="clap-noise" hoverKey={hoverKey} />
        </Section>
        <Section title="Hi-Hat" hue={190}>
          <Cycle
            label="Cutoff"
            value={String(config.hatCutoff)}
            onChange={(v) => updateConfig({ hatCutoff: Number(v) })}
            options={HAT_CUTOFFS.map(String)}
            suffix=" Hz"
            pinchKey="hat-cutoff"
            hoverKey={hoverKey}
          />
        </Section>
        <Section title="Synth" hue={270}>
          <Cycle label="Root" value={config.chordRoot} onChange={(v) => updateConfig({ chordRoot: v })} options={CHORD_ROOTS} pinchKey="synth-root" hoverKey={hoverKey} />
          <Cycle label="Chord" value={config.chordType} onChange={(v) => updateConfig({ chordType: v as ChordType })} options={CHORD_TYPES} pinchKey="synth-chord" hoverKey={hoverKey} />
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

function TransportBtn({ children, onClick, active, danger, pinchKey, hoverKey }: { children: React.ReactNode; onClick: () => void; active?: boolean; danger?: boolean; pinchKey: string; hoverKey: string | null }) {
  const hovered = hoverKey === pinchKey;
  const bg = active
    ? (danger ? 'rgba(239,68,68,0.18)' : 'rgba(34,211,238,0.18)')
    : (hovered ? 'rgba(34,211,238,0.12)' : 'transparent');
  const bd = active
    ? (danger ? 'rgba(239,68,68,0.5)' : 'rgba(34,211,238,0.5)')
    : (hovered ? ACCENT : BORDER);
  return (
    <button
      data-pinch={pinchKey}
      onClick={onClick}
      style={{
        padding: '15px 26px', fontSize: 15, letterSpacing: 1, textTransform: 'uppercase',
        background: bg, color: TEXT, border: `1px solid ${bd}`, borderRadius: 12,
        cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit',
        boxShadow: hovered ? `0 0 0 2px ${ACCENT}44` : 'none',
        transition: 'background 120ms, border-color 120ms, box-shadow 120ms',
      }}
    >
      {children}
    </button>
  );
}

const SIDEBAR_W = 304;

function Sidebar({ open, onToggle, hoverKey, children }: { open: boolean; onToggle: () => void; hoverKey: string | null; children: React.ReactNode }) {
  const hovered = hoverKey === 'sidebar';
  return (
    <>
      <button
        data-pinch="sidebar"
        onClick={onToggle}
        style={{
          position: 'absolute', top: '50%', left: open ? SIDEBAR_W + 24 : 8, transform: 'translateY(-50%)',
          zIndex: 12, width: 38, height: 72, borderRadius: 12, background: SURFACE,
          border: `1px solid ${hovered ? ACCENT : BORDER}`, color: hovered ? ACCENT : MUTED,
          cursor: 'pointer', fontSize: 24,
          boxShadow: hovered ? `0 0 0 2px ${ACCENT}44` : 'none',
          transition: 'left 220ms ease, border-color 120ms, box-shadow 120ms',
          backdropFilter: 'blur(12px)',
        }}
        aria-label="Toggle sidebar"
      >
        {open ? '‹' : '›'}
      </button>
      <aside style={{
        position: 'absolute', top: 16, bottom: 16, left: open ? 16 : -(SIDEBAR_W + 16), width: SIDEBAR_W,
        boxSizing: 'border-box', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16,
        zIndex: 11, backdropFilter: 'blur(14px)', overflowY: 'auto',
        transition: 'left 220ms ease', display: 'flex', flexDirection: 'column',
        boxShadow: '0 16px 48px rgba(0,0,0,0.45)',
      }}>
        <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.5, color: TEXT }}>
            PINCH<span style={{ color: ACCENT }}>·</span>PAD
          </div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: MUTED, textTransform: 'uppercase', marginTop: 3 }}>
            Sound Design
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </aside>
    </>
  );
}

function Section({ title, hue, children }: { title: string; hue: number; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10,
      padding: '14px 18px', borderBottom: `1px solid ${BORDER}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 9, height: 9, borderRadius: '50%',
          background: `hsl(${hue}, 80%, 56%)`,
          boxShadow: `0 0 8px hsla(${hue}, 90%, 56%, 0.7)`,
        }} />
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
          textTransform: 'uppercase', color: TEXT,
        }}>
          {title}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function Cycle({ label, value, options, onChange, suffix, pinchKey, hoverKey }: { label: string; value: string; options: string[]; onChange: (v: string) => void; suffix?: string; pinchKey: string; hoverKey: string | null }) {
  const hovered = hoverKey === pinchKey;
  const idx = Math.max(0, options.indexOf(value));
  const advance = () => onChange(options[(idx + 1) % options.length]);
  return (
    <button
      data-pinch={pinchKey}
      onClick={advance}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        width: '100%', boxSizing: 'border-box', padding: '15px 16px',
        background: hovered ? 'rgba(34,211,238,0.14)' : 'rgba(255,255,255,0.05)',
        border: `1px solid ${hovered ? ACCENT : BORDER}`, borderRadius: 12,
        color: TEXT, cursor: 'pointer', fontFamily: 'inherit', fontSize: 15,
        boxShadow: hovered ? `0 0 0 2px ${ACCENT}44` : 'none',
        transition: 'background 120ms, border-color 120ms, box-shadow 120ms',
      }}
    >
      <span style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: MUTED }}>
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
        {value}{suffix ?? ''}
        <span style={{ color: ACCENT, fontSize: 14 }}>▸</span>
      </span>
    </button>
  );
}

function HandOverlay({ hands }: { hands: ReturnType<typeof useHandTracking>['hands'] }) {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 999 }}>
      {hands.map((hand, i) => {
        const color = hand.isPinching ? ACCENT : '#ffffff';
        const tx = hand.thumb.x * 100;
        const ty = hand.thumb.y * 100;
        const ix = hand.index.x * 100;
        const iy = hand.index.y * 100;
        const glow = hand.isPinching
          ? `drop-shadow(0 0 10px ${ACCENT})`
          : 'drop-shadow(0 0 4px rgba(0,0,0,0.95))';
        return (
          <g key={i} style={{ filter: glow }}>
            <line
              x1={`${tx}%`} y1={`${ty}%`} x2={`${ix}%`} y2={`${iy}%`}
              stroke={color} strokeWidth={hand.isPinching ? 6 : 4} strokeLinecap="round"
            />
            <circle cx={`${tx}%`} cy={`${ty}%`} r={8} fill={color} />
            <circle cx={`${ix}%`} cy={`${iy}%`} r={hand.isPinching ? 13 : 9} fill="none" stroke={color} strokeWidth={3} />
            <circle cx={`${ix}%`} cy={`${iy}%`} r={4} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}
