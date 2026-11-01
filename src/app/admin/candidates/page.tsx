import type { Metadata } from "next";
import Link from "next/link";
import { CANDIDATE_STATUS, type CandidateStatusKey } from "@/lib/candidate-labels";
import { prefByCode, PREFECTURES } from "@/lib/master";
import { AdminPage } from "../AdminPage";
import { CandidateTable, type CandidateRow } from "./CandidateTable";

export const metadata: Metadata = { title: "掲載候補", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;
const PER_PAGE = 50;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default function CandidatesPage({ searchParams }: { searchParams: SP }) {
  return (
    <AdminPage
      current="/admin/candidates"
      title="掲載候補"
      lead="取り込んだ医療機関の確認状況を管理します。公式サイトで麻酔・鎮痛の記載を確認し、根拠を登録した候補だけを「掲載可能」にできます。"
    >
      {async (session) => {
        const sp = await searchParams;
        const status = one(sp.status) as CandidateStatusKey | "";
        const pref = Number(one(sp.pref)) || 0;
        const match = one(sp.match);
        const q = one(sp.q).slice(0, 50);
        const page = Math.max(1, Number(one(sp.page)) || 1);

        let query = session.client
          .from("listing_candidates")
          .select(
            "id, name, prefecture_code, city, address, status, website_url, promoted_facility_id, pending_changes, matched:facilities!listing_candidates_matched_facility_id_fkey(name), candidate_evidence(count), jala_facilities!jala_facilities_matched_candidate_id_fkey(count)",
            { count: "exact" },
          )
          .order("prefecture_code")
          .order("city")
          .order("name")
          .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
        if (status && status in CANDIDATE_STATUS) query = query.eq("status", status);
        if (pref) query = query.eq("prefecture_code", pref);
        if (match === "facility") query = query.not("matched_facility_id", "is", null);
        if (match === "new") query = query.is("matched_facility_id", null);
        if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,address.ilike.%${q.replace(/[%,()]/g, "")}%`);
        const { data, count, error } = await query;
        if (error) return <p className="rounded-lg bg-warn-bg p-4 text-warn">掲載候補を読めませんでした（0004 のマイグレーションが未実行の可能性があります）：{error.message}</p>;

        const rows: CandidateRow[] = (data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          pref: prefByCode(r.prefecture_code)?.name ?? "",
          city: r.city,
          address: r.address,
          status: r.status as CandidateStatusKey,
          websiteUrl: r.website_url,
          evidenceCount: (r.candidate_evidence as unknown as { count: number }[])?.[0]?.count ?? 0,
          jala: ((r.jala_facilities as unknown as { count: number }[])?.[0]?.count ?? 0) > 0,
          matchedFacility: (r.matched as unknown as { name: string } | null)?.name ?? null,
          hasPendingChanges: !!r.pending_changes,
          promoted: !!r.promoted_facility_id,
        }));
        const pages = Math.max(1, Math.ceil((count ?? 0) / PER_PAGE));
        const qs = (patch: Record<string, string | number>) => {
          const p = new URLSearchParams({ ...(status && { status }), ...(pref && { pref: String(pref) }), ...(match && { match }), ...(q && { q }) });
          for (const [k, v] of Object.entries(patch)) {
            if (v) p.set(k, String(v));
            else p.delete(k);
          }
          return `/admin/candidates?${p}`;
        };

        return (
          <>
            <form method="get" className="mb-4 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-5">
              <div>
                <label htmlFor="c-status" className="mb-1 block text-sm font-semibold">状態</label>
                <select id="c-status" name="status" defaultValue={status} className="min-h-11 w-full rounded-lg border border-line px-2">
                  <option value="">すべて</option>
                  {(Object.keys(CANDIDATE_STATUS) as CandidateStatusKey[]).map((k) => <option key={k} value={k}>{CANDIDATE_STATUS[k].label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="c-pref" className="mb-1 block text-sm font-semibold">都道府県</label>
                <select id="c-pref" name="pref" defaultValue={pref || ""} className="min-h-11 w-full rounded-lg border border-line px-2">
                  <option value="">すべて</option>
                  {PREFECTURES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="c-match" className="mb-1 block text-sm font-semibold">種類</label>
                <select id="c-match" name="match" defaultValue={match} className="min-h-11 w-full rounded-lg border border-line px-2">
                  <option value="">すべて</option>
                  <option value="new">新規の候補</option>
                  <option value="facility">既存の掲載施設と一致（更新候補）</option>
                </select>
              </div>
              <div>
                <label htmlFor="c-q" className="mb-1 block text-sm font-semibold">名称・住所</label>
                <input id="c-q" name="q" defaultValue={q} className="min-h-11 w-full rounded-lg border border-line px-3" />
              </div>
              <div className="flex items-end">
                <button type="submit" className="min-h-11 w-full rounded-lg bg-primary font-bold text-white">絞り込む</button>
              </div>
            </form>

            <p className="mb-2 text-sm text-ink-muted">{(count ?? 0).toLocaleString()}件中 {rows.length ? `${(page - 1) * PER_PAGE + 1}〜${(page - 1) * PER_PAGE + rows.length}` : 0}件</p>
            {rows.length ? <CandidateTable rows={rows} /> : <p className="rounded-xl border border-dashed border-line p-6 text-center text-ink-muted">該当する候補はありません。「ナビイ取り込み」から取り込めます。</p>}

            {pages > 1 && (
              <nav aria-label="ページ" className="mt-4 flex flex-wrap gap-2">
                {page > 1 && <Link href={qs({ page: page - 1 })} className="min-h-10 rounded-lg border border-line bg-white px-3 py-2 text-sm">前へ</Link>}
                <span className="px-2 py-2 text-sm">{page} / {pages}</span>
                {page < pages && <Link href={qs({ page: page + 1 })} className="min-h-10 rounded-lg border border-line bg-white px-3 py-2 text-sm">次へ</Link>}
              </nav>
            )}
          </>
        );
      }}
    </AdminPage>
  );
}
