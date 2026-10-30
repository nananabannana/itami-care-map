"use client";

import { useActionState } from "react";
import { signIn, type ActionState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(signIn, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-semibold">
          メールアドレス
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className="block min-h-12 w-full rounded-lg border border-line bg-white px-3" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold">
          パスワード
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="block min-h-12 w-full rounded-lg border border-line bg-white px-3" />
      </div>
      {state.message && (
        <p role="alert" className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="min-h-12 w-full rounded-lg bg-primary font-bold text-white hover:bg-primary-strong disabled:opacity-60">
        {pending ? "確認しています…" : "ログイン"}
      </button>
    </form>
  );
}
