import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CareStatusLabel, EvidenceBadge, formatDate, SupportLabel, VerifiedDate } from "@/components/Badges";
import { CARE_ITEMS, methodBySlug, prefByCode, PROCEDURES, SOURCE_TYPE } from "@/lib/master";
import { getRepository } from "@/lib/repository";
import { todayJst } from "@/lib/today";
import type { ExtraFee, Facility, Source } from "@/lib/types";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const f = await getRepository().getById((await params).id);
  return { title: f ? f.name : "医療機関が見つかりません" };
}

const FEE: Record<ExtraFee, string> = { none: "追加費用なし", required: "追加費用あり", unknown: "未確認" };

function SourceRef({ source }: { source?: Source }) {
  if (!source) return <span className="text-ink-muted">出典なし</span>;
  return (
    <a href={`#source-${source.id}`} className="text-primary underline underline-offset-4">
      {source.sourceTitle}
    </a>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-4">
      <h2 id={id} className="mb-4 border-b border-line pb-2 text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function BasicInfo({ f }: { f: Facility }) {
  const pref = prefByCode(f.prefectureCode);
  const basicSource = f.sources.find((s) => s.id === f.basicInfoSourceId);
  const rows: [string, React.ReactNode][] = [
    ["医療機関名", f.name],
    ["住所", f.address],
    ["電話番号", f.phone ?? "未確認"],
    [
      "公式サイト",
      f.websiteUrl ? (
        <a href={f.websiteUrl} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-4">
          {f.websiteUrl}
          <span className="sr-only">（新しいタブで開きます）</span>
        </a>
      ) : (
        "未確認"
      ),
    ],
    ["最寄り駅", f.nearestStations.length ? f.nearestStations.join("・") : "未確認"],
    ["診療時間", f.consultationHours ?? "未確認（受診前に医療機関へご確認ください）"],
    ["診療科目", f.departments.join("・")],
    ["種別", f.facilityType === "hospital" ? "病院" : "診療所"],
  ];
  return (
    <>
      <dl className="divide-y divide-line rounded-xl border border-line bg-white">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
            <dt className="text-sm font-semibold text-ink-muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
          <dt className="text-sm font-semibold text-ink-muted">地図</dt>
          <dd className="text-sm text-ink-muted">
            地図表示は今後対応予定です。{pref?.name}
            {f.city}
          </dd>
        </div>
      </dl>
      {basicSource && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          基本情報の出典：<SourceRef source={basicSource} />
          <EvidenceBadge status="D" />
        </p>
      )}
    </>
  );
}

function SupportSection({ f, today }: { f: Facility; today: string }) {
  const src = (id?: string) => f.sources.find((s) => s.id === id);
  return (
    <>
      <p className="mb-4 text-sm text-ink-muted">
        処置ごとに、確認できた麻酔・鎮痛方法を掲載しています。ある処置で麻酔に対応していても、ほかの処置でも対応しているとは限りません。
      </p>
      <ul className="space-y-4">
        {PROCEDURES.map((p) => {
          const rows = f.support.filter((r) => r.procedureSlug === p.slug);
          return (
            <li key={p.slug} className="rounded-xl border border-line bg-white">
              <h3 className="rounded-t-xl bg-mist px-4 py-2 font-semibold">{p.name}</h3>
              {rows.length === 0 ? (
                <p className="px-4 py-3 text-sm text-ink-muted">
                  <SupportLabel status="unknown" />
                  <span className="ml-2">この処置の麻酔・鎮痛対応は確認できていません。</span>
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {rows.map((r) => (
                    <li key={r.methodSlug} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{methodBySlug(r.methodSlug)?.name}</span>
                        <SupportLabel status={r.supportStatus} />
                        <EvidenceBadge status={r.evidenceStatus} />
                      </div>
                      <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-ink-muted">実施条件</dt>
                          <dd>{r.conditions ?? "未確認"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-ink-muted">診療日・体制</dt>
                          <dd>{r.scheduleNote ?? "未確認"}</dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-ink-muted">追加費用</dt>
                          <dd>
                            {FEE[r.extraFee]}
                            {r.extraFeeNote && `（${r.extraFeeNote}）`}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-ink-muted">確認日</dt>
                          <dd>
                            <VerifiedDate date={r.verifiedAt} today={today} />
                          </dd>
                        </div>
                        <div className="flex gap-2 sm:col-span-2">
                          <dt className="shrink-0 text-ink-muted">出典</dt>
                          <dd>
                            <SourceRef source={src(r.sourceId)} />
                          </dd>
                        </div>
                        {r.notes && (
                          <div className="flex gap-2 sm:col-span-2">
                            <dt className="shrink-0 text-ink-muted">備考</dt>
                            <dd>{r.notes}</dd>
                          </div>
                        )}
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function CareSection({ f, today }: { f: Facility; today: string }) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-white">
      {CARE_ITEMS.map(({ key, label }) => {
        const c = f.care.find((x) => x.key === key);
        const source = f.sources.find((s) => s.id === c?.sourceId);
        return (
          <li key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[14rem_1fr]">
            <span className="font-semibold">{label}</span>
            <div className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <CareStatusLabel status={c?.status ?? "unknown"} />
                <EvidenceBadge status={c?.evidenceStatus ?? "U"} />
              </div>
              {c?.note && <p>{c.note}</p>}
              {c && c.evidenceStatus !== "U" && (
                <p className="text-ink-muted">
                  確認日：<VerifiedDate date={c.verifiedAt} today={today} />／出典：<SourceRef source={source} />
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function SourceSection({ f, today }: { f: Facility; today: string }) {
  if (f.sources.length === 0) return <p className="text-ink-muted">出典はありません。</p>;
  return (
    <ol className="space-y-3">
      {f.sources.map((s) => (
        <li key={s.id} id={`source-${s.id}`} className="scroll-mt-4 rounded-xl border border-line bg-white p-4 text-sm">
          <p className="font-semibold">{s.sourceTitle}</p>
          <dl className="mt-1 space-y-1">
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-muted">種別</dt>
              <dd>{SOURCE_TYPE[s.sourceType]}</dd>
            </div>
            {s.contactedDepartment && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-ink-muted">確認先</dt>
                <dd>{s.contactedDepartment}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="shrink-0 text-ink-muted">確認日</dt>
              <dd>
                <VerifiedDate date={s.checkedAt} today={today} />
              </dd>
            </div>
            {s.sourceUrl && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-ink-muted">URL</dt>
                <dd>
                  <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-4">
                    {s.sourceUrl}
                    <span className="sr-only">（新しいタブで開きます）</span>
                  </a>
                </dd>
              </div>
            )}
            {s.evidenceExcerpt && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-ink-muted">根拠</dt>
                <dd>
                  <blockquote className="border-l-2 border-lavender-200 pl-2">{s.evidenceExcerpt}</blockquote>
                </dd>
              </div>
            )}
          </dl>
        </li>
      ))}
    </ol>
  );
}

async function FacilityDetail({ f }: { f: Facility }) {
  const today = await todayJst();
  const pref = prefByCode(f.prefectureCode);
  const latest = [...f.support.map((r) => r.verifiedAt), ...f.care.map((c) => c.verifiedAt)]
    .filter((d): d is string => !!d)
    .sort()
    .at(-1);

  return (
    <article className="mx-auto max-w-4xl px-4 py-8">
      <nav aria-label="パンくずリスト" className="mb-4 text-sm text-ink-muted">
        <ol className="flex flex-wrap gap-1">
          <li>
            <Link href="/" className="underline underline-offset-4">トップ</Link> ›
          </li>
          {pref && (
            <li>
              <Link href={`/search?pref=${pref.code}`} className="underline underline-offset-4">
                {pref.name}
              </Link>{" "}
              ›
            </li>
          )}
          <li aria-current="page">{f.name}</li>
        </ol>
      </nav>

      <header className="mb-8">
        {f.isDemo && (
          <p className="mb-2 inline-block rounded bg-warn-bg px-2 py-0.5 text-sm font-semibold text-warn">
            デモデータ：実在の医療機関ではありません
          </p>
        )}
        <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{f.name}</h1>
        <p className="mt-1 text-ink-muted">{f.address}</p>
        <p className="mt-2 text-sm text-ink-muted">最終確認日：{formatDate(latest)}</p>
        <nav aria-label="ページ内リンク" className="mt-4">
          <ul className="flex flex-wrap gap-2 text-sm">
            {[
              ["#support", "麻酔・鎮痛対応"],
              ["#care", "患者への配慮"],
              ["#basic", "基本情報"],
              ["#sources", "出典"],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="inline-flex min-h-10 items-center rounded-full border border-lavender-200 px-3 hover:bg-lavender-50">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="space-y-12">
        <Section id="support" title="麻酔・鎮痛対応">
          <SupportSection f={f} today={today} />
        </Section>
        <Section id="care" title="患者への配慮">
          <CareSection f={f} today={today} />
        </Section>
        <Section id="basic" title="基本情報">
          <BasicInfo f={f} />
        </Section>
        <Section id="sources" title="情報の出典">
          <SourceSection f={f} today={today} />
        </Section>

        <aside className="space-y-3 rounded-xl bg-mist p-5 text-sm">
          <p>
            掲載内容は確認日時点のものです。麻酔・鎮痛の方法や体制は変わることがあります。受診前に必ず医療機関へ直接ご確認ください。
          </p>
          <p>
            「未確認」は対応していないという意味ではなく、情報を確認できていないことを示します。
          </p>
          <p>
            <Link href={`/corrections?facility=${f.id}`} className="text-primary underline underline-offset-4">
              この医療機関の情報の修正を依頼する
            </Link>
          </p>
        </aside>
      </div>
    </article>
  );
}

export async function generateStaticParams() {
  return getRepository().listIds().then((ids) => ids.map((id) => ({ id })));
}

// 存在確認はストリーミング開始前に行い、存在しないIDには HTTP 404 を返す
export default async function FacilityPage({ params }: { params: Params }) {
  const f = await getRepository().getById((await params).id);
  if (!f) notFound();
  return (
    <Suspense fallback={<p className="mx-auto max-w-4xl px-4 py-8 text-ink-muted">読み込んでいます…</p>}>
      <FacilityDetail f={f} />
    </Suspense>
  );
}
