import { METHODS, PROCEDURES } from "@/lib/master";
import { PrefCitySelect } from "./PrefCitySelect";

const selectClass = "block min-h-12 w-full rounded-lg border border-line bg-white px-3 text-base text-ink";

export function HeroSearch({ citiesByPref }: { citiesByPref: Record<number, string[]> }) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      aria-label="医療機関を探す"
      className="grid gap-4 rounded-2xl border border-lavender-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-6"
    >
      <PrefCitySelect citiesByPref={citiesByPref} />
      <div>
        <label htmlFor="hero-procedure" className="mb-1 block text-sm font-semibold">
          処置内容
        </label>
        <select id="hero-procedure" name="procedure" defaultValue="" className={selectClass}>
          <option value="">指定しない</option>
          {PROCEDURES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="hero-method" className="mb-1 block text-sm font-semibold">
          麻酔・鎮痛方法
        </label>
        <select id="hero-method" name="method" defaultValue="" className={selectClass}>
          <option value="">指定しない</option>
          {METHODS.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          className="min-h-12 w-full rounded-lg bg-primary px-6 font-bold text-white hover:bg-primary-strong"
        >
          この条件で探す
        </button>
      </div>
    </form>
  );
}
