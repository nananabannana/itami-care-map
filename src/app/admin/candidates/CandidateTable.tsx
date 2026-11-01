"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CANDIDATE_STATUS, type CandidateStatusKey } from "@/lib/candidate-labels";
import { promoteCandidates, setCandidateStatus } from "./actions";

export interface CandidateRow {
  id: string;
  name: string;
  pref: string;
  city: string | null;
  address: string;
  status: CandidateStatusKey;
  evidenceCount: number;
  matchedFacility: string | null;
  hasPendingChanges: boolean;
  promoted: boolean;
  jala: boolean;
  websiteUrl: string | null;
}

export function CandidateTable({ rows }: { rows: CandidateRow[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<CandidateStatusKey>("awaiting_official");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setSel((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const ids = [...sel];

  async function run(fn: () => Promise<{ ok: boolean; message?: string; data?: unknown }>, done: (d: unknown) => string) {
    setBusy(true);
    setMsg(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message ?? "失敗しました" });
    setMsg({ ok: true, text: done(r.data) + (r.message ? ` ${r.message}` : "") });
    setSel(new Set());
    router.refresh();
  }

  return (
    <div>
      <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-lavender-200 bg-lavender-50 p-3 text-sm">
        <span className="font-semibold">選択中 {sel.size}件</span>
        <label className="sr-only" htmlFor="bulk-status">変更後の状態</label>
        <select id="bulk-status" value={status} onChange={(e) => setStatus(e.target.value as CandidateStatusKey)} className="min-h-10 rounded-lg border border-line bg-white px-2">
          {(Object.keys(CANDIDATE_STATUS) as CandidateStatusKey[]).map((k) => (
            <option key={k} value={k}>{CANDIDATE_STATUS[k].label}</option>
          ))}
        </select>
        <button type="button" disabled={!sel.size || busy} onClick={() => run(() => setCandidateStatus(ids, status), (n) => `${n}件の状態を変更しました。`)} className="min-h-10 rounded-lg border border-line bg-white px-3 font-semibold disabled:opacity-50">
          状態を変更
        </button>
        <button
          type="button"
          disabled={!sel.size || sel.size > 20 || busy}
          onClick={() => run(() => promoteCandidates(ids), (s) => `${(s as string[]).length}件を掲載施設の下書きへ送りました。「公開前レビュー」で承認すると公開されます。`)}
          className="min-h-10 rounded-lg bg-primary px-3 font-semibold text-white disabled:opacity-50"
        >
          下書きへ送る（最大20件）
        </button>
        {msg && <p role="status" className={`w-full ${msg.ok ? "text-ev-a" : "text-warn"}`}>{msg.text}</p>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-mist text-left">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="このページをすべて選択"
                  checked={rows.length > 0 && rows.every((r) => sel.has(r.id))}
                  onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                  className="h-5 w-5 accent-[var(--color-primary)]"
                />
              </th>
              <th className="px-3 py-2">名称</th>
              <th className="px-3 py-2">所在地</th>
              <th className="px-3 py-2">状態</th>
              <th className="px-3 py-2">根拠</th>
              <th className="px-3 py-2">備考</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="px-3 py-2">
                  <input type="checkbox" aria-label={`${r.name}を選択`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="h-5 w-5 accent-[var(--color-primary)]" />
                </td>
                <td className="px-3 py-2">
                  <Link href={`/admin/candidates/${r.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">{r.name}</Link>
                  {r.websiteUrl && (
                    <a href={r.websiteUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs text-ink-muted underline">公式サイト</a>
                  )}
                </td>
                <td className="px-3 py-2">{r.pref} {r.city}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-bold ${CANDIDATE_STATUS[r.status].className}`}>{CANDIDATE_STATUS[r.status].label}</span>
                </td>
                <td className="px-3 py-2">{r.evidenceCount ? `${r.evidenceCount}件` : <span className="text-ink-muted">なし</span>}</td>
                <td className="space-y-1 px-3 py-2 text-xs">
                  {r.matchedFacility && <p className="text-warn">既存の掲載施設「{r.matchedFacility}」と一致{r.hasPendingChanges && "・差分あり"}</p>}
                  {r.promoted && <p className="text-ev-a">下書きへ送付済み</p>}
                  {r.jala && <p>JALA掲載あり（無痛分娩のみ）</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
