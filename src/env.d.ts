interface ImportMetaEnv {
  /** Dexie Cloud database URL (https://xxxx.dexie.cloud). Unset = cloud sync disabled. */
  readonly VITE_DEXIE_CLOUD_URL?: string;
  /** USDA FoodData Central API key. Unset = DEMO_KEY (heavily rate-limited). */
  readonly VITE_USDA_API_KEY?: string;
}
