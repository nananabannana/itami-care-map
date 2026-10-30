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

export function SupportLabel({ status }: { status: SupportStatus }) {
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
