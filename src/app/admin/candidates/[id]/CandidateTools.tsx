"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CANDIDATE_STATUS, type CandidateStatusKey } from "@/lib/candidate-labels";
import { METHODS, PROCEDURES } from "@/lib/master";
import { addEvidence, applyFacilityChanges, deleteEvidence, promoteCandidates, setCandidateStatus, type EvidenceInput } from "../actions";

const input = "block min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm";

function useRun() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<{ ok: boolean; message?: string }>, okText: string) => {
    setBusy(true);
    setMsg(null);
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: okText + (r.message ? ` ${r.message}` : "") } : { ok: false, text: r.message ?? "失敗しました" });
    if (r.ok) router.refresh();
    return r.ok;
  };
  const Msg = () => (msg ? <p role="status" className={`text-sm ${msg.ok ? "text-ev-a" : "text-warn"}`}>{msg.text}</p> : null);
  return { run, busy, Msg };
}

export function StatusControl({ id, status, note, canPromote }: { id: string; status: CandidateStatusKey; note: string | null; canPromote: boolean }) {
  const { run, busy, Msg } = useRun();
  const [next, setNext] = useState<CandidateStatusKey>(status);
  const [memo, setMemo] = useState(note ?? "");
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
        <div>
          <label htmlFor="st" className="mb-1 block text-sm font-semibold">状態</label>
          <select id="st" value={next} onChange={(e) => setNext(e.target.value as CandidateStatusKey)} className={input}>
            {(Object.keys(CANDIDATE_STATUS) as CandidateStatusKey[]).map((k) => <option key={k} value={k}>{CANDIDATE_STATUS[k].label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="memo" className="mb-1 block text-sm font-semibold">メモ（掲載対象外の理由など）</label>
          <input id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} className={input} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => run(() => setCandidateStatus([id], next, memo), "状態を保存しました。")} className="min-h-11 rounded-lg border border-line bg-white px-4 font-semibold disabled:opacity-50">
          状態を保存
        </button>
        {canPromote && (
          <button type="button" disabled={busy} onClick={() => run(() => promoteCandidates([id]), "掲載施設の下書きへ送りました。「公開前レビュー」で承認すると公開されます。")} className="min-h-11 rounded-lg bg-primary px-4 font-bold text-white disabled:opacity-50">
            下書きへ送る
          </button>
        )}
      </div>
      <Msg />
    </div>
  );
}

export function ApplyChanges({ id, fields }: { id: string; fields: { key: string; label: string; current: string; incoming: string }[] }) {
  const { run, busy, Msg } = useRun();
  const [sel, setSel] = useState<Set<string>>(new Set());
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line rounded-xl border border-line text-sm">
        {fields.map((f) => (
          <li key={f.key} className="flex items-start gap-3 px-3 py-2">
            <input
              type="checkbox"
              aria-label={`${f.label}を反映する`}
              checked={sel.has(f.key)}
              onChange={() => setSel((s) => { const n = new Set(s); if (n.has(f.key)) n.delete(f.key); else n.add(f.key); return n; })}
              className="mt-1 h-5 w-5 accent-[var(--color-primary)]"
            />
            <div>
              <p className="font-semibold">{f.label}</p>
              <p className="text-ink-muted">現在：{f.current}</p>
              <p>取り込み：{f.incoming}</p>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" disabled={!sel.size || busy} onClick={() => run(() => applyFacilityChanges(id, [...sel]), "掲載施設に反映しました（変更前の値は監査ログに残っています）。")} className="min-h-11 rounded-lg border border-primary bg-white px-4 font-semibold text-primary disabled:opacity-50">
        選んだ項目を掲載施設に反映
      </button>
      <Msg />
    </div>
  );
}

export function DeleteEvidence({ id }: { id: string }) {
  const { run, busy } = useRun();
  return (
    <button type="button" disabled={busy} onClick={() => run(() => deleteEvidence(id), "削除しました。")} className="min-h-9 rounded-lg border border-line bg-white px-3 text-xs">
      削除
    </button>
  );
}

export function EvidenceForm({ id, today }: { id: string; today: string }) {
  const { run, busy, Msg } = useRun();
  const [v, setV] = useState<EvidenceInput>({
    procedure: PROCEDURES[0].slug,
    method: METHODS[0].slug,
    supportStatus: "available",
    evidenceStatus: "A",
    verificationMethod: "official_site",
    excerpt: "",
    verifiedAt: today,
  });
  const set = (p: Partial<EvidenceInput>) => setV((x) => ({ ...x, ...p }));
  const official = v.verificationMethod === "official_site";
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await run(() => addEvidence(id, v), "根拠を登録しました。");
        if (ok) set({ excerpt: "", conditions: "", sourceTitle: "", documentDate: "" });
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="ev-proc">処置名</label>
        <select id="ev-proc" value={v.procedure} onChange={(e) => set({ procedure: e.target.value })} className={input}>
          {PROCEDURES.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="ev-meth">麻酔・鎮痛方法</label>
        <select id="ev-meth" value={v.method} onChange={(e) => set({ method: e.target.value })} className={input}>
          {METHODS.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="ev-vm">確認方法</label>
        <select
          id="ev-vm"
          value={v.verificationMethod}
          onChange={(e) => {
            const vm = e.target.value as EvidenceInput["verificationMethod"];
            set({ verificationMethod: vm, evidenceStatus: vm === "official_site" ? "A" : "B" });
          }}
          className={input}
        >
          <option value="official_site">公式サイト</option>
          <option value="phone">電話</option>
          <option value="form">問い合わせフォーム</option>
          <option value="email">メール</option>
          <option value="visit">訪問</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="ev-ev">確度</label>
        <select id="ev-ev" value={v.evidenceStatus} onChange={(e) => set({ evidenceStatus: e.target.value as EvidenceInput["evidenceStatus"] })} className={input}>
          {official ? (
            <>
              <option value="A">A：処置ごとの対応内容を公式サイトで確認</option>
              <option value="C">C：麻酔・鎮痛の相談方針のみ公式サイトで確認</option>
            </>
          ) : (
            <option value="B">B：医療機関へ直接確認</option>
          )}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="ev-ss">対応状況</label>
        <select id="ev-ss" value={v.supportStatus} onChange={(e) => set({ supportStatus: e.target.value as EvidenceInput["supportStatus"] })} className={input}>
          <option value="available">実施</option>
          <option value="consultation">個別に相談可</option>
          <option value="not_offered">実施していない</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold" htmlFor="ev-date">確認日</label>
        <input id="ev-date" type="date" required value={v.verifiedAt} onChange={(e) => set({ verifiedAt: e.target.value })} className={input} />
      </div>
      {official ? (
        <>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold" htmlFor="ev-url">根拠となる公式ページのURL</label>
            <input id="ev-url" type="url" required value={v.sourceUrl ?? ""} onChange={(e) => set({ sourceUrl: e.target.value })} className={input} placeholder="https://" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor="ev-title">ページの題名</label>
            <input id="ev-title" value={v.sourceTitle ?? ""} onChange={(e) => set({ sourceTitle: e.target.value })} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold" htmlFor="ev-docdate">資料の作成日・更新日</label>
            <input id="ev-docdate" value={v.documentDate ?? ""} onChange={(e) => set({ documentDate: e.target.value })} className={input} placeholder="例：2025年4月更新／記載なし" />
          </div>
        </>
      ) : (
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-semibold" htmlFor="ev-dept">確認した部署（個人名は書かない）</label>
          <input id="ev-dept" required value={v.contactedDepartment ?? ""} onChange={(e) => set({ contactedDepartment: e.target.value })} className={input} placeholder="例：受付、婦人科外来" />
        </div>
      )}
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-semibold" htmlFor="ev-ex">根拠となる記述（{official ? "公式ページの該当箇所を原文のまま短く引用" : "回答の要旨"}）</label>
        <textarea id="ev-ex" required rows={3} value={v.excerpt} onChange={(e) => set({ excerpt: e.target.value })} className="block w-full rounded-lg border border-line px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-sm font-semibold" htmlFor="ev-cond">実施条件（任意）</label>
        <input id="ev-cond" value={v.conditions ?? ""} onChange={(e) => set({ conditions: e.target.value })} className={input} placeholder="例：日帰り手術、希望により" />
      </div>
      <div className="sm:col-span-2 space-y-2">
        <p className="text-xs text-ink-muted">推測で登録しないでください。無痛分娩の対応（JALA掲載など）を、ほかの婦人科処置の根拠にしないでください。</p>
        <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-primary px-5 font-bold text-white disabled:opacity-50">根拠を登録</button>
        <Msg />
      </div>
    </form>
  );
}
