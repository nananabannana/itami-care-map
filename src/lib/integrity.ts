/**
 * データ整合性チェック。
 * supabase/migrations/0001_init.sql の CHECK 制約・トリガーと同じルールを
 * アプリ側（デモデータ・将来の管理画面の入力検証）でも適用する。
 */
import { methodBySlug, procedureBySlug } from "./master";
import type { EvidenceStatus, Facility } from "./types";

export function validateFacility(f: Facility): string[] {
  const errors: string[] = [];
  const src = new Map(f.sources.map((s) => [s.id, s]));

  const checkEvidence = (where: string, ev: EvidenceStatus, sourceId?: string, verifiedAt?: string) => {
    if (ev === "U") {
      if (sourceId) errors.push(`${where}: 未確認(U)に出典が付いています`);
      return;
    }
    if (!sourceId || !verifiedAt) {
      errors.push(`${where}: 確度${ev}には出典と確認日が必要です`);
      return;
    }
    const s = src.get(sourceId);
    if (!s) {
      errors.push(`${where}: 出典 ${sourceId} がこの医療機関に存在しません`);
      return;
    }
    if ((ev === "A" || ev === "C") && s.sourceType !== "official_site")
      errors.push(`${where}: 確度${ev}は公式サイトの出典が必要です`);
    if (ev === "B" && s.sourceType !== "direct_inquiry")
      errors.push(`${where}: 確度Bは直接確認の出典が必要です`);
  };

  for (const s of f.sources) {
    if (s.sourceType === "official_site" && !s.sourceUrl) errors.push(`出典 ${s.id}: 公式サイトのURLがありません`);
    if (s.sourceType === "direct_inquiry" && !s.contactedDepartment)
      errors.push(`出典 ${s.id}: 確認した部署がありません`);
  }

  const seen = new Set<string>();
  for (const r of f.support) {
    const where = `${f.id} ${r.procedureSlug}/${r.methodSlug}`;
    if (!procedureBySlug(r.procedureSlug)) errors.push(`${where}: 未定義の処置`);
    if (!methodBySlug(r.methodSlug)) errors.push(`${where}: 未定義の麻酔方法`);
    const key = `${r.procedureSlug}|${r.methodSlug}`;
    if (seen.has(key)) errors.push(`${where}: 重複しています`);
    seen.add(key);
    if (r.supportStatus === "available" && !["A", "B"].includes(r.evidenceStatus))
      errors.push(`${where}: 「実施」は確度AまたはBのときだけ登録できます`);
    if (r.supportStatus === "consultation" && !["A", "B", "C"].includes(r.evidenceStatus))
      errors.push(`${where}: 「個別相談」は確度A/B/Cのときだけ登録できます`);
    checkEvidence(where, r.evidenceStatus, r.sourceId, r.verifiedAt);
  }

  for (const c of f.care) {
    const where = `${f.id} care:${c.key}`;
    if (c.status !== "unknown" && !["A", "B", "C"].includes(c.evidenceStatus))
      errors.push(`${where}: 対応状況の登録には確度A/B/Cが必要です`);
    checkEvidence(where, c.evidenceStatus, c.sourceId, c.verifiedAt);
  }

  if (f.basicInfoSourceId && !src.has(f.basicInfoSourceId))
    errors.push(`${f.id}: 基本情報の出典が存在しません`);

  return errors;
}
