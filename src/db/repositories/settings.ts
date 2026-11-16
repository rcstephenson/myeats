import { DEFAULT_SETTINGS, type Settings } from '../../domain/types';
import { db } from '../schema';

export type SettingsPatch = Partial<Omit<Settings, 'key'>>;

/** Stored settings merged over DEFAULT_SETTINGS; unknown keys are dropped. */
function merge(stored: Partial<Settings> | undefined): Settings {
  const next: Settings = { key: 'app', ...DEFAULT_SETTINGS };
  if (stored?.theme) next.theme = stored.theme;
  if (stored?.usdaApiKey !== undefined) next.usdaApiKey = stored.usdaApiKey;
  if (stored?.summaryMoreOpen !== undefined) next.summaryMoreOpen = stored.summaryMoreOpen;
  return next;
}

export async function get(): Promise<Settings> {
  return merge(await db.settings.get('app'));
}

/** Merges the patch into the stored settings. */
export async function update(patch: SettingsPatch): Promise<Settings> {
  return db.transaction('rw', db.settings, async () => {
    const next = merge({ ...(await get()), ...patch });
    await db.settings.put(next);
    return next;
  });
}
