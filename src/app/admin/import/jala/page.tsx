import type { Metadata } from "next";
import { todayJst } from "@/lib/today";
import { AdminPage } from "../../AdminPage";
import { JalaImporter } from "./JalaImporter";

export const metadata: Metadata = { title: "JALA取り込み", robots: { index: false, follow: false } };

export default function JalaImportPage() {
  return (
    <AdminPage
      current="/admin/import/jala"
      title="JALA（無痛分娩）情報の取り込み"
      lead="無痛分娩関係学会・団体連絡協議会（JALA）の全国無痛分娩施設検索に掲載されている施設を、無痛分娩の情報として管理します。"
    >
      {async () => (
        <>
          <JalaImporter today={await todayJst()} />
          <p className="mt-8 text-xs text-ink-muted">
            出典：JALA 全国無痛分娩施設検索（https://www.jalasite.org/area/）。取得するのは一覧ページの名称・郵便番号・住所・URL・電話番号のみで、施設ページへはリンクするだけです。
          </p>
        </>
      )}
    </AdminPage>
  );
}
