import { useEffect, useRef, useState } from 'react';
import type { Hands as HandsClass, Results } from '@mediapipe/hands';
import type { Camera as CameraClass } from '@mediapipe/camera_utils';

type GlobalMediaPipe = {
  Hands: typeof HandsClass;
  Camera: typeof CameraClass;
};

export interface Point {
  x: number;
  y: number;
}

export interface HandState {
  x: number;
  y: number;
  isPinching: boolean;
  thumb: Point;
  index: Point;
}

export interface HandTrackingState {
  hands: HandState[];
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

// Tweak this to taste. MediaPipe coordinates are normalized, so 0.05 ≈ 5% of
// the frame width.
const PINCH_THRESHOLD = 0.09;

export function useHandTracking(): HandTrackingState {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hands, setHands] = useState<HandState[]>([]);

  useEffect(() => {
    if (!videoRef.current) return;

    const videoEl = videoRef.current;

    let handsSolution: HandsClass | null = null;
    let camera: CameraClass | null = null;
    let cancelled = false;

    void (async () => {
      await import('@mediapipe/hands');
      await import('@mediapipe/camera_utils');
      if (cancelled) return;

      const { Hands, Camera } = window as unknown as GlobalMediaPipe;

      const handsInstance = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });
      handsSolution = handsInstance;

      handsInstance.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5,
      });

      handsInstance.onResults((results: Results) => {
        const allLandmarks = results.multiHandLandmarks ?? [];

        setHands(
          allLandmarks.map((landmarks) => {
            const indexTip = landmarks[8];
            const thumbTip = landmarks[4];

            const dx = indexTip.x - thumbTip.x;
            const dy = indexTip.y - thumbTip.y;
            const dz = (indexTip.z ?? 0) - (thumbTip.z ?? 0);
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

            const index = { x: 1 - indexTip.x, y: indexTip.y };
            const thumb = { x: 1 - thumbTip.x, y: thumbTip.y };

            return {
              x: index.x,
              y: index.y,
              isPinching: distance < PINCH_THRESHOLD,
              index,
              thumb,
            };
          }),
        );
      });

      const cameraInstance = new Camera(videoEl, {
        onFrame: async () => {
          await handsInstance.send({ image: videoEl });
        },
        width: 1280,
        height: 720,
      });
      camera = cameraInstance;

      cameraInstance.start();
    })();

    return () => {
      cancelled = true;
      camera?.stop();
      handsSolution?.close();
    };
  }, []);

  return { hands, videoRef };
}