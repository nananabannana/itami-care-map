import { connection } from "next/server";

/**
 * 日本時間の今日（YYYY-MM-DD）。
 * リクエスト時に評価する必要があるため connection() を待つ。
 * 呼び出し側は <Suspense> の内側に置くこと。
 */
export async function todayJst(): Promise<string> {
  await connection();
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}
