import Link from "next/link";
import { CARE_ITEMS, SEARCHABLE_METHODS, PROCEDURES } from "@/lib/master";
import type { SearchFilters } from "@/lib/types";
import { PrefCitySelect } from "./PrefCitySelect";

const selectClass = "block min-h-12 w-full rounded-lg border border-line bg-white px-3 text-base text-ink";

function Check({ name, value = "1", checked, label }: { name: string; value?: string; checked: boolean; label: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 hover:bg-lavender-50">
      <input
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={checked}
        className="h-5 w-5 shrink-0 accent-[var(--color-primary)]"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

const careLabel = (key: string) => CARE_ITEMS.find((c) => c.key === key)?.filterLabel ?? key;

export function FilterPanel({
  filters,
  citiesByPref,
}: {
  filters: SearchFilters;
  citiesByPref: Record<number, string[]>;
}) {
  const advancedCount =
    [filters.femaleDoctor, filters.consultOnly, filters.stopOnRequest].filter(Boolean).length +
    (filters.evidence?.length ?? 0);

  return (
    <form action="/search" method="get" role="search" aria-label="検索条件" className="space-y-4">
      <PrefCitySelect citiesByPref={citiesByPref} defaultPref={filters.pref} defaultCity={filters.city} />
      <div>
        <label htmlFor="f-procedure" className="mb-1 block text-sm font-semibold">
          処置内容
        </label>
        <select id="f-procedure" name="procedure" defaultValue={filters.procedure ?? ""} className={selectClass}>
          <option value="">指定しない</option>
          {PROCEDURES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="f-method" className="mb-1 block text-sm font-semibold">
          麻酔・鎮痛方法
        </label>
        <select id="f-method" name="method" defaultValue={filters.method ?? ""} className={selectClass}>
          <option value="">指定しない</option>
          {SEARCHABLE_METHODS.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="f-q" className="mb-1 block text-sm font-semibold">
          キーワード
        </label>
        <input
          id="f-q"
          name="q"
          type="search"
          defaultValue={filters.q ?? ""}
          maxLength={50}
          placeholder="医療機関名、駅名など"
          className="block min-h-12 w-full rounded-lg border border-line px-3 text-base placeholder:text-ink-muted"
        />
      </div>

      <details open={advancedCount > 0} className="rounded-lg border border-line px-3 py-2">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">
          こだわり条件{advancedCount > 0 && `（${advancedCount}件選択中）`}
        </summary>
        <fieldset className="mt-1">
          <legend className="text-xs text-ink-muted">患者への配慮（確認できたもののみ）</legend>
          <Check name="female_doctor" checked={!!filters.femaleDoctor} label={careLabel("female_doctor_available")} />
          <Check name="consult_only" checked={!!filters.consultOnly} label={careLabel("consultation_only")} />
          <Check name="stop_on_request" checked={!!filters.stopOnRequest} label={careLabel("stop_on_request")} />
        </fieldset>
        <fieldset className="mt-3 pb-1">
          <legend className="text-xs text-ink-muted">情報の確認方法（処置の実施を確認できたもの）</legend>
          <Check name="evidence" value="A" checked={!!filters.evidence?.includes("A")} label="公式情報で確認済み" />
          <Check name="evidence" value="B" checked={!!filters.evidence?.includes("B")} label="医療機関に直接確認済み" />
        </fieldset>
      </details>

      <div className="flex gap-3">
        <button type="submit" className="min-h-12 flex-1 rounded-lg bg-primary px-4 font-bold text-white hover:bg-primary-strong">
          検索する
        </button>
        <Link href="/search" className="inline-flex min-h-12 items-center rounded-lg border border-line px-4 text-sm hover:bg-mist">
          条件をクリア
        </Link>
      </div>
    </form>
  );
}
