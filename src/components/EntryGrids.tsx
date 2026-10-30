import Link from "next/link";
import { EVIDENCE, METHODS, PREFECTURES, PROCEDURES, REGIONS } from "@/lib/master";
import type { EvidenceStatus } from "@/lib/types";
import { EvidenceBadge } from "./Badges";

export function PrefectureGrid({ counts }: { counts: Record<number, number> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {REGIONS.map((r) => (
        <section key={r.key} aria-labelledby={`region-${r.key}`} className="rounded-xl border border-line bg-white p-4">
          <h3 id={`region-${r.key}`} className="text-sm font-bold text-primary">
            {r.name}
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {PREFECTURES.filter((p) => p.region === r.key).map((p) => {
              const n = counts[p.code] ?? 0;
              return (
                <li key={p.code}>
                  <Link
                    href={`/search?pref=${p.code}`}
                    className={`inline-flex min-h-10 items-center rounded-full border px-3 text-sm ${
                      n > 0
                        ? "border-lavender-200 bg-lavender-50 text-ink hover:bg-lavender-100"
                        : "border-line text-ink-muted hover:bg-mist"
                    }`}
                  >
                    {p.name}
                    {n > 0 && <span className="ml-1 text-xs text-ink-muted">（{n}）</span>}
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
      {METHODS.map((m) => (
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
