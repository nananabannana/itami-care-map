import type { Metadata } from "next";
import { PrefectureGrid } from "@/components/EntryGrids";
import { getRepository } from "@/lib/repository";

export const metadata: Metadata = { title: "地域から探す" };

export default async function AreaPage() {
  const counts = await getRepository().countByPrefecture();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">地域から探す</h1>
      <p className="mb-6 mt-2 text-ink-muted">
        都道府県を選ぶと医療機関の一覧に移動します。一覧画面で市区町村・駅名・キーワードでも絞り込めます。（）内は掲載数です。
      </p>
      <PrefectureGrid counts={counts} />
    </div>
  );
}
