/**
 * データアクセス層。
 * MVPはデモデータ実装のみ。Phase 3 で Supabase 実装を追加し、
 * 環境変数（NEXT_PUBLIC_SUPABASE_URL 等）の有無で切り替える。
 * 画面側はこのインターフェースだけに依存する。
 */
import { DEMO_FACILITIES } from "@/data/demo";
import { searchFacilities } from "./search";
import type { Facility, SearchFilters, SearchResult } from "./types";

export interface FacilityRepository {
  readonly isDemo: boolean;
  search(filters: SearchFilters): Promise<SearchResult[]>;
  getById(id: string): Promise<Facility | null>;
  listIds(): Promise<string[]>;
  /** 掲載のある市区町村（都道府県ごと） */
  listCities(): Promise<Record<number, string[]>>;
  /** 都道府県ごとの掲載数 */
  countByPrefecture(): Promise<Record<number, number>>;
}

class DemoRepository implements FacilityRepository {
  readonly isDemo = true;
  constructor(private readonly data: Facility[]) {}

  async search(filters: SearchFilters) {
    return searchFacilities(this.data, filters);
  }
  async getById(id: string) {
    return this.data.find((f) => f.id === id) ?? null;
  }
  async listIds() {
    return this.data.map((f) => f.id);
  }
  async listCities() {
    const out: Record<number, string[]> = {};
    for (const f of this.data) {
      const list = (out[f.prefectureCode] ??= []);
      if (!list.includes(f.city)) list.push(f.city);
    }
    for (const k of Object.keys(out)) out[Number(k)].sort((a, b) => a.localeCompare(b, "ja"));
    return out;
  }
  async countByPrefecture() {
    const out: Record<number, number> = {};
    for (const f of this.data) out[f.prefectureCode] = (out[f.prefectureCode] ?? 0) + 1;
    return out;
  }
}

let repo: FacilityRepository | null = null;

export function getRepository(): FacilityRepository {
  repo ??= new DemoRepository(DEMO_FACILITIES);
  return repo;
}
