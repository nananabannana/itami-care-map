import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const supabaseUrl = () => process.env.SUPABASE_URL;
export const supabaseKey = () => process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
export const isSupabaseConfigured = () => !!(supabaseUrl() && supabaseKey());

/**
 * ログイン中の利用者として Supabase にアクセスするクライアント（管理画面用）。
 * セッションは Cookie に保存される。トークンの更新は proxy.ts で行う。
 */
export async function createSessionClient() {
  const store = await cookies();
  return createServerClient(supabaseUrl()!, supabaseKey()!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Component からは Cookie を書けない。更新は proxy.ts が担う
        }
      },
    },
  });
}

export interface AdminSession {
  client: Awaited<ReturnType<typeof createSessionClient>>;
  userId: string;
  email?: string;
}

/** 管理者としてログインしていればセッションを返す。そうでなければ null */
export async function getAdminSession(): Promise<AdminSession | null> {
  if (!isSupabaseConfigured()) return null;
  const client = await createSessionClient();
  const { data } = await client.auth.getClaims();
  const claims = data?.claims as
    | { sub?: string; email?: string; app_metadata?: { role?: string } }
    | undefined;
  if (!claims?.sub || claims.app_metadata?.role !== "admin") return null;
  return { client, userId: claims.sub, email: claims.email };
}
