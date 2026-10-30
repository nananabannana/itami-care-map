import "server-only";
import type { AdminSession } from "./supabase-server";
import { FACILITY_SELECT, rowToFacility, type FacilityRow } from "./supabase-repository";
import type { Facility } from "./types";

export type ReviewStatus = "draft" | "approved" | "rejected";

export interface ReviewItem {
  facility: Facility;
  slug: string;
  reviewStatus: ReviewStatus;
  isPublished: boolean;
  reviewNote?: string;
  approvedAt?: string;
  /** 再確認期限（対応情報ごと） */
  reviewDue: Record<string, string | undefined>;
}

export interface ResearchCandidate {
  id: string;
  name: string;
  prefectureCode: number;
  note?: string;
  status: "pending" | "in_progress" | "registered" | "dropped";
}

type AdminRow = FacilityRow & {
  review_status: ReviewStatus;
  is_published: boolean;
  review_note: string | null;
  approved_at: string | null;
  facility_procedure_support: (FacilityRow["facility_procedure_support"][number] & { review_due_at: string | null })[];
};

const ADMIN_SELECT =
  FACILITY_SELECT.replace(
    "evidence_status, source_id, verified_at, procedures",
    "evidence_status, source_id, verified_at, review_due_at, procedures",
  ) + ", review_status, is_published, review_note, approved_at";

/** 公開前レビュー用：非公開を含むすべての施設（RLS により管理者のみ取得できる） */
export async function listForReview(session: AdminSession): Promise<ReviewItem[]> {
  const { data, error } = await session.client.from("facilities").select(ADMIN_SELECT).order("prefecture_code").order("name");
  if (error) throw new Error(`レビュー対象の取得に失敗しました: ${error.message}`);
  return (data as unknown as AdminRow[]).map((r) => {
    const facility = rowToFacility(r);
    const reviewDue: Record<string, string | undefined> = {};
    for (const s of r.facility_procedure_support) {
      if (s.procedures && s.anesthesia_methods)
        reviewDue[`${s.procedures.slug}|${s.anesthesia_methods.slug}`] = s.review_due_at ?? undefined;
    }
    return {
      facility,
      slug: r.slug,
      reviewStatus: r.review_status,
      isPublished: r.is_published,
      reviewNote: r.review_note ?? undefined,
      approvedAt: r.approved_at ?? undefined,
      reviewDue,
    };
  });
}

export async function listResearchCandidates(session: AdminSession): Promise<ResearchCandidate[]> {
  const { data, error } = await session.client
    .from("research_candidates")
    .select("id, name, prefecture_code, note, status")
    .order("prefecture_code")
    .order("name");
  if (error) throw new Error(`追加調査候補の取得に失敗しました: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    prefectureCode: r.prefecture_code as number,
    note: (r.note as string | null) ?? undefined,
    status: r.status as ResearchCandidate["status"],
  }));
}
