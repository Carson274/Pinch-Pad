import { useCallback, useRef, useState } from 'react';
import * as Tone from 'tone';

export type SampleName = 'kick' | 'clap' | 'hi-hat' | 'synth';

export interface BeatPadAudio {
  start: () => Promise<void>;
  playSample: (name: SampleName, time?: number) => void;
  isLoaded: boolean;
}

const SAMPLE_MAP: Record<SampleName, string> = {
  kick: '/samples/kick.wav',
  clap: '/samples/clap.wav',
  'hi-hat': '/samples/hi-hat.wav',
  synth: '/samples/synth.wav',
};

export function useBeatPadAudio(): BeatPadAudio {
  const playersRef = useRef<Tone.Players | null>(null);
  const startingRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const start = useCallback(async () => {
    // Guard against double-init from rapid clicks.
    if (playersRef.current || startingRef.current) return;
    startingRef.current = true;

    try {
      // Must run inside a user gesture — that's the whole point of this fn.
      await Tone.start();

      const players = new Tone.Players(SAMPLE_MAP).toDestination();
      playersRef.current = players;

      // Tone.loaded() resolves once every buffer registered with the
      // global context (including these players) is decoded.
      await Tone.loaded();
      setIsLoaded(true);
    } finally {
      startingRef.current = false;
    }
  }, []);

  const lastStartRef = useRef<Partial<Record<SampleName, number>>>({});

  const playSample = useCallback((name: SampleName, time?: number) => {
    const players = playersRef.current;
    if (!players || !isLoaded) return;
    const player = players.player(name);
    const requested = time ?? Tone.now();
    const previous = lastStartRef.current[name] ?? 0;
    const startTime = Math.max(requested, previous + 0.001);
    lastStartRef.current[name] = startTime;
    player.start(startTime);
  }, [isLoaded]);

  return { start, playSample, isLoaded };
}