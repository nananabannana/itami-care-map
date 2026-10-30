import Link from "next/link";

const NAV = [
  { href: "/search", label: "医療機関を探す" },
  { href: "/area", label: "地域から探す" },
  { href: "/guide", label: "処置・麻酔について知る" },
  { href: "/about", label: "このサイトについて" },
  { href: "/corrections", label: "情報の修正・掲載申請" },
] as const;

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold text-ink no-underline">
      <svg aria-hidden="true" width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="13" fill="var(--color-lavender-100)" />
        <path
          d="M14 21s-6-3.6-6-8.2A3.4 3.4 0 0 1 14 11a3.4 3.4 0 0 1 6 1.8C20 17.4 14 21 14 21Z"
          fill="var(--color-blush-700)"
          opacity=".85"
        />
      </svg>
      <span className="text-[15px] sm:text-base">いたみケア婦人科マップ</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-white">
      <a href="#main" className="skip-link">
        本文へスキップ
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <nav aria-label="メインメニュー" className="hidden lg:block">
          <ul className="flex gap-1 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="rounded-md px-3 py-2 text-ink hover:bg-lavender-50">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <details className="relative lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md border border-line px-3 text-sm [&::-webkit-details-marker]:hidden">
            メニュー
          </summary>
          <nav aria-label="メインメニュー" className="absolute right-0 z-40 mt-2 w-64 rounded-lg border border-line bg-white p-2 shadow-lg">
            <ul>
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="block rounded-md px-3 py-3 text-ink hover:bg-lavender-50">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function DemoBanner() {
  return (
    <div role="note" className="bg-warn-bg text-warn">
      <p className="mx-auto max-w-6xl px-4 py-2 text-sm">
        <strong>デモ版です。</strong>
        掲載している医療機関はすべて架空の「デモデータ」で、実在の医療機関ではありません。
      </p>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-mist">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 text-sm text-ink-muted">
        <p>
          本サイトは医療機関の情報を整理して提供する検索サービスです。診断や治療方針を決めるものではなく、医療機関の安全性を保証するものでもありません。受診や処置については、医療機関に直接ご相談ください。
        </p>
        <p>掲載順位は情報の確認状況だけで決まり、広告料・掲載料によって変わることはありません。</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="underline underline-offset-4 hover:text-ink">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
        <p>© いたみケア婦人科マップ（仮称）</p>
      </div>
    </footer>
  );
}
