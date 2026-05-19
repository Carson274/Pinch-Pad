import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

export type SampleName = 'kick' | 'clap' | 'hi-hat' | 'synth';
export type ClapNoise = 'white' | 'pink' | 'brown';
export type ChordType = 'min7' | 'maj7' | 'min' | 'maj' | 'sus4';

export interface SynthConfig {
  kickNote: string;
  clapNoise: ClapNoise;
  hatCutoff: number;
  chordRoot: string;
  chordType: ChordType;
}

export interface BeatPadAudio {
  start: () => Promise<void>;
  playSample: (name: SampleName, time?: number) => void;
  isLoaded: boolean;
  config: SynthConfig;
  updateConfig: (partial: Partial<SynthConfig>) => void;
}

export const KICK_NOTES = ['C0', 'E0', 'G0', 'A0', 'C1', 'E1', 'G1', 'C2'];
export const HAT_CUTOFFS = [5000, 6500, 8000, 9500, 11000];
export const CHORD_ROOTS = [
  'C3', 'D3', 'E3', 'F3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4',
];
export const CHORD_TYPES: ChordType[] = ['min7', 'maj7', 'min', 'maj', 'sus4'];
export const CLAP_NOISES: ClapNoise[] = ['white', 'pink', 'brown'];

const CHORD_INTERVALS: Record<ChordType, number[]> = {
  min7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  min: [0, 3, 7],
  maj: [0, 4, 7],
  sus4: [0, 5, 7],
};

const DEFAULT_CONFIG: SynthConfig = {
  kickNote: 'C1',
  clapNoise: 'white',
  hatCutoff: 8000,
  chordRoot: 'C4',
  chordType: 'min7',
};

interface Kit {
  kick: Tone.MembraneSynth;
  clap: Tone.NoiseSynth;
  'hi-hat': Tone.NoiseSynth;
  hatFilter: Tone.Filter;
  synth: Tone.PolySynth;
}

export function useBeatPadAudio(): BeatPadAudio {
  const kitRef = useRef<Kit | null>(null);
  const startingRef = useRef(false);
  const lastStartRef = useRef<Partial<Record<SampleName, number>>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  const [config, setConfig] = useState<SynthConfig>(DEFAULT_CONFIG);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const start = useCallback(async () => {
    if (kitRef.current || startingRef.current) return;
    startingRef.current = true;

    try {
      await Tone.start();

      const hatFilter = new Tone.Filter(
        configRef.current.hatCutoff,
        'highpass',
      ).toDestination();
      const hat = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 0.001,
          decay: 0.05,
          sustain: 0,
          release: 0.02,
        },
        volume: -10,
      });
      hat.connect(hatFilter);

      kitRef.current = {
        kick: new Tone.MembraneSynth({
          pitchDecay: 0.08,
          octaves: 4,
          oscillator: { type: 'sine' },
          envelope: {
            attack: 0.001,
            decay: 0.45,
            sustain: 0.02,
            release: 1.3,
          },
        }).toDestination(),

        clap: new Tone.NoiseSynth({
          noise: { type: configRef.current.clapNoise },
          envelope: {
            attack: 0.001,
            decay: 0.18,
            sustain: 0,
            release: 0.04,
          },
          volume: -4,
        }).toDestination(),

        'hi-hat': hat,
        hatFilter,

        synth: new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: {
            attack: 0.02,
            decay: 0.3,
            sustain: 0.4,
            release: 1.2,
          },
          volume: -10,
        }).toDestination(),
      };

      setIsLoaded(true);
    } finally {
      startingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const kit = kitRef.current;
    if (kit) kit.clap.noise.type = config.clapNoise;
  }, [config.clapNoise]);

  useEffect(() => {
    const kit = kitRef.current;
    if (kit) kit.hatFilter.frequency.value = config.hatCutoff;
  }, [config.hatCutoff]);

  const updateConfig = useCallback((partial: Partial<SynthConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const playSample = useCallback(
    (name: SampleName, time?: number) => {
      const kit = kitRef.current;
      if (!kit || !isLoaded) return;

      const cfg = configRef.current;
      const requested = time ?? Tone.now();
      const previous = lastStartRef.current[name] ?? 0;
      const startTime = Math.max(requested, previous + 0.001);
      lastStartRef.current[name] = startTime;

      switch (name) {
        case 'kick':
          kit.kick.triggerAttackRelease(cfg.kickNote, '8n', startTime);
          break;
        case 'clap':
          kit.clap.triggerAttackRelease('16n', startTime);
          break;
        case 'hi-hat':
          kit['hi-hat'].triggerAttackRelease('32n', startTime);
          break;
        case 'synth': {
          const chord = Tone.Frequency(cfg.chordRoot)
            .harmonize(CHORD_INTERVALS[cfg.chordType])
            .map((f) => f.toNote());
          kit.synth.triggerAttackRelease(chord, '2n', startTime);
          break;
        }
      }
    },
    [isLoaded],
  );

  return { start, playSample, isLoaded, config, updateConfig };
}
