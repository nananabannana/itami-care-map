import Link from "next/link";

const ITEMS = [
  { href: "/admin/review", label: "公開前レビュー" },
  { href: "/admin/candidates", label: "掲載候補" },
  { href: "/admin/import/navii", label: "ナビイ取り込み" },
  { href: "/admin/import/jala", label: "JALA取り込み" },
  { href: "/admin/import", label: "取り込み履歴" },
] as const;

export function AdminNav({ current }: { current: (typeof ITEMS)[number]["href"] }) {
  return (
    <nav aria-label="管理メニュー" className="mb-6 border-b border-line">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {ITEMS.map((i) => (
          <li key={i.href} className="shrink-0">
            <Link
              href={i.href}
              aria-current={current === i.href ? "page" : undefined}
              className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm ${
                current === i.href ? "border-primary font-bold text-primary" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
