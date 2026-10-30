import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FacilityCard } from "@/components/FacilityCard";
import { FilterPanel } from "@/components/FilterPanel";
import { CARE_ITEMS, methodBySlug, prefByCode, procedureBySlug, TIER_LABEL } from "@/lib/master";
import { getRepository } from "@/lib/repository";
import { parseFilters } from "@/lib/search";
import { todayJst } from "@/lib/today";
import type { SearchFilters, Tier } from "@/lib/types";

export const metadata: Metadata = { title: "医療機関を探す" };

type SP = Promise<Record<string, string | string[] | undefined>>;

function describe(f: SearchFilters): string[] {
  const out: string[] = [];
  const pref = f.pref ? prefByCode(f.pref)?.name : undefined;
  if (pref) out.push(f.city ? `${pref}${f.city}` : pref);
  if (f.procedure) out.push(procedureBySlug(f.procedure)?.name ?? f.procedure);
  if (f.method) out.push(methodBySlug(f.method)?.name ?? f.method);
  if (f.q) out.push(`「${f.q}」`);
  const label = (k: string) => CARE_ITEMS.find((c) => c.key === k)?.filterLabel ?? k;
  if (f.femaleDoctor) out.push(label("female_doctor_available"));
  if (f.consultOnly) out.push(label("consultation_only"));
  if (f.stopOnRequest) out.push(label("stop_on_request"));
  if (f.evidence?.includes("A")) out.push("公式情報で確認済み");
  if (f.evidence?.includes("B")) out.push("直接確認済み");
  return out;
}

async function SearchContent({ searchParams }: { searchParams: SP }) {
  const filters = parseFilters(await searchParams);
  const today = await todayJst();
  const repo = getRepository();
  const [results, citiesByPref] = await Promise.all([repo.search(filters), repo.listCities()]);
  const conditions = describe(filters);
  const tiers = ([1, 2, 3, 4] as Tier[])
    .map((t) => ({ tier: t, items: results.filter((r) => r.tier === t) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      <aside aria-labelledby="filter-title" className="lg:sticky lg:top-4 lg:self-start">
        <h2 id="filter-title" className="mb-3 text-base font-bold">
          検索条件
        </h2>
        <FilterPanel filters={filters} citiesByPref={citiesByPref} />
      </aside>

      <section aria-labelledby="result-title" aria-live="polite">
        <h2 id="result-title" className="text-base font-bold">
          検索結果 <span className="text-2xl text-primary">{results.length}</span> 件
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {conditions.length ? `条件：${conditions.join("／")}` : "条件：全国・すべての医療機関"}
        </p>
        <p className="mt-2 rounded-lg bg-lavender-50 px-3 py-2 text-sm">
          並び順は情報の確認状況で決まります（公式情報で確認 → 直接確認 → 個別相談可 → 未確認）。広告料・掲載料による順位の変動はありません。
        </p>

        {results.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-line p-6 text-center">
            <p className="font-semibold">条件に合う医療機関が見つかりませんでした。</p>
            <p className="mt-2 text-sm text-ink-muted">
              こだわり条件を外すか、地域を広げてお試しください。掲載がないことは、その地域に対応できる医療機関がないことを意味しません。
            </p>
            <Link href="/search" className="mt-4 inline-block text-primary underline underline-offset-4">
              条件をクリアする
            </Link>
          </div>
        ) : (
          <div className="mt-6 space-y-10">
            {tiers.map((g) => (
              <section key={g.tier} aria-labelledby={`tier-${g.tier}`}>
                <div className={`mb-4 border-l-4 pl-3 ${g.tier === 4 ? "border-line" : "border-primary"}`}>
                  <h3 id={`tier-${g.tier}`} className="font-bold">
                    {TIER_LABEL[g.tier].title}（{g.items.length}件）
                  </h3>
                  <p className="text-sm text-ink-muted">{TIER_LABEL[g.tier].description}</p>
                </div>
                <ul className="space-y-4">
                  {g.items.map((r) => (
                    <li key={r.facility.id}>
                      <FacilityCard result={r} filters={filters} today={today} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function SearchPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">医療機関を探す</h1>
      <Suspense fallback={<p className="text-ink-muted">検索しています…</p>}>
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
