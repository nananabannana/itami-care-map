import type { Metadata } from "next";
import { formatDate } from "@/components/Badges";
import { AdminPage } from "../AdminPage";
import { RevertButton } from "./RevertButton";

export const metadata: Metadata = { title: "取り込み履歴", robots: { index: false, follow: false } };

const SUMMARY_LABEL: Record<string, string> = {
  total: "対象", new: "新規", update_candidate: "更新候補", unchanged: "変更なし", facility_match: "既存施設と一致",
  possible_duplicate: "重複の可能性", duplicate_in_file: "ファイル内重複", fetched: "取得", prefectures: "都道府県",
};

export default function ImportHistoryPage() {
  return (
    <AdminPage current="/admin/import" title="取り込み履歴" lead="ナビイ・JALAの取り込みごとの記録です。取り込みは取り消せます。">
      {async (session) => {
        const { data, error } = await session.client
          .from("import_batches")
          .select("id, source, label, data_date, file_names, summary, created_at, reverted_at")
          .order("created_at", { ascending: false })
          .limit(50);
        if (error) return <p className="rounded-lg bg-warn-bg p-4 text-warn">取り込み履歴を読めませんでした（0004 のマイグレーションが未実行の可能性があります）：{error.message}</p>;
        if (!data?.length) return <p className="rounded-xl border border-dashed border-line p-6 text-center text-ink-muted">まだ取り込みはありません。</p>;
        return (
          <ul className="space-y-3">
            {data.map((b) => (
              <li key={b.id} className="rounded-xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{b.label}</p>
                    <p className="text-sm text-ink-muted">
                      {b.source === "navii" ? "ナビイ" : "JALA"} ／ 実行：{new Date(b.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                      {b.data_date && ` ／ データ基準日：${formatDate(b.data_date)}`}
                    </p>
                    <p className="mt-1 text-sm">
                      {Object.entries(b.summary ?? {})
                        .filter(([, v]) => typeof v === "number" && v > 0)
                        .map(([k, v]) => `${SUMMARY_LABEL[k] ?? k} ${v}`)
                        .join("／")}
                    </p>
                    {b.file_names?.length > 0 && <p className="mt-1 break-all text-xs text-ink-muted">{b.file_names.join("、")}</p>}
                  </div>
                  {b.reverted_at ? (
                    <span className="rounded bg-ev-d-bg px-2 py-1 text-sm text-ev-d">取り消し済み（{new Date(b.reverted_at).toLocaleDateString("ja-JP")}）</span>
                  ) : (
                    <RevertButton batchId={b.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        );
      }}
    </AdminPage>
  );
}
