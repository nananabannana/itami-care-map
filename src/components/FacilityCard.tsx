import Link from "next/link";
import { careLabel, methodBySlug, procedureBySlug, SOURCE_TYPE } from "@/lib/master";
import type { CareItemKey, SearchFilters, SearchResult } from "@/lib/types";
import { CareStatusLabel, EvidenceBadge, SupportLabel, VerifiedDate, VerifySummary } from "./Badges";

const CARD_CARE: CareItemKey[] = ["stop_on_request", "pain_management_consultation", "female_doctor_available"];
const MAX_ROWS = 3;

export function FacilityCard({
  result,
  filters,
  today,
}: {
  result: SearchResult;
  filters: SearchFilters;
  today: string;
}) {
  const { facility: f, matched, tier, latestVerifiedAt } = result;
  const hasTreatmentFilter = !!(filters.procedure || filters.method);
  const shown = matched.slice(0, MAX_ROWS);
  const sourceTypes = [...new Set(f.sources.map((s) => SOURCE_TYPE[s.sourceType]))];
  const procedureName = filters.procedure ? procedureBySlug(filters.procedure)?.name : undefined;
  const methodName = filters.method ? methodBySlug(filters.method)?.name : undefined;

  return (
    <article className="rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(43,39,51,0.04)] sm:p-5">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <VerifySummary tier={tier} />
          {f.isDemo && (
            <span className="rounded bg-warn-bg px-1.5 text-xs font-semibold text-warn">デモデータ</span>
          )}
          <span className="text-xs text-ink-muted">{f.facilityType === "hospital" ? "病院" : "診療所"}</span>
          {f.departments.length > 0 && <span className="text-xs text-ink-muted">{f.departments.join("・")}</span>}
        </div>
        <h3 className="text-lg font-bold leading-snug">
          <Link href={`/facilities/${f.id}`} className="text-primary underline-offset-4 hover:underline">
            {f.name}
          </Link>
        </h3>
        <p className="text-sm text-ink-muted">
          {f.address}
          {f.nearestStations.length > 0 && <>（最寄り：{f.nearestStations.join("・")}）</>}
        </p>
      </header>

      <section className="mt-4" aria-label="麻酔・鎮痛対応">
        <h4 className="text-sm font-semibold">麻酔・鎮痛対応</h4>
        {shown.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {shown.map((r) => (
              <li
                key={`${r.procedureSlug}-${r.methodSlug}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-mist px-3 py-2 text-sm"
              >
                <span className="font-medium">{procedureBySlug(r.procedureSlug)?.name}</span>
                <span aria-hidden="true" className="text-ink-muted">
                  ／
                </span>
                <span>{methodBySlug(r.methodSlug)?.name}</span>
                <SupportLabel status={r.supportStatus} methodSlug={r.methodSlug} />
                <EvidenceBadge status={r.evidenceStatus} />
              </li>
            ))}
            {matched.length > MAX_ROWS && (
              <li className="text-sm text-ink-muted">ほか{matched.length - MAX_ROWS}件は詳細ページに掲載</li>
            )}
          </ul>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-ink-muted">
            {hasTreatmentFilter
              ? `${[procedureName, methodName].filter(Boolean).join("・")}の麻酔・鎮痛対応は未確認です。対応しているという意味ではありません。`
              : "処置ごとの麻酔・鎮痛対応は未確認です。"}
          </p>
        )}
        {tier === 3 && shown.length === 0 && (
          <p className="mt-1 text-sm text-ink-muted">痛みや麻酔について事前に相談できることは確認できています。</p>
        )}
      </section>

      <section className="mt-4" aria-label="痛みへの配慮">
        <h4 className="text-sm font-semibold">痛みへの配慮</h4>
        <dl className="mt-1 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          {CARD_CARE.map((key) => {
            const item = f.care.find((c) => c.key === key);
            return (
              <div key={key} className="flex justify-between gap-2 sm:block">
                <dt className="text-ink-muted">{careLabel(key)}</dt>
                <dd>
                  <CareStatusLabel status={item?.status ?? "unknown"} />
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <footer className="mt-4 flex flex-col gap-2 border-t border-line pt-3 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p>
            情報確認日：
            <VerifiedDate date={latestVerifiedAt} today={today} />
          </p>
          <p>出典：{sourceTypes.length ? sourceTypes.join("・") : "なし"}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {f.websiteUrl && (
            <a href={f.websiteUrl} className="text-primary underline underline-offset-4" rel="noopener noreferrer" target="_blank">
              公式サイト<span className="sr-only">（新しいタブで開きます）</span>
            </a>
          )}
          <Link
            href={`/facilities/${f.id}`}
            className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 font-semibold text-white hover:bg-primary-strong"
          >
            詳細を見る<span className="sr-only">：{f.name}</span>
          </Link>
        </div>
      </footer>
    </article>
  );
}
