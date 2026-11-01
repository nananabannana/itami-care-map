/**
 * 重複判定（ナビイ・JALA 共通）
 *
 * 判定の順番
 *   1. 同じナビイID（navii_key）           → 同一（確実）
 *   2. 電話番号が一致（JALA のみ）          → 同一の可能性が高い
 *   3. 住所（番地まで）が一致し、名前が関連 → 同一
 *   4. 100m 以内かつ名前が関連             → 同一の可能性が高い
 *   5. 同じ都道府県で名前だけ一致           → 要確認
 * 既存の掲載施設と一致したものは新規登録せず「更新候補」として扱い、掲載施設は上書きしない。
 */
import { distanceMeters, namesRelated, normAddress, normName, normPhone } from "./normalize";
import type { NaviiRecord } from "./navii";

export type MatchKind = "navii_id" | "phone" | "address_name" | "location_name" | "name_only";

export interface IndexEntry {
  id: string;
  type: "facility" | "candidate";
  naviiKey?: string | null;
  name: string;
  prefectureCode: number;
  address: string;
  city?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  websiteUrl?: string | null;
  consultationHours?: string | null;
  departments?: string[] | null;
  /** 候補のみ：状態 */
  status?: string;
  /** 候補のみ：一致済みの掲載施設 */
  matchedFacilityId?: string | null;
}

export interface MatchResult {
  target: IndexEntry;
  kind: MatchKind;
}

const STRONG: MatchKind[] = ["navii_id", "phone", "address_name", "location_name"];
export const isStrong = (k: MatchKind) => STRONG.includes(k);

export function findMatch(
  rec: { naviiKey?: string; name: string; prefectureCode: number; address: string; phone?: string; latitude?: number; longitude?: number },
  index: IndexEntry[],
): MatchResult | null {
  const pool = index.filter((e) => e.prefectureCode === rec.prefectureCode || (rec.naviiKey && e.naviiKey === rec.naviiKey));
  // 掲載施設との一致を候補との一致より優先する
  const ordered = [...pool.filter((e) => e.type === "facility"), ...pool.filter((e) => e.type === "candidate")];

  if (rec.naviiKey) {
    const hit = ordered.find((e) => e.naviiKey === rec.naviiKey);
    if (hit) return { target: hit, kind: "navii_id" };
  }
  const phone = normPhone(rec.phone);
  if (phone.length >= 9) {
    const hit = ordered.find((e) => normPhone(e.phone) === phone);
    if (hit) return { target: hit, kind: "phone" };
  }
  const addr = normAddress(rec.address);
  if (addr) {
    const hit = ordered.find((e) => normAddress(e.address) === addr && namesRelated(e.name, rec.name));
    if (hit) return { target: hit, kind: "address_name" };
  }
  if (rec.latitude != null && rec.longitude != null) {
    const hit = ordered.find(
      (e) =>
        e.latitude != null &&
        e.longitude != null &&
        distanceMeters(rec.latitude!, rec.longitude!, e.latitude, e.longitude) <= 100 &&
        namesRelated(e.name, rec.name),
    );
    if (hit) return { target: hit, kind: "location_name" };
  }
  const nm = normName(rec.name);
  const hit = ordered.find((e) => normName(e.name) === nm);
  if (hit) return { target: hit, kind: "name_only" };
  return null;
}

export type FieldChange = { current: unknown; incoming: unknown };

const same = (a: unknown, b: unknown) => {
  const norm = (v: unknown) => (Array.isArray(v) ? [...v].sort().join("|") : v == null ? "" : String(v).normalize("NFKC").trim());
  return norm(a) === norm(b);
};

/** 取り込みデータと既存データの差分。取り込み側が空の項目は「変更なし」とみなす（空で上書きしない） */
export function diffRecord(current: IndexEntry, rec: NaviiRecord): Record<string, FieldChange> {
  const pairs: [string, unknown, unknown][] = [
    ["name", current.name, rec.name],
    ["address", current.address, rec.address],
    ["city", current.city, rec.city],
    ["website_url", current.websiteUrl, rec.websiteUrl],
    ["consultation_hours", current.consultationHours, rec.consultationHours],
    ["departments", current.departments, rec.departments],
    ["latitude", current.latitude, rec.latitude],
    ["longitude", current.longitude, rec.longitude],
  ];
  const out: Record<string, FieldChange> = {};
  for (const [k, cur, inc] of pairs) {
    if (inc == null || inc === "" || (Array.isArray(inc) && inc.length === 0)) continue;
    // 掲載施設の住所は表記が違うだけのことが多いので、正規化して同じなら差分にしない
    if (k === "address" && normAddress(String(cur ?? "")) === normAddress(String(inc))) continue;
    if (k === "name" && normName(String(cur ?? "")) === normName(String(inc))) continue;
    if ((k === "latitude" || k === "longitude") && cur != null && Math.abs(Number(cur) - Number(inc)) < 0.0005) continue;
    if (!same(cur, inc)) out[k] = { current: cur ?? null, incoming: inc };
  }
  return out;
}

export type PlanAction =
  | { action: "new"; record: NaviiRecord }
  | { action: "update_candidate"; record: NaviiRecord; target: IndexEntry; changes: Record<string, FieldChange> }
  | { action: "unchanged"; record: NaviiRecord; target: IndexEntry }
  | { action: "facility_match"; record: NaviiRecord; target: IndexEntry; kind: MatchKind; changes: Record<string, FieldChange> }
  | { action: "possible_duplicate"; record: NaviiRecord; target: IndexEntry; kind: MatchKind }
  | { action: "duplicate_in_file"; record: NaviiRecord; firstKey: string };

/** ドライラン：DB に書き込まずに、各レコードをどう扱うかを決める */
export function planNaviiImport(records: NaviiRecord[], index: IndexEntry[]): PlanAction[] {
  const seen = new Map<string, string>();
  const plan: PlanAction[] = [];
  for (const record of records) {
    // 同じファイル内の重複（同じ所在地・名称の行が病院と診療所の両方にある等）
    const dupKey = `${record.prefectureCode}|${normAddress(record.address)}|${normName(record.name)}`;
    if (seen.has(dupKey)) {
      plan.push({ action: "duplicate_in_file", record, firstKey: seen.get(dupKey)! });
      continue;
    }
    seen.set(dupKey, record.naviiKey);

    const m = findMatch(record, index);
    if (!m) {
      plan.push({ action: "new", record });
      continue;
    }
    const changes = diffRecord(m.target, record);
    if (m.target.type === "facility") {
      plan.push({ action: "facility_match", record, target: m.target, kind: m.kind, changes });
    } else if (m.kind === "navii_id") {
      plan.push(Object.keys(changes).length ? { action: "update_candidate", record, target: m.target, changes } : { action: "unchanged", record, target: m.target });
    } else {
      // 別の ID の候補と住所・名前が一致：同じ施設が別IDで載っている可能性。登録も更新もせず、一覧で知らせる
      plan.push({ action: "possible_duplicate", record, target: m.target, kind: m.kind });
    }
  }
  return plan;
}

export function summarizePlan(plan: PlanAction[]) {
  const s = { total: plan.length, new: 0, update_candidate: 0, unchanged: 0, facility_match: 0, possible_duplicate: 0, duplicate_in_file: 0 };
  for (const p of plan) s[p.action]++;
  return s;
}
