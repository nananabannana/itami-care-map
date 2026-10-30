import { METHODS } from "./master";
import type {
  CareItemKey,
  Facility,
  ProcedureSupport,
  SearchFilters,
  SearchResult,
  Tier,
} from "./types";

const CONSULTATION_METHODS = new Set(METHODS.filter((m) => m.isConsultationOnly).map((m) => m.slug));

/** 対応行のティア（1が最優先）。対応を示さない行は null */
export function tierOfSupport(row: ProcedureSupport): Tier | null {
  if (row.supportStatus === "available") {
    if (CONSULTATION_METHODS.has(row.methodSlug)) return 3;
    if (row.evidenceStatus === "A") return 1;
    if (row.evidenceStatus === "B") return 2;
    // DB制約上ありえないが、念のため格下げ
    return null;
  }
  if (row.supportStatus === "consultation") return 3;
  return null;
}

function rowMatches(row: ProcedureSupport, f: SearchFilters): boolean {
  if (f.procedure && row.procedureSlug !== f.procedure) return false;
  if (f.method && row.methodSlug !== f.method) return false;
  return true;
}

function careConfirmed(facility: Facility, key: CareItemKey): boolean {
  const item = facility.care.find((c) => c.key === key);
  return !!item && (item.status === "yes" || item.status === "conditional") && item.evidenceStatus !== "U";
}

function normalize(s: string) {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function keywordMatches(facility: Facility, q: string): boolean {
  const needle = normalize(q);
  if (!needle) return true;
  const hay = normalize(
    [facility.name, facility.city, facility.address, ...facility.nearestStations, ...facility.departments].join(" "),
  );
  return hay.includes(needle);
}

/**
 * 検索と並び替え。
 * 並び順は確認状況だけで決まる（掲載料・広告は関与しない）。
 */
export function searchFacilities(facilities: Facility[], f: SearchFilters): SearchResult[] {
  const hasTreatmentFilter = !!(f.procedure || f.method);
  const results: SearchResult[] = [];

  for (const facility of facilities) {
    if (f.pref && facility.prefectureCode !== f.pref) continue;
    if (f.city && facility.city !== f.city) continue;
    if (f.q && !keywordMatches(facility, f.q)) continue;
    if (f.femaleDoctor && !careConfirmed(facility, "female_doctor_available")) continue;
    if (f.consultOnly && !careConfirmed(facility, "consultation_only")) continue;
    if (f.stopOnRequest && !careConfirmed(facility, "stop_on_request")) continue;

    const candidateRows = facility.support.filter((r) => rowMatches(r, f));

    // 指定した麻酔方法を「実施していない」と出典付きで確認できた施設は、その方法での検索から除外
    if (f.method && candidateRows.length > 0 && candidateRows.every((r) => r.supportStatus === "not_offered")) {
      continue;
    }

    const matched = candidateRows.filter((r) => tierOfSupport(r) !== null);
    let tier: Tier = 4;
    for (const r of matched) {
      const t = tierOfSupport(r)!;
      if (t < tier) tier = t;
    }

    // 処置・方法の条件がないときは、その施設が持つ対応情報全体でティアを決める
    if (!hasTreatmentFilter && matched.length === 0) {
      const anyCareConsult = careConfirmed(facility, "pain_management_consultation");
      if (anyCareConsult) tier = 3;
    }

    if (f.evidence && f.evidence.length > 0) {
      const ok = matched.some(
        (r) => r.supportStatus === "available" && f.evidence!.includes(r.evidenceStatus as "A" | "B"),
      );
      if (!ok) continue;
    }

    const dates = matched.map((r) => r.verifiedAt).filter((d): d is string => !!d);
    const latestVerifiedAt = dates.sort().at(-1);

    results.push({ facility, tier, matched, latestVerifiedAt });
  }

  return results.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const da = a.latestVerifiedAt ?? "";
    const db = b.latestVerifiedAt ?? "";
    if (da !== db) return da < db ? 1 : -1;
    return a.facility.name.localeCompare(b.facility.name, "ja");
  });
}

/** URLクエリ → 検索条件 */
export function parseFilters(sp: Record<string, string | string[] | undefined>): SearchFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const many = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
  };
  const prefNum = Number(one("pref"));
  const evidence = many("evidence").filter((e): e is "A" | "B" => e === "A" || e === "B");
  return {
    pref: Number.isInteger(prefNum) && prefNum >= 1 && prefNum <= 47 ? prefNum : undefined,
    city: one("city"),
    procedure: one("procedure"),
    method: one("method"),
    q: one("q")?.slice(0, 50),
    femaleDoctor: one("female_doctor") === "1",
    consultOnly: one("consult_only") === "1",
    stopOnRequest: one("stop_on_request") === "1",
    evidence: evidence.length ? evidence : undefined,
  };
}

/** 検索条件 → URLクエリ */
export function filtersToQuery(f: SearchFilters): string {
  const p = new URLSearchParams();
  if (f.pref) p.set("pref", String(f.pref));
  if (f.city) p.set("city", f.city);
  if (f.procedure) p.set("procedure", f.procedure);
  if (f.method) p.set("method", f.method);
  if (f.q) p.set("q", f.q);
  if (f.femaleDoctor) p.set("female_doctor", "1");
  if (f.consultOnly) p.set("consult_only", "1");
  if (f.stopOnRequest) p.set("stop_on_request", "1");
  f.evidence?.forEach((e) => p.append("evidence", e));
  const s = p.toString();
  return s ? `?${s}` : "";
}
