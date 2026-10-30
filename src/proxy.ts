import { NextResponse, type NextRequest } from "next/server";
import { getRepository } from "@/lib/repository";

/**
 * 存在しない医療機関IDに HTTP 404 を返す。
 * Partial Prerendering では静的シェルが先に送られるため、
 * ページ内の notFound() だけでは本文は404表示でもステータスが200になる。
 * Phase 3 で Supabase に切り替えたら、ここは軽量な存在確認クエリにする。
 */
export async function proxy(request: NextRequest) {
  const id = decodeURIComponent(request.nextUrl.pathname.split("/")[2] ?? "");
  const exists = (await getRepository().listIds()).includes(id);
  if (exists) return NextResponse.next();
  return NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
}

export const config = {
  matcher: "/facilities/:id",
};
