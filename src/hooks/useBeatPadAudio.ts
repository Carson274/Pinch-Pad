import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

export type SampleName =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'hi-hat'
  | 'open-hat'
  | 'tom'
  | 'rim'
  | 'synth';
export type ClapNoise = 'white' | 'pink' | 'brown';
export type ChordName = 'Cmaj' | 'Amin' | 'Fmaj' | 'Gmaj';

export interface SynthConfig {
  kickNote: string;
  clapNoise: ClapNoise;
  hatCutoff: number;
  chord: ChordName;
}

export interface BeatPadAudio {
  start: () => Promise<void>;
  playSample: (name: SampleName, time?: number) => void;
  isLoaded: boolean;
  config: SynthConfig;
  updateConfig: (partial: Partial<SynthConfig>) => void;
  updateFilterFrequency: (openness: number) => void;
}

const EXPRESSION_MIN_HZ = 400;
const EXPRESSION_MAX_HZ = 4000;

export const KICK_NOTES = ['C0', 'E0', 'G0', 'A0', 'C1', 'E1', 'G1', 'C2'];
export const HAT_CUTOFFS = [5000, 6500, 8000, 9500, 11000];
export const CLAP_NOISES: ClapNoise[] = ['white', 'pink', 'brown'];
export const CHORD_NAMES: ChordName[] = ['Cmaj', 'Amin', 'Fmaj', 'Gmaj'];

const CHORD_NOTES: Record<ChordName, string[]> = {
  Cmaj: ['C4', 'E4', 'G4'],
  Amin: ['A3', 'C4', 'E4'],
  Fmaj: ['F3', 'A3', 'C4'],
  Gmaj: ['G3', 'B3', 'D4'],
};

const DEFAULT_CONFIG: SynthConfig = {
  kickNote: 'C1',
  clapNoise: 'white',
  hatCutoff: 8000,
  chord: 'Cmaj',
};

interface Kit {
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  clap: Tone.NoiseSynth;
  'hi-hat': Tone.NoiseSynth;
  'open-hat': Tone.NoiseSynth;
  hatFilter: Tone.Filter;
  tom: Tone.MembraneSynth;
  rim: Tone.MetalSynth;
  synth: Tone.PolySynth;
  synthFilter: Tone.Filter;
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

      const openHat = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 0.001,
          decay: 0.3,
          sustain: 0.04,
          release: 0.25,
        },
        volume: -16,
      });
      openHat.connect(hatFilter);

      const synthFilter = new Tone.Filter(
        EXPRESSION_MAX_HZ,
        'lowpass',
      ).toDestination();
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.02,
          decay: 0.3,
          sustain: 0.4,
          release: 1.2,
        },
        volume: -10,
      });
      synth.connect(synthFilter);

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

        snare: new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: {
            attack: 0.001,
            decay: 0.2,
            sustain: 0,
            release: 0.08,
          },
          volume: -8,
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
        'open-hat': openHat,
        hatFilter,

        tom: new Tone.MembraneSynth({
          pitchDecay: 0.1,
          octaves: 3,
          oscillator: { type: 'sine' },
          envelope: {
            attack: 0.001,
            decay: 0.4,
            sustain: 0.01,
            release: 0.6,
          },
          volume: -4,
        }).toDestination(),

        rim: new Tone.MetalSynth({
          harmonicity: 8,
          modulationIndex: 18,
          resonance: 5000,
          octaves: 1,
          envelope: {
            attack: 0.001,
            decay: 0.04,
            release: 0.02,
          },
          volume: -20,
        }).toDestination(),

        synth,
        synthFilter,
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

  const updateFilterFrequency = useCallback((openness: number) => {
    const kit = kitRef.current;
    if (!kit) return;
    const clamped = Math.min(1, Math.max(0, openness));
    const freq =
      EXPRESSION_MIN_HZ + clamped * (EXPRESSION_MAX_HZ - EXPRESSION_MIN_HZ);
    kit.synthFilter.frequency.rampTo(freq, 0.08);
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
        case 'snare':
          kit.snare.triggerAttackRelease('16n', startTime);
          break;
        case 'clap':
          kit.clap.triggerAttackRelease('16n', startTime);
          break;
        case 'hi-hat':
          kit['hi-hat'].triggerAttackRelease('32n', startTime);
          break;
        case 'open-hat':
          kit['open-hat'].triggerAttackRelease('8n', startTime);
          break;
        case 'tom':
          kit.tom.triggerAttackRelease('G2', '8n', startTime);
          break;
        case 'rim':
          kit.rim.triggerAttackRelease('C7', '32n', startTime);
          break;
        case 'synth':
          kit.synth.triggerAttackRelease(
            CHORD_NOTES[cfg.chord],
            '2n',
            startTime,
          );
          break;
      }
    },
    [isLoaded],
  );

  return { start, playSample, isLoaded, config, updateConfig, updateFilterFrequency };
}
