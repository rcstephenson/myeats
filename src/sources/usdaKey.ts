export type UsdaKeySource = 'device' | 'build' | 'demo';

/** Per-device key (Settings) beats the build-time key; DEMO_KEY is the heavily rate-limited fallback. */
export function resolveUsdaKey(deviceKey: string | null): { key: string; source: UsdaKeySource } {
  const device = deviceKey?.trim();
  if (device) return { key: device, source: 'device' };
  const build = import.meta.env.VITE_USDA_API_KEY?.trim();
  if (build) return { key: build, source: 'build' };
  return { key: 'DEMO_KEY', source: 'demo' };
}
