// Barcode detector factory. Native BarcodeDetector when it supports our formats; otherwise the
// barcode-detector ponyfill (ZXing-C++ WASM) with the .wasm self-hosted via Vite ?url, so no CDN
// request is ever made and the file is precached for offline use.
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

export const SCAN_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'] as const;

export interface ScanDetector {
  /** Returns the first decoded barcode's raw value, or null. */
  detect(source: HTMLVideoElement): Promise<string | null>;
}

interface DetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

interface NativeCtor {
  new (opts: { formats: string[] }): DetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

function wrap(d: DetectorLike): ScanDetector {
  return {
    async detect(source) {
      const found = await d.detect(source);
      return found[0]?.rawValue ?? null;
    },
  };
}

export async function createDetector(): Promise<ScanDetector> {
  const native = (window as unknown as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
  if (native) {
    try {
      const supported = await native.getSupportedFormats();
      if (SCAN_FORMATS.every((f) => supported.includes(f))) {
        return wrap(new native({ formats: [...SCAN_FORMATS] }));
      }
    } catch {
      // fall through to the ponyfill
    }
  }
  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
  await prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? wasmUrl : prefix + path,
    },
    fireImmediately: true,
  });
  return wrap(new BarcodeDetector({ formats: [...SCAN_FORMATS] }));
}
