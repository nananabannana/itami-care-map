"use server";

import { updateTag } from "next/cache";
import { buildMatchIndex, commitJalaChunk, commitNaviiChunk, sanitizeJalaRecord, sanitizeNaviiRecord } from "@/lib/admin-import";
import { JALA_USER_AGENT, jalaListUrl, parseJalaListPage, type JalaRecord } from "@/lib/import/jala";
import type { IndexEntry } from "@/lib/import/match";
import { getAdminSession } from "@/lib/supabase-server";

const MAX_CHUNK = 300;

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("管理者としてログインしてください。");
  return session;
}

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
const wrap = async <T,>(fn: () => Promise<T>): Promise<Result<T>> => {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // 0004 のマイグレーションが未実行のとき
    if (/relation .* does not exist|Could not find the table/i.test(message)) {
      return { ok: false, message: "データベースの準備ができていません。supabase/migrations/0004_data_expansion.sql を実行してください。" };
    }
    return { ok: false, message };
  }
};

/** ドライラン用：重複判定の索引（DB には書き込まない） */
export async function getMatchIndex(prefCodes: number[]): Promise<Result<IndexEntry[]>> {
  return wrap(async () => {
    const session = await requireAdmin();
    const prefs = prefCodes.filter((p) => Number.isInteger(p) && p >= 1 && p <= 47);
    return buildMatchIndex(session.client, prefs);
  });
}

export async function createImportBatch(input: {
  source: "navii" | "jala";
  label: string;
  dataDate?: string;
  fileNames: string[];
  summary: Record<string, unknown>;
}): Promise<Result<string>> {
  return wrap(async () => {
    const session = await requireAdmin();
    const { data, error } = await session.client
      .from("import_batches")
      .insert({
        source: input.source,
        label: input.label.slice(0, 200),
        data_date: input.dataDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dataDate) ? input.dataDate : null,
        file_names: input.fileNames.slice(0, 10).map((f) => f.slice(0, 200)),
        summary: input.summary,
        created_by: session.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data.id as string;
  });
}

export async function commitNaviiRecords(batchId: string, records: unknown[]) {
  return wrap(async () => {
    const session = await requireAdmin();
    if (!Array.isArray(records) || records.length > MAX_CHUNK) throw new Error(`1回に送れるのは${MAX_CHUNK}件までです`);
    const clean = records.map(sanitizeNaviiRecord).filter((r) => r !== null);
    const res = await commitNaviiChunk(session.client, batchId, clean);
    return { ...res, rejected: records.length - clean.length };
  });
}

export async function revertImport(batchId: string) {
  return wrap(async () => {
    const session = await requireAdmin();
    const { data, error } = await session.client.rpc("revert_import_batch", { p_batch: batchId });
    if (error) throw new Error(error.message);
    updateTag("facilities");
    return data as { deleted: number; restored: number; kept: number };
  });
}

/**
 * JALA の一覧ページを1都道府県ぶん取得して読み取る（保存はしない）。
 * 呼び出し側（ブラウザ）が都道府県ごとに間隔をあけて順番に呼ぶ。
 */
export async function fetchJalaPrefecture(pref: number): Promise<Result<{ url: string; records: JalaRecord[] }>> {
  return wrap(async () => {
    await requireAdmin();
    if (!Number.isInteger(pref) || pref < 1 || pref > 47) throw new Error("都道府県が不正です");
    const url = jalaListUrl(pref);
    const res = await fetch(url, { headers: { "User-Agent": JALA_USER_AGENT, Accept: "text/html" }, cache: "no-store" });
    if (res.status === 404) return { url, records: [] };
    if (!res.ok) throw new Error(`JALA のページを取得できませんでした（HTTP ${res.status}）`);
    const html = await res.text();
    return { url, records: parseJalaListPage(html, pref) };
  });
}

export async function commitJalaRecords(batchId: string, records: unknown[], fetchedAt: string) {
  return wrap(async () => {
    const session = await requireAdmin();
    if (!Array.isArray(records) || records.length > MAX_CHUNK) throw new Error(`1回に送れるのは${MAX_CHUNK}件までです`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fetchedAt)) throw new Error("取得日が不正です");
    const clean = records.map(sanitizeJalaRecord).filter((r) => r !== null);
    const res = await commitJalaChunk(session.client, batchId, clean, fetchedAt);
    updateTag("facilities");
    return { ...res, rejected: records.length - clean.length };
  });
}

/** 既存の JALA 情報（ドライランで新規／更新を判定するため） */
export async function getJalaExisting(prefCodes: number[]) {
  return wrap(async () => {
    const session = await requireAdmin();
    const { data, error } = await session.client
      .from("jala_facilities")
      .select("jala_id, name, address, phone, website_url")
      .in("prefecture_code", prefCodes);
    if (error) throw new Error(error.message);
    return (data ?? []) as { jala_id: string; name: string; address: string; phone: string | null; website_url: string | null }[];
  });
}
