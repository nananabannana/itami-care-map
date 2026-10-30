"use client";

import { useActionState, useId } from "react";
import { approveFacility, setFacilityDraft, type ActionState } from "../actions";

export function ReviewActions({ slug, isPublished }: { slug: string; isPublished: boolean }) {
  const id = useId();
  const [approveState, approve, approving] = useActionState<ActionState, FormData>(approveFacility, {});
  const [draftState, draft, drafting] = useActionState<ActionState, FormData>(setFacilityDraft, {});
  const state = draftState.message ? draftState : approveState;

  return (
    <div className="space-y-3 rounded-xl border border-lavender-200 bg-lavender-50 p-4">
      {!isPublished && (
        <form action={approve} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="checked" className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary)]" />
            <span>
              出典ページを開き、根拠の原文と登録内容（処置・麻酔方法・条件）が一致すること、推測で補った項目がないことを確認した
            </span>
          </label>
          <div>
            <label htmlFor={`${id}-note`} className="mb-1 block text-sm font-semibold">
              メモ（任意）
            </label>
            <textarea id={`${id}-note`} name="note" rows={2} className="block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={approving} className="min-h-11 rounded-lg bg-primary px-5 font-bold text-white hover:bg-primary-strong disabled:opacity-60">
            承認して公開する
          </button>
        </form>
      )}
      <form action={draft} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="slug" value={slug} />
        <div className="min-w-48 flex-1">
          <label htmlFor={`${id}-reason`} className="mb-1 block text-sm font-semibold">
            差し戻し・非公開の理由
          </label>
          <input id={`${id}-reason`} name="note" className="block min-h-11 w-full rounded-lg border border-line bg-white px-3 text-sm" />
        </div>
        <button type="submit" name="status" value="rejected" disabled={drafting} className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold hover:bg-mist">
          差し戻す
        </button>
        {isPublished && (
          <button type="submit" name="status" value="draft" disabled={drafting} className="min-h-11 rounded-lg border border-line bg-white px-4 text-sm font-semibold hover:bg-mist">
            非公開にして下書きへ
          </button>
        )}
      </form>
      {state.message && (
        <p role="status" className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-ev-a-bg text-ev-a" : "bg-warn-bg text-warn"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}
