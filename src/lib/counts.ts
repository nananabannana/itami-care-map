import { cacheLife, cacheTag } from "next/cache";
import { getRepository } from "./repository";

/**
 * 都道府県別の掲載医療機関数（0件の都道府県は含まれないことがあるので呼び出し側で0扱い）。
 * 数分単位でキャッシュし、Supabase の登録内容を反映する。
 * 管理画面（Phase 3）で更新したときは updateTag("prefecture-counts") で即時反映する。
 */
export async function getPrefectureCounts(): Promise<Record<number, number>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("prefecture-counts");
  return getRepository().countByPrefecture();
}

export async function getCitiesByPrefecture(): Promise<Record<number, string[]>> {
  "use cache";
  cacheLife("minutes");
  cacheTag("prefecture-counts");
  return getRepository().listCities();
}
