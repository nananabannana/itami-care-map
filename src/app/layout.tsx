import type { Metadata, Viewport } from "next";
import { DemoBanner, SiteFooter, SiteHeader } from "@/components/SiteChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "いたみケア婦人科マップ｜麻酔・鎮痛に配慮する婦人科を探す",
    template: "%s｜いたみケア婦人科マップ",
  },
  description:
    "婦人科の処置ごとの麻酔・鎮痛への対応や、患者の意思を尊重する医療機関を全国から探せます。情報の出典と確認日を明記しています。",
  // デモ段階のため検索エンジンに登録しない
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <DemoBanner />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
