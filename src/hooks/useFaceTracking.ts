import { useEffect, useRef, useState } from 'react';
import type { FaceMesh as FaceMeshClass, Results } from '@mediapipe/face_mesh';

type GlobalFaceMesh = {
  FaceMesh: typeof FaceMeshClass;
};

export interface LipBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FaceTrackingState {
  mouthOpenness: number;
  isFaceDetected: boolean;
  lipBox: LipBox | null;
}

const MOUTH_CLOSED_RATIO = 0.02;
const MOUTH_OPEN_RATIO = 0.13;
const SMOOTHING = 0.35;
const LIP_LANDMARKS = [61, 291, 0, 13, 14, 17];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function useFaceTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): FaceTrackingState {
  const [mouthOpenness, setMouthOpenness] = useState(0);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [lipBox, setLipBox] = useState<LipBox | null>(null);
  const smoothedRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const videoEl = videoRef.current;
    if (!videoEl) return;

    smoothedRef.current = 0;

    let faceMesh: FaceMeshClass | null = null;
    let raf = 0;
    let cancelled = false;

    void (async () => {
      await import('@mediapipe/face_mesh');
      if (cancelled) return;

      const { FaceMesh } = window as unknown as GlobalFaceMesh;

      const mesh = new FaceMesh({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      faceMesh = mesh;

      mesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      mesh.onResults((results: Results) => {
        const landmarks = results.multiFaceLandmarks?.[0];
        if (!landmarks) {
          setIsFaceDetected(false);
          setLipBox(null);
          return;
        }
        setIsFaceDetected(true);

        const upperLip = landmarks[13];
        const lowerLip = landmarks[14];
        const foreheadTop = landmarks[10];
        const chin = landmarks[152];

        const mouthGap = Math.hypot(
          upperLip.x - lowerLip.x,
          upperLip.y - lowerLip.y,
        );
        const faceHeight =
          Math.hypot(foreheadTop.x - chin.x, foreheadTop.y - chin.y) || 1;
        const ratio = mouthGap / faceHeight;
        const target = clamp01(
          (ratio - MOUTH_CLOSED_RATIO) /
            (MOUTH_OPEN_RATIO - MOUTH_CLOSED_RATIO),
        );

        smoothedRef.current += (target - smoothedRef.current) * SMOOTHING;
        setMouthOpenness(smoothedRef.current);

        let minX = 1;
        let maxX = 0;
        let minY = 1;
        let maxY = 0;
        for (const id of LIP_LANDMARKS) {
          const mx = 1 - landmarks[id].x;
          const my = landmarks[id].y;
          if (mx < minX) minX = mx;
          if (mx > maxX) maxX = mx;
          if (my < minY) minY = my;
          if (my > maxY) maxY = my;
        }
        setLipBox({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
      });

      const tick = async () => {
        if (cancelled) return;
        if (videoEl.readyState >= 2) {
          await mesh.send({ image: videoEl });
        }
        if (!cancelled) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      faceMesh?.close();
    };
  }, [enabled, videoRef]);

  return { mouthOpenness, isFaceDetected, lipBox };
}
