import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EvidenceBadge, formatDate, SupportLabel } from "@/components/Badges";
import { listForReview, listResearchCandidates, type ReviewItem, type ReviewStatus } from "@/lib/admin-data";
import { methodBySlug, prefByCode, procedureBySlug, SOURCE_TYPE } from "@/lib/master";
import { getAdminSession, isSupabaseConfigured } from "@/lib/supabase-server";
import { todayJst } from "@/lib/today";
import { signOut } from "../actions";
import { ReviewActions } from "./ReviewActions";

export const metadata: Metadata = { title: "公開前レビュー", robots: { index: false, follow: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;

const TABS: { key: ReviewStatus; label: string }[] = [
  { key: "draft", label: "未承認（下書き）" },
  { key: "approved", label: "公開中" },
  { key: "rejected", label: "差し戻し" },
];

function warningsOf(item: ReviewItem, today: string): string[] {
  const w: string[] = [];
  const expired = Object.values(item.reviewDue).filter((d) => d && d <= today).length;
  if (expired) w.push(`再確認期限を過ぎた対応情報が${expired}件あります`);
  if (item.facility.support.length === 0) w.push("処置別の麻酔情報がありません");
  const evidenceSources = item.facility.sources.filter((s) => item.facility.support.some((r) => r.sourceId === s.id));
  if (evidenceSources.some((s) => !s.documentDate || s.documentDate.startsWith("記載なし")))
    w.push("根拠資料に作成日・更新日の記載がありません。内容が現行のものか確認してください");
  if (!item.facility.phone) w.push("電話番号が未確認です");
  return w;
}

function FacilityReview({ item, today }: { item: ReviewItem; today: string }) {
  const f = item.facility;
  const src = (id?: string) => f.sources.find((s) => s.id === id);
  const warnings = warningsOf(item, today);
  return (
    <article className="space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-6">
      <header>
        <p className="text-sm text-ink-muted">
          {prefByCode(f.prefectureCode)?.name} {f.city}
        </p>
        <h3 className="text-lg font-bold">{f.name}</h3>
        <p className="text-sm">
          {f.address}
          {f.phone && ` ／ ${f.phone}`}
          {f.websiteUrl && (
            <>
              {" ／ "}
              <a href={f.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                公式サイト
              </a>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          slug: {item.slug}
          {item.approvedAt && ` ／ 承認日時：${new Date(item.approvedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`}
        </p>
      </header>

      {(warnings.length > 0 || item.reviewNote) && (
        <div role="note" className="rounded-lg bg-warn-bg p-3 text-sm text-warn">
          {item.reviewNote && <p className="font-semibold">メモ：{item.reviewNote}</p>}
          {warnings.length > 0 && (
            <ul className="list-disc pl-5">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section aria-label="処置別の麻酔・鎮痛">
        <h4 className="mb-2 text-sm font-bold">処置別の麻酔・鎮痛（{f.support.length}件）</h4>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th className="py-2 pr-3 font-semibold">処置</th>
                <th className="py-2 pr-3 font-semibold">麻酔・鎮痛</th>
                <th className="py-2 pr-3 font-semibold">状態・確度</th>
                <th className="py-2 pr-3 font-semibold">条件・備考</th>
                <th className="py-2 pr-3 font-semibold">確認日／再確認期限</th>
                <th className="py-2 font-semibold">出典</th>
              </tr>
            </thead>
            <tbody>
              {f.support.map((r) => {
                const due = item.reviewDue[`${r.procedureSlug}|${r.methodSlug}`];
                const s = src(r.sourceId);
                return (
                  <tr key={`${r.procedureSlug}-${r.methodSlug}`} className="border-b border-line align-top">
                    <td className="py-2 pr-3">{procedureBySlug(r.procedureSlug)?.name ?? r.procedureSlug}</td>
                    <td className="py-2 pr-3">{methodBySlug(r.methodSlug)?.name ?? r.methodSlug}</td>
                    <td className="space-y-1 py-2 pr-3">
                      <SupportLabel status={r.supportStatus} methodSlug={r.methodSlug} />
                      <div>
                        <EvidenceBadge status={r.evidenceStatus} />
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      {r.conditions ?? <span className="text-ink-muted">－</span>}
                      {r.notes && <p className="mt-1 text-warn">{r.notes}</p>}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatDate(r.verifiedAt)}
                      <br />
                      <span className={due && due <= today ? "font-bold text-warn" : "text-ink-muted"}>
                        {due ? `期限 ${formatDate(due)}` : "期限なし"}
                      </span>
                    </td>
                    <td className="py-2">
                      {s?.sourceUrl ? (
                        <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                          {s.sourceTitle}
                        </a>
                      ) : (
                        (s?.sourceTitle ?? "－")
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="出典">
        <h4 className="mb-2 text-sm font-bold">出典（{f.sources.length}件）</h4>
        <ul className="space-y-2">
          {f.sources.map((s) => (
            <li key={s.id} className="rounded-lg bg-mist p-3 text-sm">
              <p className="font-semibold">
                {s.sourceUrl ? (
                  <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-4">
                    {s.sourceTitle}
                  </a>
                ) : (
                  s.sourceTitle
                )}
                {s.id === f.basicInfoSourceId && <span className="ml-2 text-xs font-normal text-ink-muted">（住所などの確認）</span>}
              </p>
              <p className="text-ink-muted">
                {SOURCE_TYPE[s.sourceType]} ／ 資料の日付：{s.documentDate ?? "未記入"} ／ 確認日：{formatDate(s.checkedAt)}
              </p>
              {s.evidenceExcerpt && <blockquote className="mt-1 border-l-2 border-lavender-200 pl-2">{s.evidenceExcerpt}</blockquote>}
              {s.notes && <p className="mt-1 text-warn">{s.notes}</p>}
            </li>
          ))}
        </ul>
      </section>

      <ReviewActions slug={item.slug} isPublished={item.isPublished} />
    </article>
  );
}

async function ReviewContent({ searchParams }: { searchParams: SP }) {
  if (!isSupabaseConfigured()) {
    return <p className="rounded-lg bg-warn-bg p-4 text-warn">Supabase が設定されていないため、レビュー画面は使えません（デモデータで動作中）。</p>;
  }
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.key === sp.status)?.key ?? "draft") as ReviewStatus;
  const today = await todayJst();
  const [items, candidates] = await Promise.all([listForReview(session), listResearchCandidates(session)]);
  const shown = items.filter((i) => i.reviewStatus === tab);
  const expiredTotal = items.filter((i) => Object.values(i.reviewDue).some((d) => d && d <= today)).length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">ログイン中：{session.email ?? "管理者"}</p>
        <form action={signOut}>
          <button type="submit" className="min-h-10 rounded-lg border border-line bg-white px-4 text-sm hover:bg-mist">
            ログアウト
          </button>
        </form>
      </div>

      {expiredTotal > 0 && (
        <p role="alert" className="mb-4 rounded-lg bg-warn-bg px-4 py-3 text-sm font-semibold text-warn">
          再確認期限を過ぎた情報を含む医療機関が {expiredTotal} 件あります。
        </p>
      )}

      <nav aria-label="審査状態" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const n = items.filter((i) => i.reviewStatus === t.key).length;
          return (
            <Link
              key={t.key}
              href={`/admin/review?status=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${
                tab === t.key ? "border-primary bg-primary font-bold text-white" : "border-lavender-200 bg-white hover:bg-lavender-50"
              }`}
            >
              {t.label}（{n}）
            </Link>
          );
        })}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-ink-muted">該当する医療機関はありません。</p>
      ) : (
        <div className="space-y-6">
          {shown.map((item) => (
            <FacilityReview key={item.slug} item={item} today={today} />
          ))}
        </div>
      )}

      <section aria-labelledby="candidates" className="mt-12">
        <h2 id="candidates" className="mb-2 text-xl font-bold">
          追加調査候補（{candidates.length}件）
        </h2>
        <p className="mb-4 text-sm text-ink-muted">麻酔方法を公式情報で確認できていない施設です。公開されることはありません。</p>
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {candidates.map((c) => (
            <li key={c.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[8rem_16rem_1fr]">
              <span className="text-ink-muted">{prefByCode(c.prefectureCode)?.name}</span>
              <span className="font-semibold">{c.name}</span>
              <span>{c.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

export default function ReviewPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">公開前レビュー</h1>
      <p className="mb-6 text-sm text-ink-muted">
        登録された医療機関情報を出典と照合し、承認したものだけを公開します。承認・差し戻しは監査ログに記録されます。
      </p>
      <Suspense fallback={<p className="text-ink-muted">読み込んでいます…</p>}>
        <ReviewContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
