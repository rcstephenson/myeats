import * as foodRepo from '../../db/repositories/foods';
import type { Food, RemoteFood } from '../../domain/types';
import { getUsdaDetails } from '../../sources/usda';

/**
 * Stores a remote (USDA/OFF) result in the local foods table and returns it. For generic USDA foods
 * (Foundation, SR Legacy) it then fetches their portions in the background and saves them as
 * servings; `onServings` gets the updated food when that finishes. Failures there are ignored:
 * grams still work.
 */
export async function saveRemoteFood(
  remote: RemoteFood,
  apiKey: string,
  onServings?: (food: Food) => void,
): Promise<Food> {
  const food = await foodRepo.upsertRemote(remote);
  const generic = remote.dataType === 'Foundation' || remote.dataType === 'SR Legacy';
  if (generic && remote.sourceId && food.servings.length === 0) {
    void (async () => {
      try {
        const servings = await getUsdaDetails(remote.sourceId!, { apiKey });
        const latest = await foodRepo.get(food.id);
        if (servings.length > 0 && latest) {
          const saved = await foodRepo.save({ ...latest, servings });
          onServings?.(saved);
        }
      } catch {
        // Servings are a nicety; grams still work.
      }
    })();
  }
  return food;
}
