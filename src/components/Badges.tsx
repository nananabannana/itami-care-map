import { CARE_STATUS, EVIDENCE, STALE_AFTER_DAYS, SUPPORT_STATUS } from "@/lib/master";
import type { CareStatus, EvidenceStatus, SupportStatus } from "@/lib/types";

export function EvidenceBadge({ status, long = false }: { status: EvidenceStatus; long?: boolean }) {
  const e = EVIDENCE[status];
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${e.className}`}
      title={e.label}
    >
      <span>{e.short}</span>
      {long ? <span className="ml-1 font-normal">：{e.label}</span> : <span className="sr-only">（{e.label}）</span>}
    </span>
  );
}

const SUPPORT_STYLE: Record<SupportStatus, string> = {
  available: "bg-ev-a-bg text-ev-a",
  consultation: "bg-ev-c-bg text-ev-c",
  not_offered: "bg-ev-d-bg text-ev-d",
  unknown: "bg-white text-ink-muted border border-dashed border-line",
};

export function SupportLabel({ status, methodSlug }: { status: SupportStatus; methodSlug?: string }) {
  if (methodSlug === "none" && status === "available") {
    return (
      <span className="inline-block whitespace-nowrap rounded border border-line bg-white px-2 py-0.5 text-xs font-semibold text-ink-muted">
        通常は麻酔なし
      </span>
    );
  }
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${SUPPORT_STYLE[status]}`}>
      {SUPPORT_STATUS[status]}
    </span>
  );
}

const CARE_STYLE: Record<CareStatus, string> = {
  yes: "text-ev-a",
  conditional: "text-ev-b",
  no: "text-ev-d",
  unknown: "text-ink-muted",
};
const CARE_MARK: Record<CareStatus, string> = { yes: "●", conditional: "◐", no: "×", unknown: "－" };

export function CareStatusLabel({ status }: { status: CareStatus }) {
  return (
    <span className={`whitespace-nowrap font-semibold ${CARE_STYLE[status]}`}>
      <span aria-hidden="true">{CARE_MARK[status]} </span>
      {CARE_STATUS[status]}
    </span>
  );
}

export function formatDate(d?: string) {
  if (!d) return "未確認";
  const [y, m, day] = d.split("-");
  return `${y}年${Number(m)}月${Number(day)}日`;
}

export function daysBetween(from: string, to: string) {
  return Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function isStale(verifiedAt: string | undefined, today: string) {
  return !!verifiedAt && daysBetween(verifiedAt, today) > STALE_AFTER_DAYS;
}

/** 確認日表示。12か月を超えたものは警告を添える */
export function VerifiedDate({ date, today }: { date?: string; today: string }) {
  const stale = isStale(date, today);
  return (
    <span className="whitespace-nowrap">
      <span>{formatDate(date)}</span>
      {stale && (
        <span className="ml-1 inline-block rounded bg-warn-bg px-1.5 text-xs font-semibold text-warn">
          1年以上前の情報
        </span>
      )}
    </span>
  );
}

const VERIFY_SUMMARY: Record<1 | 2 | 3 | 4, { label: string; className: string }> = {
  1: { label: "公式情報で確認済み", className: "bg-ev-a-bg text-ev-a border-ev-a" },
  2: { label: "医療機関に直接確認済み", className: "bg-ev-b-bg text-ev-b border-ev-b" },
  3: { label: "麻酔・鎮痛は個別相談", className: "bg-ev-c-bg text-ev-c border-ev-c" },
  4: { label: "麻酔・鎮痛の対応は未確認", className: "bg-white text-ink-muted border-line border-dashed" },
};

/** 検索カードの先頭に出す確認状況（希望条件に対する確認度） */
export function VerifySummary({ tier }: { tier: 1 | 2 | 3 | 4 }) {
  const v = VERIFY_SUMMARY[tier];
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${v.className}`}>
      {tier <= 2 && <span aria-hidden="true" className="mr-1">✓</span>}
      {v.label}
    </span>
  );
}
