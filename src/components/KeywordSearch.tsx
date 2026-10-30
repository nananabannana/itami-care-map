import Link from "next/link";

export function KeywordSearch() {
  return (
    <form action="/search" method="get" role="search" aria-label="キーワードで探す" className="w-full">
      <label htmlFor="top-q" className="mb-2 block text-sm font-semibold">
        キーワードで探す
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="top-q"
          name="q"
          type="search"
          maxLength={50}
          placeholder="医療機関名・市区町村・駅名"
          className="min-h-13 w-full flex-1 rounded-xl border border-lavender-200 bg-white px-4 text-base shadow-sm placeholder:text-ink-muted"
        />
        <button
          type="submit"
          className="min-h-13 shrink-0 rounded-xl bg-primary px-8 font-bold text-white hover:bg-primary-strong"
        >
          検索
        </button>
      </div>
      <p className="mt-2 text-sm">
        <Link href="/search" className="text-primary underline underline-offset-4">
          処置・麻酔方法・配慮の条件を組み合わせて探す
        </Link>
      </p>
    </form>
  );
}
