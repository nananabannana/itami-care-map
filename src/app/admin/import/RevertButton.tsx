"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { revertImport } from "./actions";

export function RevertButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="min-h-10 rounded-lg border border-line bg-white px-3 text-sm hover:bg-mist">
        取り消す
      </button>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      <p>この取り込みで追加した候補を削除し、更新した候補を元に戻します。作業済み（状態の変更・根拠の登録・昇格）の候補は残します。</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await revertImport(batchId);
            setBusy(false);
            if (!r.ok) return setMsg(r.message);
            setMsg(`取り消しました（削除 ${r.data.deleted}件、復元 ${r.data.restored}件、作業済みのため残した候補 ${r.data.kept}件）`);
            router.refresh();
          }}
          className="min-h-10 rounded-lg bg-primary px-3 font-semibold text-white disabled:opacity-50"
        >
          取り消しを実行
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="min-h-10 rounded-lg border border-line px-3">
          やめる
        </button>
      </div>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}
