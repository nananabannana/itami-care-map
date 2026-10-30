import type { Metadata } from "next";
import Link from "next/link";
import { EvidenceLegend } from "@/components/EntryGrids";

export const metadata: Metadata = { title: "このサイトについて" };

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-3 mt-10 text-xl font-bold">
      {children}
    </h2>
  );
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">このサイトについて</h1>
      <p className="mt-4">
        いたみケア婦人科マップ（仮称）は、婦人科・産婦人科の処置ごとの麻酔・鎮痛への対応や、患者の意思を尊重する診療方針を探せる検索サービスです。
      </p>

      <section aria-labelledby="a-source">
        <H2 id="a-source">掲載する情報と出典</H2>
        <ul className="list-disc space-y-2 pl-5">
          <li>医療機関の公式サイト、医療機関への直接の問い合わせ、公的な医療情報（厚生労働省 医療情報ネット など）で確認した情報だけを掲載します。</li>
          <li>推測やAIによる推定、口コミや体験談を根拠に「対応している」と表示することはありません。</li>
          <li>すべての情報に出典と確認日を記載します。確認から1年以上経った情報には注意書きを表示します。</li>
          <li>確認できていない項目は「未確認」と表示します。「未確認」は対応していないという意味ではありません。</li>
          <li>麻酔科の認定施設であることや、無痛分娩に対応していることだけを理由に、ほかの婦人科処置で麻酔に対応しているとは判断しません。</li>
        </ul>
      </section>

      <section aria-labelledby="a-ev">
        <H2 id="a-ev">情報の確度</H2>
        <EvidenceLegend />
      </section>

      <section aria-labelledby="a-rank">
        <H2 id="a-rank">検索結果の並び順と広告</H2>
        <p>検索結果は次の順で表示します。</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>希望する処置での麻酔・鎮痛の実施を、公式情報で確認できた医療機関</li>
          <li>医療機関への直接確認で確認できた医療機関</li>
          <li>麻酔・鎮痛について個別に相談できることを確認できた医療機関</li>
          <li>情報が未確認の医療機関</li>
        </ol>
        <p className="mt-3">
          医療機関から広告料・掲載料を受け取って順位を変えることはありません。将来広告を掲載する場合も、検索結果・掲載内容とは明確に区別します。
        </p>
      </section>

      <section aria-labelledby="a-privacy">
        <H2 id="a-privacy">プライバシー</H2>
        <ul className="list-disc space-y-2 pl-5">
          <li>会員登録なしで利用できます。</li>
          <li>病状や受診歴などの個人の医療情報は収集しません。修正依頼のフォームにも書かないようお願いしています。</li>
        </ul>
      </section>

      <section aria-labelledby="a-disclaimer">
        <H2 id="a-disclaimer">ご利用にあたって</H2>
        <p>
          本サイトは診断や治療方針を決めるものではなく、医療機関の安全性や処置の結果を保証するものでもありません。受診や処置、麻酔の方法については、医療機関に直接ご相談ください。
        </p>
        <p className="mt-3">
          掲載内容の誤り、掲載の停止をご希望の場合は
          <Link href="/corrections" className="text-primary underline underline-offset-4">
            修正・掲載申請の窓口
          </Link>
          からご連絡ください。
        </p>
      </section>
    </div>
  );
}
