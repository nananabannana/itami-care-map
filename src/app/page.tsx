import Link from "next/link";
import { EvidenceLegend, MethodGrid, PrefectureGrid, ProcedureGrid } from "@/components/EntryGrids";
import { HeroSearch } from "@/components/HeroSearch";
import { getRepository } from "@/lib/repository";

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

export default async function Home() {
  const repo = getRepository();
  const [citiesByPref, counts] = await Promise.all([repo.listCities(), repo.countByPrefecture()]);

  return (
    <>
      <section aria-labelledby="hero-title" className="bg-gradient-to-b from-lavender-50 via-blush-50/60 to-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 pb-12 pt-10 sm:pt-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h1 id="hero-title" className="text-[1.75rem] font-bold leading-snug tracking-wide sm:text-4xl">
              婦人科の痛み、
              <br />
              不安をひとりで抱えない。
            </h1>
            <p className="mt-4 text-base text-ink-muted sm:text-lg">
              麻酔・鎮痛への対応や、患者の意思を尊重する医療機関を全国から探せます。
            </p>
            <ul className="mt-5 space-y-1 text-sm text-ink-muted">
              <li>・処置ごとに、どの麻酔・鎮痛方法に対応しているかを確認できます</li>
              <li>・すべての情報に出典と確認日を記載しています</li>
              <li>・会員登録は不要です</li>
            </ul>
          </div>
          <HeroSearch citiesByPref={citiesByPref} />
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-4 pt-12">
        <section aria-labelledby="area-title">
          <SectionTitle id="area-title" lead="都道府県を選ぶと、その地域の医療機関一覧に移動します。（）内は掲載数です。">
            地域から探す
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

        <section aria-labelledby="trust-title" className="rounded-2xl bg-mist p-5 sm:p-8">
          <SectionTitle id="trust-title">情報の確かさについて</SectionTitle>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-3 text-sm">
              <p>
                掲載情報は、医療機関の公式サイトや医療機関への直接の問い合わせで確認したものだけです。推測や口コミをもとに「対応している」と表示することはありません。確認できていない項目は「未確認」と表示します。
              </p>
              <p>
                検索結果の並び順は、情報の確認状況だけで決まります。広告料や掲載料で順位が変わることはありません。
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
        </section>
      </div>
    </>
  );
}
