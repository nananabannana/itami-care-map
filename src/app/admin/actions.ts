"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createSessionClient, getAdminSession, isSupabaseConfigured } from "@/lib/supabase-server";

export interface ActionState {
  ok?: boolean;
  message?: string;
}

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return { message: "Supabase が設定されていません。" };
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { message: "メールアドレスとパスワードを入力してください。" };

  const client = await createSessionClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return { message: "ログインできませんでした。メールアドレスとパスワードを確認してください。" };

  const session = await getAdminSession();
  if (!session) {
    await client.auth.signOut();
    return { message: "このアカウントには管理者の権限がありません。" };
  }
  redirect("/admin/review");
}

export async function signOut() {
  const client = await createSessionClient();
  await client.auth.signOut();
  redirect("/admin/login");
}

function afterChange() {
  // 地図の件数・一覧のキャッシュをすぐ更新する
  updateTag("prefecture-counts");
  updateTag("facilities");
}

export async function approveFacility(_: ActionState, form: FormData): Promise<ActionState> {
  const session = await getAdminSession();
  if (!session) return { message: "管理者としてログインしてください。" };
  const slug = String(form.get("slug") ?? "");
  if (form.get("checked") !== "on") {
    return { message: "出典ページを開いて登録内容と一致することを確認し、チェックを入れてください。" };
  }
  const note = String(form.get("note") ?? "").trim() || null;
  const { error } = await session.client.rpc("approve_facility", { p_slug: slug, p_note: note });
  if (error) return { message: `承認できませんでした：${error.message}` };
  afterChange();
  return { ok: true, message: "承認して公開しました。" };
}

export async function setFacilityDraft(_: ActionState, form: FormData): Promise<ActionState> {
  const session = await getAdminSession();
  if (!session) return { message: "管理者としてログインしてください。" };
  const slug = String(form.get("slug") ?? "");
  const status = form.get("status") === "rejected" ? "rejected" : "draft";
  const note = String(form.get("note") ?? "").trim() || null;
  if (status === "rejected" && !note) return { message: "差し戻す理由をメモに書いてください。" };
  const { error } = await session.client.rpc("set_facility_draft", { p_slug: slug, p_status: status, p_note: note });
  if (error) return { message: `更新できませんでした：${error.message}` };
  afterChange();
  return { ok: true, message: status === "rejected" ? "差し戻しました（非公開）。" : "下書きに戻しました（非公開）。" };
}
