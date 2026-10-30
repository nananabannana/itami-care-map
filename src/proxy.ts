import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRepository } from "@/lib/repository";

/**
 * 1. /admin：Supabase のログインセッションを更新する（Server Component からは Cookie を書けないため）
 * 2. /facilities/:id：存在しない医療機関IDに HTTP 404 を返す。
 *    Partial Prerendering では静的シェルが先に送られるため、ページ内の notFound() だけでは
 *    本文は404表示でもステータスが200になる。
 */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) return refreshAdminSession(request);

  const id = decodeURIComponent(request.nextUrl.pathname.split("/")[2] ?? "");
  const exists = (await getRepository().listIds()).includes(id);
  if (exists) return NextResponse.next();
  return NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
}

async function refreshAdminSession(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  await supabase.auth.getClaims();
  // 管理画面はキャッシュさせない
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/facilities/:id", "/admin/:path*"],
};
