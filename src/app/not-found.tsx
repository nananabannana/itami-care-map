import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">ページが見つかりません</h1>
      <p className="mt-3 text-ink-muted">お探しのページは削除されたか、URLが変更された可能性があります。</p>
      <Link href="/" className="mt-6 inline-block text-primary underline underline-offset-4">
        トップページへ戻る
      </Link>
    </div>
  );
}
