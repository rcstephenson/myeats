import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../components/ui';
import { createConfirmer } from './confirm';
import { createDetector } from './detector';

declare global {
  interface Window {
    /** E2E/dev hook: simulate a detected barcode while the scanner is mounted. */
    __myeatsInjectBarcode?: (code: string) => void;
  }
}

export interface ScannerViewProps {
  onDetected(code: string): void;
  onClose(): void;
}

const SCAN_INTERVAL_MS = 150;
const MIN_DIGITS = 8;

function e2eFlag(): boolean {
  try {
    return localStorage.getItem('myeats:e2e') === '1';
  } catch {
    return false;
  }
}

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

export default function ScannerView({ onDetected, onClose }: ScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [manual, setManual] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const [digits, setDigits] = useState('');

  const foundRef = useRef(false);
  const accept = useCallback((code: string) => {
    if (foundRef.current) return;
    foundRef.current = true;
    setFound(code);
    // Brief visual confirmation (iOS has no vibrate), then hand off.
    window.setTimeout(() => onDetectedRef.current(code), 250);
  }, []);

  // Test hook.
  useEffect(() => {
    if (import.meta.env.MODE === 'production' && !e2eFlag()) return;
    window.__myeatsInjectBarcode = (code: string) => onDetectedRef.current(code);
    return () => {
      delete window.__myeatsInjectBarcode;
    };
  }, []);

  // Camera + decode loop.
  useEffect(() => {
    if (e2eFlag()) return;
    let cancelled = false;
    let loopStop: (() => void) | null = null;

    const stopCamera = () => {
      loopStop?.();
      loopStop = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setTorchOn(false);
    };

    const start = async () => {
      if (streamRef.current || foundRef.current) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setNotice('Camera is not available.');
        setManual(true);
        return;
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (e) {
        if (cancelled) return;
        const denied = e instanceof DOMException && e.name === 'NotAllowedError';
        setNotice(denied ? 'Camera access was denied.' : 'No camera found.');
        setManual(true);
        return;
      }
      if (cancelled || document.hidden) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
      setTorchSupported(Boolean(caps?.torch));
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // autoplay is set; ignore interruption errors
      }
      let detector;
      try {
        detector = await createDetector();
      } catch {
        if (!cancelled) {
          setNotice('Scanning is unavailable.');
          setManual(true);
        }
        return;
      }
      if (cancelled || streamRef.current !== stream) return;

      const confirmer = createConfirmer();
      const v = video as VideoWithRvfc;
      let timer = 0;
      let rvfcId = 0;
      let stopped = false;
      let busy = false;
      let lastRun = 0;

      const tick = async () => {
        if (stopped || busy || v.readyState < 2) return;
        const now = performance.now();
        if (now - lastRun < SCAN_INTERVAL_MS) return;
        lastRun = now;
        busy = true;
        try {
          const code = await detector.detect(v);
          if (stopped) return;
          const ok = confirmer.push(code);
          if (ok) {
            stopped = true;
            accept(ok);
          }
        } catch {
          confirmer.push(null);
        } finally {
          busy = false;
        }
      };

      if (v.requestVideoFrameCallback) {
        const onFrame = () => {
          void tick();
          if (!stopped) rvfcId = v.requestVideoFrameCallback!(onFrame);
        };
        rvfcId = v.requestVideoFrameCallback(onFrame);
      } else {
        timer = window.setInterval(() => void tick(), SCAN_INTERVAL_MS);
      }
      loopStop = () => {
        stopped = true;
        if (timer) window.clearInterval(timer);
        if (rvfcId) v.cancelVideoFrameCallback?.(rvfcId);
      };
    };

    const onVisibility = () => {
      if (document.hidden) stopCamera();
      else void start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    void start();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stopCamera();
    };
  }, [accept]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  };

  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    if (digits.length >= MIN_DIGITS) onDetected(digits);
  };

  const cornerBase = 'absolute h-6 w-6 border-accent-ink';

  return (
    <div
      role="dialog"
      aria-label="Scan barcode"
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg text-ink"
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
      />

      {!manual && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            data-testid="scan-guide"
            className={`relative h-[28dvh] w-[84vw] max-w-md border-2 ${
              found ? 'border-accent-ink bg-accent/30' : 'border-accent-ink'
            }`}
            style={{ boxShadow: '0 0 0 100vmax var(--scrim)' }}
          >
            <span className={`${cornerBase} -left-0.5 -top-0.5 border-l-4 border-t-4`} />
            <span className={`${cornerBase} -right-0.5 -top-0.5 border-r-4 border-t-4`} />
            <span className={`${cornerBase} -bottom-0.5 -left-0.5 border-b-4 border-l-4`} />
            <span className={`${cornerBase} -bottom-0.5 -right-0.5 border-b-4 border-r-4`} />
          </div>
        </div>
      )}

      <div
        className="relative flex justify-end p-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <button
          type="button"
          aria-label="Close scanner"
          onClick={onClose}
          className="inline-flex min-h-touch min-w-touch items-center justify-center rounded-btn border border-hairline bg-raised text-lg text-ink"
        >
          ✕
        </button>
      </div>

      <div className="relative flex-1">
        {found && (
          <p
            role="status"
            className="absolute inset-x-0 top-4 text-center font-mono text-base font-semibold text-on-accent"
          >
            <span className="bg-accent px-3 py-1">{found}</span>
          </p>
        )}
      </div>

      <div
        className="relative flex flex-col gap-3 bg-bg p-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        {notice && <p className="text-sm text-muted">{notice} Enter the barcode instead.</p>}
        {manual ? (
          <form onSubmit={submitManual} className="flex gap-2">
            <input
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              aria-label="Barcode digits"
              placeholder="Barcode digits"
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 14))}
              className="min-h-touch min-w-0 flex-1 rounded-btn border border-hairline-strong bg-raised px-3 font-mono text-base text-ink"
            />
            <Button type="submit" disabled={digits.length < MIN_DIGITS}>
              Look up
            </Button>
          </form>
        ) : (
          <div className="flex gap-2">
            {torchSupported && (
              <Button
                variant="secondary"
                aria-pressed={torchOn}
                onClick={() => void toggleTorch()}
                className="flex-1"
              >
                {torchOn ? 'Torch on' : 'Torch'}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setManual(true)} className="flex-1">
              Enter barcode
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
