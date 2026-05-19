import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import type { SampleName } from './useBeatPadAudio';

const DEFAULT_BPM = 120;
const LOOP_BARS = 4;
const BEATS_PER_BAR = 4;

interface RecordedNote {
  ticks: number;
  sample: SampleName;
}

export interface LoopStation {
  isRecording: boolean;
  isPlaying: boolean;
  toggleRecord: () => void;
  togglePlay: () => void;
  recordHit: (sample: SampleName) => void;
  loopProgress: number;
  clearLoop: () => void;
}

export function useLoopStation(
  playSample: (name: SampleName, time?: number) => void,
): LoopStation {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState<RecordedNote[]>([]);
  const [loopProgress, setLoopProgress] = useState(0);

  const playSampleRef = useRef(playSample);
  useEffect(() => {
    playSampleRef.current = playSample;
  }, [playSample]);

  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const eventIdsRef = useRef<number[]>([]);

  useEffect(() => {
    const transport = Tone.getTransport();
    transport.bpm.value = DEFAULT_BPM;
    transport.loop = true;
    transport.loopStart = 0;
    transport.loopEnd = `${LOOP_BARS}m`;
    return () => {
      transport.stop();
      transport.cancel();
    };
  }, []);

  useEffect(() => {
    const transport = Tone.getTransport();
    for (const id of eventIdsRef.current) {
      transport.clear(id);
    }
    eventIdsRef.current = recordedNotes.map((note) =>
      transport.schedule((time) => {
        playSampleRef.current(note.sample, time);
      }, `${note.ticks}i`),
    );
  }, [recordedNotes]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setLoopProgress(Tone.getTransport().progress);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const recordHit = useCallback((sample: SampleName) => {
    if (!isRecordingRef.current) return;
    const transport = Tone.getTransport();
    const sixteenth = transport.PPQ / 4;
    const loopTicks = LOOP_BARS * BEATS_PER_BAR * transport.PPQ;
    const quantized =
      (Math.round(transport.ticks / sixteenth) * sixteenth) % loopTicks;
    setRecordedNotes((prev) => [...prev, { ticks: quantized, sample }]);
  }, []);

  const togglePlay = useCallback(() => {
    const transport = Tone.getTransport();
    if (transport.state === 'started') {
      transport.stop();
      setIsPlaying(false);
    } else {
      transport.start();
      setIsPlaying(true);
    }
  }, []);

  const toggleRecord = useCallback(() => {
    const transport = Tone.getTransport();
    if (transport.state !== 'started') {
      transport.start();
      setIsPlaying(true);
    }
    setIsRecording((recording) => !recording);
  }, []);

  const clearLoop = useCallback(() => {
    setRecordedNotes([]);
  }, []);

  return {
    isRecording,
    isPlaying,
    toggleRecord,
    togglePlay,
    recordHit,
    loopProgress,
    clearLoop,
  };
}
