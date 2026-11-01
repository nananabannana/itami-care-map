import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAdminSession, isSupabaseConfigured, type AdminSession } from "@/lib/supabase-server";
import { AdminNav } from "./AdminNav";

type Current = Parameters<typeof AdminNav>[0]["current"];

async function Gate({ children }: { children: (s: AdminSession) => React.ReactNode | Promise<React.ReactNode> }) {
  if (!isSupabaseConfigured()) {
    return <p className="rounded-lg bg-warn-bg p-4 text-warn">Supabase が設定されていないため、管理画面は使えません（デモデータで動作中）。</p>;
  }
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return <>{await children(session)}</>;
}

/** 管理画面の共通の枠（見出し・メニュー・管理者チェック） */
export function AdminPage({
  title,
  lead,
  current,
  children,
}: {
  title: string;
  lead?: string;
  current: Current;
  children: (s: AdminSession) => React.ReactNode | Promise<React.ReactNode>;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">{title}</h1>
      {lead && <p className="mb-4 text-sm text-ink-muted">{lead}</p>}
      <AdminNav current={current} />
      <Suspense fallback={<p className="text-ink-muted">読み込んでいます…</p>}>
        <Gate>{children}</Gate>
      </Suspense>
    </div>
  );
}
