import type { Metadata } from "next";
import { LoginForm } from "../LoginForm";

export const metadata: Metadata = { title: "管理者ログイン", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">管理者ログイン</h1>
      <p className="mb-6 mt-2 text-sm text-ink-muted">掲載情報の公開前レビューを行う管理者専用のページです。</p>
      <LoginForm />
    </div>
  );
}
