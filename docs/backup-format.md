# Backup format

Settings > Data > **Export backup** writes `myeats-backup-YYYY-MM-DD.json` (via the share sheet on iOS when available, otherwise a download). The file is compact JSON (no indentation):

```json
{
  "app": "myeats",
  "backupVersion": 1,
  "exportedAt": "2026-03-01T09:30:00.000Z",
  "data": {
    "foods": [],
    "recipes": [],
    "meals": [],
    "entries": [],
    "categories": [],
    "goals": [],
    "weighIns": []
  }
}
```

Every array holds the rows of the matching table exactly as stored (types in `src/domain/types.ts`, SPEC section 4). Not included: `settings` (theme, USDA key: per device) and `searchCache` (a network cache). Dexie Cloud's `realmId` / `owner` fields are stripped.

## Validation

Import validates with Zod (`src/lib/backup.ts`, `BackupSchema`) before anything is written; an invalid file changes nothing and the error names the failing path (for example `data.entries[3].date: must be YYYY-MM-DD`).

- `app` must be `"myeats"` and `backupVersion` must be `1`.
- Every table array must be present; rows need their required fields with the right types (nutrients are numbers or `null`, dates are `YYYY-MM-DD`, category `startsAt` is `HH:MM` or `null`).
- Unknown extra fields (on the file, on `data` or on rows) are ignored, so older apps can read files written by slightly newer ones.

## Import modes

- **Merge** upserts every row by `id` and keeps everything else. Goals are unique per `effectiveFrom` and weigh-ins per `date`: an incoming row with a different id but the same date replaces the local one.
- **Replace** clears the seven data tables first, then writes the file. It needs a typed `DELETE` confirmation. If the file has no categories the default ones are re-created so the app always has at least one.

Settings and the search cache are never touched by an import.

## Clear all data

Settings > Data > **Clear all data** (typed `DELETE`) empties every table including settings and the search cache, then re-seeds the default categories and settings. When signed in to sync this deletion syncs too.

## Changing the format

Bump `backupVersion` and keep a reader for every older version. Never change the meaning of an existing field.
