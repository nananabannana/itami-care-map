"use server";

import { updateTag } from "next/cache";
import { getAdminSession } from "@/lib/supabase-server";

type Result<T = null> = { ok: true; data: T; message?: string } | { ok: false; message: string };

export type CandidateStatus = "unverified" | "awaiting_official" | "official_verified" | "direct_verified" | "publishable" | "excluded";
const STATUSES: CandidateStatus[] = ["unverified", "awaiting_official", "official_verified", "direct_verified", "publishable", "excluded"];

async function admin() {
  const s = await getAdminSession();
  if (!s) throw new Error("管理者としてログインしてください。");
  return s;
}
const fail = (e: unknown): { ok: false; message: string } => ({ ok: false, message: e instanceof Error ? e.message : String(e) });

/** 状態の一括変更。「掲載可能」は麻酔・鎮痛の根拠がある候補だけ */
export async function setCandidateStatus(ids: string[], status: CandidateStatus, note?: string): Promise<Result<number>> {
  try {
    const s = await admin();
    if (!STATUSES.includes(status)) throw new Error("状態が不正です");
    if (!ids.length || ids.length > 200) throw new Error("1回に変更できるのは200件までです");
    let target = ids;
    let skipped = 0;
    if (status === "publishable") {
      const { data, error } = await s.client
        .from("candidate_evidence")
        .select("candidate_id, support_status, anesthesia_methods!inner(is_none)")
        .in("candidate_id", ids)
        .in("support_status", ["available", "consultation"])
        .eq("anesthesia_methods.is_none", false);
      if (error) throw new Error(error.message);
      const ok = new Set((data ?? []).map((r) => r.candidate_id as string));
      target = ids.filter((id) => ok.has(id));
      skipped = ids.length - target.length;
      if (!target.length) throw new Error("麻酔・鎮痛の根拠（公式情報または直接確認）が登録されていないため、「掲載可能」にできません。");
    }
    const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (note !== undefined) patch.status_note = note.slice(0, 1000) || null;
    const { error } = await s.client.from("listing_candidates").update(patch).in("id", target);
    if (error) throw new Error(error.message);
    await s.client.from("audit_logs").insert(
      target.map((id) => ({ actor_id: s.userId, table_name: "listing_candidates", record_id: id, action: `status_${status}`, diff: { note: note ?? null } })),
    );
    return { ok: true, data: target.length, message: skipped ? `根拠が無い ${skipped}件は変更しませんでした。` : undefined };
  } catch (e) {
    return fail(e);
  }
}

export interface EvidenceInput {
  procedure: string;
  method: string;
  supportStatus: "available" | "consultation" | "not_offered";
  evidenceStatus: "A" | "B" | "C";
  verificationMethod: "official_site" | "phone" | "form" | "email" | "visit";
  sourceUrl?: string;
  sourceTitle?: string;
  excerpt: string;
  conditions?: string;
  contactedDepartment?: string;
  documentDate?: string;
  verifiedAt: string;
}

/** 処置別の根拠を登録。DB の制約（確度と確認方法・出典の組み合わせ）も同じルールで弾く */
export async function addEvidence(candidateId: string, input: EvidenceInput): Promise<Result> {
  try {
    const s = await admin();
    const ev = input.evidenceStatus;
    if (!["A", "B", "C"].includes(ev)) throw new Error("確度が不正です");
    if (!input.excerpt?.trim()) throw new Error("根拠となる記述（原文の引用、または回答の要旨）を入力してください。");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.verifiedAt)) throw new Error("確認日を入力してください。");
    if ((ev === "A" || ev === "C") && (input.verificationMethod !== "official_site" || !/^https?:\/\//.test(input.sourceUrl ?? "")))
      throw new Error("確度A・Cは、確認方法「公式サイト」と公式ページのURLが必要です。");
    if (ev === "B" && (input.verificationMethod === "official_site" || !input.contactedDepartment?.trim()))
      throw new Error("確度Bは、電話・フォームなどの確認方法と、確認した部署（個人名は不要）が必要です。");
    if (input.supportStatus === "available" && ev === "C") throw new Error("「実施」は確度AかBのときだけ登録できます。Cは「個別に相談可」にしてください。");

    const [{ data: proc }, { data: meth }] = await Promise.all([
      s.client.from("procedures").select("id").eq("slug", input.procedure).single(),
      s.client.from("anesthesia_methods").select("id").eq("slug", input.method).single(),
    ]);
    if (!proc || !meth) throw new Error("処置または麻酔方法が見つかりません");

    const { error } = await s.client.from("candidate_evidence").insert({
      candidate_id: candidateId,
      procedure_id: proc.id,
      anesthesia_method_id: meth.id,
      support_status: input.supportStatus,
      conditions: input.conditions?.trim().slice(0, 500) || null,
      evidence_status: ev,
      verification_method: input.verificationMethod,
      source_url: input.sourceUrl?.trim() || null,
      source_title: input.sourceTitle?.trim().slice(0, 200) || null,
      evidence_excerpt: input.excerpt.trim().slice(0, 1000),
      contacted_department: input.contactedDepartment?.trim().slice(0, 100) || null,
      document_date: input.documentDate?.trim().slice(0, 50) || null,
      verified_at: input.verifiedAt,
      created_by: s.userId,
    });
    if (error) throw new Error(error.code === "23505" ? "同じ処置・麻酔方法の根拠がすでに登録されています。" : error.message);

    // 未確認・確認待ちの候補は、確認方法に合わせて状態を進める
    const next = ev === "B" ? "direct_verified" : "official_verified";
    await s.client.from("listing_candidates").update({ status: next, updated_at: new Date().toISOString() }).eq("id", candidateId).in("status", ["unverified", "awaiting_official"]);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteEvidence(evidenceId: string): Promise<Result> {
  try {
    const s = await admin();
    const { error } = await s.client.from("candidate_evidence").delete().eq("id", evidenceId);
    if (error) throw new Error(error.message);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** 「掲載可能」の候補を掲載施設の下書きへ（最大20件）。公開は公開前レビューで承認してから */
export async function promoteCandidates(ids: string[]): Promise<Result<string[]>> {
  try {
    const s = await admin();
    if (!ids.length || ids.length > 20) throw new Error("一度に下書きへ送れるのは20件までです");
    const { data, error } = await s.client.rpc("promote_candidates", { p_ids: ids });
    if (error) throw new Error(error.message);
    updateTag("facilities");
    return { ok: true, data: (data as string[]) ?? [] };
  } catch (e) {
    return fail(e);
  }
}

const APPLYABLE = ["name", "address", "city", "website_url", "consultation_hours", "departments", "latitude", "longitude"] as const;

/** 更新候補：選んだ項目だけを掲載施設に反映する（変更前の値は監査ログに残す） */
export async function applyFacilityChanges(candidateId: string, fields: string[]): Promise<Result<number>> {
  try {
    const s = await admin();
    const { data: c, error } = await s.client.from("listing_candidates").select("matched_facility_id, pending_changes").eq("id", candidateId).single();
    if (error || !c?.matched_facility_id) throw new Error("一致する掲載施設がありません");
    const pending = (c.pending_changes ?? {}) as Record<string, { current: unknown; incoming: unknown }>;
    const chosen = fields.filter((f): f is (typeof APPLYABLE)[number] => (APPLYABLE as readonly string[]).includes(f) && f in pending);
    if (!chosen.length) throw new Error("反映する項目を選んでください");

    const { data: before } = await s.client.from("facilities").select(chosen.join(", ")).eq("id", c.matched_facility_id).single();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of chosen) patch[f] = pending[f].incoming;
    const { error: ue } = await s.client.from("facilities").update(patch).eq("id", c.matched_facility_id);
    if (ue) throw new Error(ue.message);

    const rest = Object.fromEntries(Object.entries(pending).filter(([k]) => !chosen.includes(k as never)));
    await s.client.from("listing_candidates").update({ pending_changes: Object.keys(rest).length ? rest : null, updated_at: new Date().toISOString() }).eq("id", candidateId);
    await s.client.from("audit_logs").insert({
      actor_id: s.userId,
      table_name: "facilities",
      record_id: c.matched_facility_id,
      action: "apply_import_changes",
      diff: { candidate_id: candidateId, before, after: patch },
    });
    updateTag("facilities");
    updateTag("prefecture-counts");
    return { ok: true, data: chosen.length };
  } catch (e) {
    return fail(e);
  }
}
