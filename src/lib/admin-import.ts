import "server-only";
import type { JalaRecord } from "./import/jala";
import { findMatch, planNaviiImport, type IndexEntry } from "./import/match";
import type { NaviiKind, NaviiRecord } from "./import/navii";
import type { AdminSession } from "./supabase-server";

type Client = AdminSession["client"];

const PAGE = 1000;

/** Supabase の1回の取得上限（1000件）を超えて全件取る */
async function selectAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

type FacilityIdxRow = {
  id: string; navii_key: string | null; name: string; prefecture_code: number; address: string; city: string | null;
  phone: string | null; latitude: number | null; longitude: number | null; website_url: string | null;
  consultation_hours: string | null; departments: string[] | null;
};
type CandidateIdxRow = FacilityIdxRow & { status: string; matched_facility_id: string | null };

const FAC_COLS = "id, navii_key, name, prefecture_code, address, city, phone, latitude, longitude, website_url, consultation_hours, departments";

const toEntry = (type: "facility" | "candidate") => (r: FacilityIdxRow | CandidateIdxRow): IndexEntry => ({
  id: r.id,
  type,
  naviiKey: r.navii_key,
  name: r.name,
  prefectureCode: r.prefecture_code,
  address: r.address,
  city: r.city,
  phone: r.phone,
  latitude: r.latitude,
  longitude: r.longitude,
  websiteUrl: r.website_url,
  consultationHours: r.consultation_hours,
  departments: r.departments,
  ...("status" in r ? { status: r.status, matchedFacilityId: r.matched_facility_id } : {}),
});

/** 重複判定用の索引：掲載施設（すべて）＋指定した都道府県の候補 */
export async function buildMatchIndex(client: Client, prefCodes: number[]): Promise<IndexEntry[]> {
  const facilities = await selectAll<FacilityIdxRow>((a, b) => client.from("facilities").select(FAC_COLS).order("id").range(a, b));
  const candidates = prefCodes.length
    ? await selectAll<CandidateIdxRow>((a, b) =>
        client.from("listing_candidates").select(`${FAC_COLS}, status, matched_facility_id`).in("prefecture_code", prefCodes).order("id").range(a, b),
      )
    : [];
  return [...facilities.map(toEntry("facility")), ...candidates.map(toEntry("candidate"))];
}

// ---------------------------------------------------------------------
// 入力の検証（ブラウザから届くデータは信用しない）
// ---------------------------------------------------------------------
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
const url = (v: unknown) => {
  const s = str(v, 300);
  return s && /^https?:\/\//i.test(s) ? s : undefined;
};

export function sanitizeNaviiRecord(v: unknown): NaviiRecord | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const kind = r.kind === "hospital" || r.kind === "clinic" ? (r.kind as NaviiKind) : null;
  const key = str(r.naviiKey, 40);
  const pref = num(r.prefectureCode);
  const name = str(r.name, 200);
  const address = str(r.address, 400);
  if (!kind || !key || !key.startsWith(`${kind}:`) || !pref || pref < 1 || pref > 47 || !name || !address) return null;
  return {
    naviiKey: key,
    kind,
    name,
    nameKana: str(r.nameKana, 200),
    prefectureCode: pref,
    municipalityCode: str(r.municipalityCode, 5),
    city: str(r.city, 40) ?? "",
    address,
    postalCode: str(r.postalCode, 8),
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    websiteUrl: url(r.websiteUrl),
    departments: Array.isArray(r.departments) ? r.departments.map((d) => str(d, 60)).filter((d): d is string => !!d).slice(0, 60) : [],
    consultationHours: str(r.consultationHours, 600),
    dataSource: str(r.dataSource, 200) ?? "医療情報ネット オープンデータ",
    dataDate: date(r.dataDate),
  };
}

export function sanitizeJalaRecord(v: unknown): JalaRecord | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  const id = str(r.jalaId, 20);
  const pref = num(r.prefectureCode);
  const name = str(r.name, 200);
  const address = str(r.address, 400);
  const jalaUrl = url(r.jalaUrl);
  if (!id || !/^\d+$/.test(id) || !pref || pref < 1 || pref > 47 || !name || !address || !jalaUrl?.startsWith("https://www.jalasite.org/")) return null;
  return { jalaId: id, prefectureCode: pref, name, address, jalaUrl, postalCode: str(r.postalCode, 8), phone: str(r.phone, 20), websiteUrl: url(r.websiteUrl) };
}

const candidateRow = (r: NaviiRecord, batchId: string) => ({
  navii_key: r.naviiKey,
  name: r.name,
  name_kana: r.nameKana ?? null,
  facility_type: r.kind,
  prefecture_code: r.prefectureCode,
  municipality_code: r.municipalityCode ?? null,
  city: r.city || null,
  address: r.address,
  website_url: r.websiteUrl ?? null,
  latitude: r.latitude ?? null,
  longitude: r.longitude ?? null,
  departments: r.departments,
  consultation_hours: r.consultationHours ?? null,
  data_source: r.dataSource,
  data_date: r.dataDate ?? null,
  last_batch_id: batchId,
  updated_at: new Date().toISOString(),
});

export interface CommitResult {
  inserted: number;
  updated: number;
  facilityMatches: number;
  unchanged: number;
  skipped: number;
  messages: string[];
}

/**
 * ナビイの取り込み（1チャンク分）。サーバー側で DB の最新状態に対して重複判定をやり直してから保存する。
 * 掲載施設（facilities）には一切書き込まない。
 */
export async function commitNaviiChunk(client: Client, batchId: string, records: NaviiRecord[]): Promise<CommitResult> {
  const prefs = [...new Set(records.map((r) => r.prefectureCode))];
  const index = await buildMatchIndex(client, prefs);
  const plan = planNaviiImport(records, index);
  const res: CommitResult = { inserted: 0, updated: 0, facilityMatches: 0, unchanged: 0, skipped: 0, messages: [] };

  const upserts: Record<string, unknown>[] = [];
  const isNew = new Set<string>();
  for (const p of plan) {
    if (p.action === "new") {
      upserts.push({ ...candidateRow(p.record, batchId), first_batch_id: batchId });
      isNew.add(p.record.naviiKey);
    } else if (p.action === "update_candidate") {
      upserts.push(candidateRow(p.record, batchId));
    } else if (p.action === "facility_match") {
      // 掲載施設と一致：候補として「更新候補」を作る（または更新する）。掲載施設は変更しない
      const changes = Object.keys(p.changes).length ? p.changes : null;
      if (!changes && p.kind !== "name_only") {
        res.unchanged++;
        continue;
      }
      const existing = index.find((e) => e.type === "candidate" && e.naviiKey === p.record.naviiKey);
      if (!existing) isNew.add(p.record.naviiKey);
      upserts.push({
        ...candidateRow(p.record, batchId),
        ...(existing ? {} : { first_batch_id: batchId }),
        matched_facility_id: p.target.id,
        match_kind: p.kind,
        pending_changes: changes,
      });
      res.facilityMatches++;
    } else if (p.action === "unchanged") res.unchanged++;
    else {
      res.skipped++;
      if (p.action === "possible_duplicate") res.messages.push(`${p.record.name}：既存の候補「${p.target.name}」と同じ施設の可能性があるため登録しませんでした`);
    }
  }
  if (upserts.length === 0) return res;

  // 変更前の内容を保存（取り消し用）
  const keys = upserts.map((u) => u.navii_key as string);
  const { data: before, error: be } = await client.from("listing_candidates").select("*").in("navii_key", keys);
  if (be) throw new Error(be.message);
  const beforeByKey = new Map((before ?? []).map((b) => [b.navii_key as string, b]));

  const { data: saved, error } = await client.from("listing_candidates").upsert(upserts, { onConflict: "navii_key" }).select("id, navii_key");
  if (error) throw new Error(`候補の保存に失敗しました：${error.message}`);

  const changes = (saved ?? []).map((s) => {
    const prev = beforeByKey.get(s.navii_key as string);
    return { batch_id: batchId, table_name: "listing_candidates", record_id: s.id, action: prev ? "update" : "insert", before: prev ?? null };
  });
  const { error: ce } = await client.from("import_batch_changes").insert(changes);
  if (ce) throw new Error(`取り込み記録の保存に失敗しました：${ce.message}`);

  for (const c of changes) {
    if (c.action === "insert") res.inserted++;
    else res.updated++;
  }
  // facility_match は inserted/updated にも数えられているので、表示用に分けて返す
  return res;
}

/** JALA の取り込み（1チャンク分）。掲載施設・候補との照合結果を保存する */
export async function commitJalaChunk(client: Client, batchId: string, records: JalaRecord[], fetchedAt: string) {
  const prefs = [...new Set(records.map((r) => r.prefectureCode))];
  const index = await buildMatchIndex(client, prefs);
  const ids = records.map((r) => r.jalaId);
  const { data: before, error: be } = await client.from("jala_facilities").select("*").in("jala_id", ids);
  if (be) throw new Error(be.message);
  const beforeById = new Map((before ?? []).map((b) => [b.jala_id as string, b]));

  const rows = records.map((r) => {
    const m = findMatch({ name: r.name, prefectureCode: r.prefectureCode, address: r.address, phone: r.phone }, index);
    return {
      jala_id: r.jalaId,
      name: r.name,
      prefecture_code: r.prefectureCode,
      postal_code: r.postalCode ?? null,
      address: r.address,
      phone: r.phone ?? null,
      website_url: r.websiteUrl ?? null,
      jala_url: r.jalaUrl,
      fetched_at: fetchedAt,
      // 名前だけの一致はひも付けない（誤って別の施設に無痛分娩の情報を出さないため）
      matched_facility_id: m && m.kind !== "name_only" && m.target.type === "facility" ? m.target.id : null,
      matched_candidate_id: m && m.kind !== "name_only" && m.target.type === "candidate" ? m.target.id : null,
      match_kind: m?.kind ?? null,
      last_batch_id: batchId,
      ...(beforeById.has(r.jalaId) ? {} : { first_batch_id: batchId }),
      updated_at: new Date().toISOString(),
    };
  });
  const { data: saved, error } = await client.from("jala_facilities").upsert(rows, { onConflict: "jala_id" }).select("id, jala_id");
  if (error) throw new Error(`JALA情報の保存に失敗しました：${error.message}`);
  const changes = (saved ?? []).map((s) => {
    const prev = beforeById.get(s.jala_id as string);
    return { batch_id: batchId, table_name: "jala_facilities", record_id: s.id, action: prev ? "update" : "insert", before: prev ?? null };
  });
  const { error: ce } = await client.from("import_batch_changes").insert(changes);
  if (ce) throw new Error(ce.message);

  // 候補側の電話番号・郵便番号が空欄なら JALA の値で補う（上書きはしない。変更前の内容は取り消し用に保存）
  const fills = rows.filter((r) => r.matched_candidate_id && (r.phone || r.postal_code));
  if (fills.length) {
    const candIds = fills.map((r) => r.matched_candidate_id as string);
    const { data: cands } = await client.from("listing_candidates").select("*").in("id", candIds);
    for (const c of cands ?? []) {
      const r = fills.find((f) => f.matched_candidate_id === c.id)!;
      const patch: Record<string, string> = {};
      if (!c.phone && r.phone) patch.phone = r.phone;
      if (!c.postal_code && r.postal_code) patch.postal_code = r.postal_code;
      if (!Object.keys(patch).length) continue;
      await client.from("import_batch_changes").insert({ batch_id: batchId, table_name: "listing_candidates", record_id: c.id, action: "update", before: c });
      await client.from("listing_candidates").update(patch).eq("id", c.id);
    }
  }
  return {
    inserted: changes.filter((c) => c.action === "insert").length,
    updated: changes.filter((c) => c.action === "update").length,
    matchedFacilities: rows.filter((r) => r.matched_facility_id).length,
    matchedCandidates: rows.filter((r) => r.matched_candidate_id).length,
  };
}
