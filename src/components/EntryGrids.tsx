import Link from "next/link";
import { EVIDENCE, SEARCHABLE_METHODS, PREFECTURES, PROCEDURES, REGIONS } from "@/lib/master";
import { BORDER, prefHref, REGION_FILL } from "@/lib/map-scale";
import type { EvidenceStatus } from "@/lib/types";
import { EvidenceBadge } from "./Badges";

/** 地域別の都道府県一覧。地図と同じURL（prefHref）に遷移する。0件の都道府県も検索できる */
export function PrefectureGrid({ counts }: { counts: Record<number, number> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {REGIONS.map((r) => (
        <section key={r.key} aria-labelledby={`region-${r.key}`} className="rounded-xl border border-line bg-white p-4">
          <h3 id={`region-${r.key}`} className="flex items-center gap-2 text-sm font-bold text-ink">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm border" style={{ background: REGION_FILL[r.key], borderColor: BORDER }} />
            {r.name}
          </h3>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {PREFECTURES.filter((p) => p.region === r.key).map((p) => {
              const n = counts[p.code] ?? 0;
              return (
                <li key={p.code}>
                  <Link
                    href={prefHref(p.code)}
                    aria-label={`${p.name}（掲載${n}件）`}
                    className={`flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-sm ${
                      n > 0
                        ? "border-lavender-200 bg-lavender-50 hover:bg-lavender-100"
                        : "border-line bg-white hover:bg-mist"
                    }`}
                  >
                    <span className="font-medium text-ink">{p.name}</span>
                    <span className={`text-xs tabular-nums ${n > 0 ? "font-bold text-primary" : "text-ink-muted"}`}>{n}件</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ProcedureGrid() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {PROCEDURES.map((p, i) => (
        <li key={p.slug}>
          <Link
            href={`/search?procedure=${p.slug}`}
            className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 hover:border-lavender-200 hover:bg-lavender-50"
          >
            <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blush-50 text-sm font-semibold text-blush-700">
              {i + 1}
            </span>
            <span className="font-medium">{p.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function MethodGrid() {
  return (
    <ul className="flex flex-wrap gap-2">
      {SEARCHABLE_METHODS.map((m) => (
        <li key={m.slug}>
          <Link
            href={`/search?method=${m.slug}`}
            className="inline-flex min-h-11 items-center rounded-full border border-lavender-200 bg-white px-4 text-sm hover:bg-lavender-50"
          >
            {m.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function EvidenceLegend() {
  return (
    <ul className="space-y-2">
      {(Object.keys(EVIDENCE) as EvidenceStatus[]).map((k) => (
        <li key={k} className="flex flex-wrap items-center gap-2 text-sm">
          <EvidenceBadge status={k} />
          <span>{EVIDENCE[k].label}</span>
        </li>
      ))}
    </ul>
  );
}
