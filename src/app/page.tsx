import Link from "next/link";
import { EvidenceLegend, MethodGrid, PrefectureGrid, ProcedureGrid } from "@/components/EntryGrids";
import { JapanMap } from "@/components/JapanMap";
import { KeywordSearch } from "@/components/KeywordSearch";
import { getPrefectureCounts } from "@/lib/counts";

function SectionTitle({ id, children, lead }: { id: string; children: React.ReactNode; lead?: string }) {
  return (
    <div className="mb-5">
      <h2 id={id} className="text-xl font-bold sm:text-2xl">
        {children}
      </h2>
      {lead && <p className="mt-1 text-ink-muted">{lead}</p>}
    </div>
  );
}

const LIST_ID = "area-list";

export default async function Home() {
  const counts = await getPrefectureCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const prefsWithListings = Object.values(counts).filter((n) => n > 0).length;

  return (
    <>
      <section aria-labelledby="hero-title" className="border-b border-lavender-100">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 pb-8 pt-8 sm:pt-12 lg:grid-cols-[1fr_1fr] lg:items-end">
          <div>
            <h1 id="hero-title" className="text-[1.7rem] font-bold leading-snug tracking-wide sm:text-4xl">
              婦人科の痛み、
              <br />
              不安をひとりで抱えない。
            </h1>
            <p className="mt-3 text-base text-ink-muted sm:text-lg">
              麻酔・鎮痛への対応や、患者の意思を尊重する医療機関を全国から探せます。
            </p>
          </div>
          <KeywordSearch />
        </div>
      </section>

      <section aria-labelledby="map-title" className="mx-auto max-w-6xl px-4 pt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="map-title" className="text-xl font-bold sm:text-2xl">
              地図から探す
            </h2>
            <p className="mt-1 text-ink-muted">都道府県を選ぶと、その地域の医療機関一覧に移動します。</p>
          </div>
          <p className="text-sm text-ink-muted">
            掲載 <strong className="text-lg text-primary tabular-nums">{total}</strong> 件／
            <strong className="tabular-nums text-ink">{prefsWithListings}</strong> 都道府県
          </p>
        </div>
        <JapanMap counts={counts} listAnchorId={LIST_ID} />
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-4 pt-14">
        <section aria-labelledby={LIST_ID} className="scroll-mt-4">
          <SectionTitle id={LIST_ID} lead="地図と同じ検索結果に移動します。掲載が0件の都道府県も検索できます。">
            地域別に探す
          </SectionTitle>
          <PrefectureGrid counts={counts} />
        </section>

        <section aria-labelledby="procedure-title">
          <SectionTitle id="procedure-title" lead="受ける予定の処置から、麻酔・鎮痛に対応する医療機関を探せます。">
            処置から探す
          </SectionTitle>
          <ProcedureGrid />
        </section>

        <section aria-labelledby="method-title">
          <SectionTitle
            id="method-title"
            lead="「麻酔あり」と一括りにせず、処置ごとにどの方法を使うかで探せます。"
          >
            麻酔・鎮痛方法から探す
          </SectionTitle>
          <MethodGrid />
          <p className="mt-3 text-sm">
            <Link href="/guide" className="text-primary underline underline-offset-4">
              それぞれの方法について知る
            </Link>
          </p>
        </section>

        <section aria-labelledby="trust-title" className="rounded-2xl border border-lavender-100 bg-white p-5 sm:p-8">
          <SectionTitle id="trust-title">情報の信頼性について</SectionTitle>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-3 text-sm">
              <p>
                掲載情報は、医療機関の公式サイトや医療機関への直接の問い合わせで確認したものだけです。推測や口コミをもとに「対応している」と表示することはありません。確認できていない項目は「未確認」と表示します。
              </p>
              <p>
                検索結果の並び順は、情報の確認状況だけで決まります。広告料や掲載料で順位が変わることはありません。地図の色や件数も、掲載している医療機関の数を示すだけで、医療機関の評価ではありません。
              </p>
              <p>
                <Link href="/about" className="text-primary underline underline-offset-4">
                  掲載方針を詳しく見る
                </Link>
              </p>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">情報の確度の表示</h3>
              <EvidenceLegend />
            </div>
          </div>
          <p className="mt-6 text-xs text-ink-muted">
            地図：地球地図日本（国土地理院）をもとに jpn-atlas を加工して作成。一部の離島は表示を省略しています（検索対象には含まれます）。
          </p>
        </section>
      </div>
    </>
  );
}
