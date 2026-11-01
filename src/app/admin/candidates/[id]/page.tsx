import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceBadge, formatDate, SupportLabel } from "@/components/Badges";
import { CANDIDATE_STATUS, MATCH_KIND, VERIFICATION_METHOD, type CandidateStatusKey } from "@/lib/candidate-labels";
import { prefByCode } from "@/lib/master";
import { todayJst } from "@/lib/today";
import type { EvidenceStatus, SupportStatus } from "@/lib/types";
import { AdminPage } from "../../AdminPage";
import { ApplyChanges, DeleteEvidence, EvidenceForm, StatusControl } from "./CandidateTools";

export const metadata: Metadata = { title: "掲載候補の詳細", robots: { index: false, follow: false } };

const FIELD_LABEL: Record<string, string> = {
  name: "名称", address: "住所", city: "市区町村", website_url: "ホームページ", consultation_hours: "診療時間",
  departments: "診療科", latitude: "緯度", longitude: "経度",
};
const show = (v: unknown) => (Array.isArray(v) ? v.join("・") : v == null || v === "" ? "（空欄）" : String(v));

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-2 sm:grid-cols-[9rem_1fr]">
      <dt className="text-sm font-semibold text-ink-muted">{k}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default function CandidateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AdminPage current="/admin/candidates" title="掲載候補の詳細">
      {async (session) => {
        const { id } = await params;
        if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
        const today = await todayJst();
        const { data: c, error } = await session.client
          .from("listing_candidates")
          .select(
            "*, matched:facilities!listing_candidates_matched_facility_id_fkey(slug, name, address, is_published), promoted:facilities!listing_candidates_promoted_facility_id_fkey(slug, review_status), candidate_evidence(id, support_status, conditions, evidence_status, verification_method, source_url, source_title, evidence_excerpt, contacted_department, document_date, verified_at, procedures(name), anesthesia_methods(name)), jala_facilities!jala_facilities_matched_candidate_id_fkey(name, jala_url, website_url, phone, fetched_at)",
          )
          .eq("id", id)
          .maybeSingle();
        if (error) return <p className="rounded-lg bg-warn-bg p-4 text-warn">{error.message}</p>;
        if (!c) notFound();

        const status = c.status as CandidateStatusKey;
        const evidence = (c.candidate_evidence ?? []) as {
          id: string; support_status: SupportStatus; conditions: string | null; evidence_status: EvidenceStatus; verification_method: string;
          source_url: string | null; source_title: string | null; evidence_excerpt: string; contacted_department: string | null;
          document_date: string | null; verified_at: string; procedures: { name: string }; anesthesia_methods: { name: string };
        }[];
        const matched = c.matched as { slug: string; name: string; address: string; is_published: boolean } | null;
        const promoted = c.promoted as { slug: string; review_status: string } | null;
        const jala = (c.jala_facilities ?? []) as { name: string; jala_url: string; website_url: string | null; phone: string | null; fetched_at: string }[];
        const pending = (c.pending_changes ?? {}) as Record<string, { current: unknown; incoming: unknown }>;
        const hasEvidence = evidence.some((e) => e.support_status !== "not_offered");

        return (
          <div className="space-y-8">
            <p className="text-sm">
              <Link href="/admin/candidates" className="text-primary underline underline-offset-4">← 掲載候補の一覧へ</Link>
            </p>
            <header className="space-y-2">
              <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-bold ${CANDIDATE_STATUS[status].className}`}>{CANDIDATE_STATUS[status].label}</span>
              <h2 className="text-xl font-bold">{c.name}</h2>
              {c.name_kana && <p className="text-sm text-ink-muted">{c.name_kana}</p>}
              {c.website_url ? (
                <p>
                  <a href={c.website_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4">
                    公式サイトを開いて麻酔・鎮痛の記載を探す<span className="sr-only">（新しいタブで開きます）</span>
                  </a>
                </p>
              ) : (
                <p className="text-sm text-warn">公式サイトのURLが取り込みデータにありません。名称で検索して公式サイトを探してください。</p>
              )}
            </header>

            <section aria-labelledby="basic">
              <h3 id="basic" className="mb-2 font-bold">基本情報（取り込みデータ）</h3>
              <dl className="divide-y divide-line rounded-xl border border-line bg-white">
                <Row k="所在地">{prefByCode(c.prefecture_code)?.name} {c.city} ／ {c.address}</Row>
                <Row k="郵便番号">{c.postal_code ?? "未確認"}</Row>
                <Row k="電話番号">{c.phone ?? "未確認"}</Row>
                <Row k="種別">{c.facility_type === "hospital" ? "病院" : "診療所"}</Row>
                <Row k="診療科">{c.departments?.join("・") || "未確認"}</Row>
                <Row k="婦人科系の診療時間">{c.consultation_hours ?? "未確認"}</Row>
                <Row k="データ取得元">{c.data_source}</Row>
                <Row k="データ基準日">{c.data_date ? formatDate(c.data_date) : "未確認"}</Row>
                <Row k="ナビイID">{c.navii_key ?? "－"}</Row>
              </dl>
            </section>

            {matched && (
              <section aria-labelledby="matched" className="space-y-3 rounded-xl border border-warn bg-warn-bg/40 p-4">
                <h3 id="matched" className="font-bold">既存の掲載施設と一致しています（新規登録はしません）</h3>
                <p className="text-sm">
                  一致した施設：<Link href={`/facilities/${matched.slug}`} className="text-primary underline">{matched.name}</Link>（{matched.is_published ? "公開中" : "非公開"}）／
                  判定：{MATCH_KIND[c.match_kind ?? ""] ?? c.match_kind}
                </p>
                {Object.keys(pending).length ? (
                  <>
                    <p className="text-sm">取り込みデータとの差分です。掲載施設は自動では変わりません。反映したい項目だけを選んでください。</p>
                    <ApplyChanges id={c.id} fields={Object.entries(pending).map(([k, v]) => ({ key: k, label: FIELD_LABEL[k] ?? k, current: show(v.current), incoming: show(v.incoming) }))} />
                  </>
                ) : (
                  <p className="text-sm">差分はありません。</p>
                )}
              </section>
            )}

            {jala.length > 0 && (
              <section aria-labelledby="jala" className="rounded-xl border border-line bg-white p-4 text-sm">
                <h3 id="jala" className="mb-2 font-bold">JALA（無痛分娩）</h3>
                {jala.map((j) => (
                  <p key={j.jala_url}>
                    全国無痛分娩施設検索に掲載：<a href={j.jala_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{j.name}</a>（取得日 {formatDate(j.fetched_at)}）
                  </p>
                ))}
                <p className="mt-2 text-warn">この情報は分娩時の麻酔（無痛分娩）に関するものです。ラミナリアや子宮鏡などの婦人科処置の根拠にはしないでください。</p>
              </section>
            )}

            <section aria-labelledby="ev" className="space-y-4">
              <h3 id="ev" className="font-bold">処置ごとの麻酔・鎮痛の根拠（{evidence.length}件）</h3>
              {evidence.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-line bg-white">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-mist text-left">
                      <tr>
                        <th className="px-3 py-2">処置／麻酔・鎮痛</th>
                        <th className="px-3 py-2">状況・確度</th>
                        <th className="px-3 py-2">根拠</th>
                        <th className="px-3 py-2">確認</th>
                        <th className="px-3 py-2"><span className="sr-only">操作</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidence.map((e) => (
                        <tr key={e.id} className="border-t border-line align-top">
                          <td className="px-3 py-2">{e.procedures.name}<br />{e.anesthesia_methods.name}{e.conditions && <p className="text-xs text-ink-muted">{e.conditions}</p>}</td>
                          <td className="space-y-1 px-3 py-2"><SupportLabel status={e.support_status} /><div><EvidenceBadge status={e.evidence_status} /></div></td>
                          <td className="px-3 py-2">
                            {e.source_url && <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline">{e.source_title ?? e.source_url}</a>}
                            <blockquote className="mt-1 border-l-2 border-lavender-200 pl-2">{e.evidence_excerpt}</blockquote>
                            {e.document_date && <p className="text-xs text-ink-muted">資料の日付：{e.document_date}</p>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">{VERIFICATION_METHOD[e.verification_method]}{e.contacted_department && `（${e.contacted_department}）`}<br />{formatDate(e.verified_at)}</td>
                          <td className="px-3 py-2">{!promoted && <DeleteEvidence id={e.id} />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!promoted && !matched && (
                <div className="rounded-xl border border-line bg-white p-4">
                  <h4 className="mb-3 text-sm font-bold">根拠を追加</h4>
                  <EvidenceForm id={c.id} today={today} />
                </div>
              )}
              {matched && <p className="text-sm text-ink-muted">既存の掲載施設の処置情報は、調査データ（SQL）で追加してください。</p>}
            </section>

            <section aria-labelledby="st" className="rounded-xl border border-lavender-200 bg-lavender-50 p-4">
              <h3 id="st" className="mb-3 font-bold">確認状況</h3>
              {promoted ? (
                <p className="text-sm">
                  掲載施設の下書き（{promoted.slug}）へ送付済みです。<Link href="/admin/review" className="text-primary underline">公開前レビュー</Link>で承認すると公開されます。
                </p>
              ) : (
                <StatusControl id={c.id} status={status} note={c.status_note} canPromote={status === "publishable" && hasEvidence && !matched} />
              )}
              {!hasEvidence && <p className="mt-2 text-xs text-ink-muted">麻酔・鎮痛の根拠（実施または個別相談）が1件以上ないと「掲載可能」にできません。</p>}
            </section>
          </div>
        );
      }}
    </AdminPage>
  );
}
