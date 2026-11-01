import type { Metadata } from "next";
import { AdminPage } from "../../AdminPage";
import { NaviiImporter } from "./NaviiImporter";

export const metadata: Metadata = { title: "ナビイ取り込み", robots: { index: false, follow: false } };

export default function NaviiImportPage() {
  return (
    <AdminPage
      current="/admin/import/navii"
      title="医療情報ネット（ナビイ）の取り込み"
      lead="婦人科・産婦人科・産科のある病院・診療所の基本情報を、掲載候補として取り込みます。麻酔・鎮痛の情報は含まれないため、取り込んだだけでは公開されません。"
    >
      {() => (
        <>
          <NaviiImporter />
          <p className="mt-8 text-xs text-ink-muted">
            出典：厚生労働省「医療情報ネット（ナビイ）」オープンデータ（公共データ利用規約 第1.0版）。電話番号・郵便番号はオープンデータに含まれないため「未確認」になります。
          </p>
        </>
      )}
    </AdminPage>
  );
}
