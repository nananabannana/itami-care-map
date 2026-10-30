/**
 * Supabase 実装の FacilityRepository。
 * 環境変数 SUPABASE_URL と SUPABASE_ANON_KEY があるときに使用する（サーバー側のみ）。
 *
 * 取得は公開済みデータのみ（RLS で担保）。
 * 検索は MVP 段階では公開済み医療機関を一括取得してアプリ側で絞り込む。
 * 掲載数が数千件規模になったら、都道府県・処置で SQL 側に絞り込みを移す。
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { searchFacilities } from "./search";
import type {
  CareItemKey,
  CareStatus,
  EvidenceStatus,
  ExtraFee,
  Facility,
  SearchFilters,
  SourceType,
  SupportStatus,
} from "./types";
import type { FacilityRepository } from "./repository";

/** PostgREST の埋め込み select の結果（必要な列のみ） */
export interface FacilityRow {
  slug: string;
  name: string;
  prefecture_code: number;
  address: string;
  phone: string | null;
  website_url: string | null;
  latitude: number | null;
  longitude: number | null;
  facility_type: "clinic" | "hospital";
  departments: string[];
  nearest_stations: string[];
  consultation_hours: string | null;
  is_demo: boolean;
  municipalities: { name: string } | null;
  sources: {
    id: string;
    source_type: SourceType;
    source_url: string | null;
    source_title: string;
    evidence_excerpt: string | null;
    contacted_department: string | null;
    checked_at: string;
  }[];
  facility_procedure_support: {
    support_status: SupportStatus;
    conditions: string | null;
    schedule_note: string | null;
    extra_fee: ExtraFee;
    extra_fee_note: string | null;
    notes: string | null;
    evidence_status: EvidenceStatus;
    source_id: string | null;
    verified_at: string | null;
    procedures: { slug: string } | null;
    anesthesia_methods: { slug: string } | null;
  }[];
  facility_care_items: {
    care_item: CareItemKey;
    status: CareStatus;
    note: string | null;
    evidence_status: EvidenceStatus;
    source_id: string | null;
    verified_at: string | null;
  }[];
}

export const FACILITY_SELECT = `
  slug, name, prefecture_code, address, phone, website_url, latitude, longitude,
  facility_type, departments, nearest_stations, consultation_hours, is_demo,
  municipalities ( name ),
  sources ( id, source_type, source_url, source_title, evidence_excerpt, contacted_department, checked_at ),
  facility_procedure_support ( support_status, conditions, schedule_note, extra_fee, extra_fee_note, notes,
    evidence_status, source_id, verified_at, procedures ( slug ), anesthesia_methods ( slug ) ),
  facility_care_items ( care_item, status, note, evidence_status, source_id, verified_at )
`;

const u = <T,>(v: T | null): T | undefined => (v === null ? undefined : v);

/** DBの行 → アプリの Facility。URLには slug を使う */
export function rowToFacility(r: FacilityRow): Facility {
  return {
    id: r.slug,
    name: r.name,
    prefectureCode: r.prefecture_code,
    city: r.municipalities?.name ?? "",
    address: r.address,
    phone: u(r.phone),
    websiteUrl: u(r.website_url),
    latitude: u(r.latitude),
    longitude: u(r.longitude),
    facilityType: r.facility_type,
    departments: r.departments ?? [],
    nearestStations: r.nearest_stations ?? [],
    consultationHours: u(r.consultation_hours),
    isDemo: r.is_demo,
    basicInfoSourceId: r.sources.find((s) => s.source_type === "public_registry")?.id,
    sources: r.sources.map((s) => ({
      id: s.id,
      sourceType: s.source_type,
      sourceUrl: u(s.source_url),
      sourceTitle: s.source_title,
      evidenceExcerpt: u(s.evidence_excerpt),
      contactedDepartment: u(s.contacted_department),
      checkedAt: s.checked_at,
    })),
    support: r.facility_procedure_support
      .filter((s) => s.procedures && s.anesthesia_methods)
      .map((s) => ({
        procedureSlug: s.procedures!.slug,
        methodSlug: s.anesthesia_methods!.slug,
        supportStatus: s.support_status,
        conditions: u(s.conditions),
        scheduleNote: u(s.schedule_note),
        extraFee: s.extra_fee,
        extraFeeNote: u(s.extra_fee_note),
        notes: u(s.notes),
        evidenceStatus: s.evidence_status,
        sourceId: u(s.source_id),
        verifiedAt: u(s.verified_at),
      })),
    care: r.facility_care_items.map((c) => ({
      key: c.care_item,
      status: c.status,
      note: u(c.note),
      evidenceStatus: c.evidence_status,
      sourceId: u(c.source_id),
      verifiedAt: u(c.verified_at),
    })),
  };
}

export class SupabaseRepository implements FacilityRepository {
  readonly isDemo = false;
  private readonly db: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.db = createClient(url, anonKey, { auth: { persistSession: false } });
  }

  private async fetchAll(): Promise<Facility[]> {
    const { data, error } = await this.db
      .from("facilities")
      .select(FACILITY_SELECT)
      .eq("is_published", true)
      .order("name");
    if (error) throw new Error(`医療機関の取得に失敗しました: ${error.message}`);
    return (data as unknown as FacilityRow[]).map(rowToFacility);
  }

  async search(filters: SearchFilters) {
    return searchFacilities(await this.fetchAll(), filters);
  }

  async getById(id: string) {
    const { data, error } = await this.db
      .from("facilities")
      .select(FACILITY_SELECT)
      .eq("is_published", true)
      .eq("slug", id)
      .maybeSingle();
    if (error) throw new Error(`医療機関の取得に失敗しました: ${error.message}`);
    return data ? rowToFacility(data as unknown as FacilityRow) : null;
  }

  async listIds() {
    const { data, error } = await this.db.from("facilities").select("slug").eq("is_published", true);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.slug as string);
  }

  async listCities() {
    const out: Record<number, string[]> = {};
    for (const f of await this.fetchAll()) {
      if (!f.city) continue;
      const list = (out[f.prefectureCode] ??= []);
      if (!list.includes(f.city)) list.push(f.city);
    }
    for (const k of Object.keys(out)) out[Number(k)].sort((a, b) => a.localeCompare(b, "ja"));
    return out;
  }

  async countByPrefecture() {
    const { data, error } = await this.db.from("public_prefecture_counts").select("prefecture_code, facility_count");
    if (error) throw new Error(`都道府県別件数の取得に失敗しました: ${error.message}`);
    const out: Record<number, number> = {};
    for (const r of data ?? []) out[r.prefecture_code as number] = r.facility_count as number;
    return out;
  }
}
