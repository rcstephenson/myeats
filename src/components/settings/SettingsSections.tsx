import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Button } from '../ui';
import { settings as settingsRepo } from '../../db/repositories';
import type { Settings } from '../../domain/types';
import { OfflineError, RateLimitError, SourceError, isAbortError } from '../../sources/errors';
import { searchUsda } from '../../sources/usda';
import { resolveUsdaKey, type UsdaKeySource } from '../../sources/usdaKey';
import { version } from '../../../package.json';
import { Segmented, SettingsGroup, SettingsRow } from './SettingsGroup';

function LinkRow({ to, label, description }: { to: string; label: string; description: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-touch items-center justify-between gap-3 px-3 py-2.5 active:bg-raised"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        <div className="text-xs text-muted">{description}</div>
      </div>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted" />
    </Link>
  );
}

export function TargetsSection() {
  return (
    <SettingsGroup title="Targets" index={1}>
      <LinkRow
        to="/settings/goals"
        label="Goals"
        description="Daily calories and nutrient targets"
      />
      <LinkRow
        to="/settings/categories"
        label="Categories"
        description="Meals of the day: names, order and start times"
      />
    </SettingsGroup>
  );
}

export function AppearanceSection({ settings }: { settings: Settings }) {
  return (
    <SettingsGroup title="Appearance" index={2}>
      <SettingsRow label="Theme">
        <Segmented
          label="Theme"
          value={settings.theme}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
          onChange={(theme) => void settingsRepo.update({ theme })}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}

const KEY_SOURCE_LABEL: Record<UsdaKeySource, string> = {
  device: 'Using the key saved on this device',
  build: 'Using the key built into this app',
  demo: 'Using DEMO_KEY',
};

export type KeyTestResult = { kind: 'ok' | 'error'; text: string };

/** Maps a failed USDA call to a short message for the Test button. */
export function describeKeyTestError(err: unknown): string {
  if (err instanceof RateLimitError) {
    return 'Rate limit reached (HTTP 429). Wait a while or use your own free key.';
  }
  if (err instanceof OfflineError) return 'You are offline. Try again when connected.';
  if (err instanceof SourceError && (err.status === 400 || err.status === 403)) {
    return `The key was rejected (HTTP ${err.status}). Check it and try again.`;
  }
  return `Test failed: ${err instanceof Error ? err.message : 'unknown error'}`;
}

export function FoodDatabaseSection({ settings }: { settings: Settings }) {
  const [draft, setDraft] = useState(settings.usdaApiKey ?? '');
  const [result, setResult] = useState<KeyTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const resolved = resolveUsdaKey(settings.usdaApiKey);
  const trimmed = draft.trim();
  const saved = settings.usdaApiKey ?? '';

  useEffect(() => () => controller.current?.abort(), []);

  const test = async () => {
    controller.current?.abort();
    const ctl = new AbortController();
    controller.current = ctl;
    setTesting(true);
    setResult(null);
    try {
      // Test what is typed (so a key can be checked before saving), else the key in use.
      await searchUsda('apple', { apiKey: trimmed || resolved.key, signal: ctl.signal });
      setResult({ kind: 'ok', text: 'Key works.' });
    } catch (err) {
      if (isAbortError(err)) return;
      setResult({ kind: 'error', text: describeKeyTestError(err) });
    } finally {
      if (controller.current === ctl) setTesting(false);
    }
  };

  return (
    <>
      <SettingsGroup title="Food database" index={3}>
        <SettingsRow label="USDA API key" description={KEY_SOURCE_LABEL[resolved.source]}>
          <span data-testid="key-source" className="num text-xs uppercase text-muted">
            {resolved.source}
          </span>
        </SettingsRow>
        {resolved.source === 'demo' ? (
          <p role="note" className="px-3 py-2.5 text-xs text-danger">
            DEMO_KEY is heavily rate-limited and may stop searches working. Get a free key and save
            it below.
          </p>
        ) : null}
        <div className="flex flex-col gap-2 px-3 py-2.5">
          <label htmlFor="usda-key" className="text-sm font-medium text-ink">
            Device key
          </label>
          <input
            id="usda-key"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setResult(null);
            }}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            placeholder="Paste your API key"
            className="num min-h-touch w-full rounded-btn border border-hairline-strong bg-bg px-3 text-base text-ink"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={trimmed === saved}
              onClick={() => void settingsRepo.update({ usdaApiKey: trimmed || null })}
            >
              Save key
            </Button>
            <Button
              variant="secondary"
              disabled={saved === '' && draft === ''}
              onClick={() => {
                setDraft('');
                setResult(null);
                void settingsRepo.update({ usdaApiKey: null });
              }}
            >
              Clear
            </Button>
            <Button variant="secondary" disabled={testing} onClick={() => void test()}>
              {testing ? 'Testing…' : 'Test'}
            </Button>
          </div>
          {result ? (
            <p
              role={result.kind === 'error' ? 'alert' : 'status'}
              className={`num text-xs ${result.kind === 'error' ? 'text-danger' : 'text-ink'}`}
            >
              {result.text}
            </p>
          ) : null}
          <a
            href="https://fdc.nal.usda.gov/api-key-signup"
            target="_blank"
            rel="noreferrer"
            className="min-h-touch content-center text-sm font-medium text-accent underline"
          >
            Get a free USDA API key
          </a>
        </div>
        <p className="px-3 py-2.5 text-xs text-muted">
          Food data from USDA FoodData Central and Open Food Facts (ODbL)
        </p>
      </SettingsGroup>
    </>
  );
}

export function AboutSection() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const value = await navigator.storage?.persisted?.();
        if (alive) setPersisted(typeof value === 'boolean' ? value : false);
      } catch {
        if (alive) setPersisted(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SettingsGroup title="About" index={7}>
      <SettingsRow label="Version">
        <span data-testid="app-version" className="num text-sm text-muted">
          {version}
        </span>
      </SettingsRow>
      <SettingsRow
        label="Storage"
        description={
          persisted === false
            ? 'Not protected: Safari may clear data from sites that are not installed. Add myeats to your Home Screen and export backups regularly.'
            : persisted
              ? 'Protected from automatic clean-up'
              : 'Checking…'
        }
      >
        <span data-testid="storage-status" className="num text-xs uppercase text-muted">
          {persisted === null ? '…' : persisted ? 'Persistent' : 'Not persistent'}
        </span>
      </SettingsRow>
    </SettingsGroup>
  );
}
