import type { Metadata } from "next";
import Link from "next/link";
import { METHODS, PROCEDURES } from "@/lib/master";

export const metadata: Metadata = { title: "処置・麻酔について知る" };

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">処置・麻酔について知る</h1>
      <p className="mt-3 rounded-lg bg-lavender-50 p-4 text-sm">
        このページは、医療機関に相談するときの手がかりとして一般的な内容をまとめたものです。どの方法が合うかは、体の状態や処置の内容、医療機関の体制によって異なります。ご自身に合う方法は、医師に相談して決めてください。
      </p>

      <section aria-labelledby="g-proc" className="mt-10">
        <h2 id="g-proc" className="mb-4 text-xl font-bold">処置の種類</h2>
        <dl className="space-y-3">
          {PROCEDURES.map((p) => (
            <div key={p.slug} className="rounded-xl border border-line bg-white p-4">
              <dt className="font-semibold">{p.name}</dt>
              <dd className="mt-1 text-sm">{p.description}</dd>
              <dd className="mt-2 text-sm">
                <Link href={`/search?procedure=${p.slug}`} className="text-primary underline underline-offset-4">
                  この処置で医療機関を探す
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="g-meth" className="mt-12">
        <h2 id="g-meth" className="mb-4 text-xl font-bold">麻酔・鎮痛の方法</h2>
        <dl className="space-y-3">
          {METHODS.map((m) => (
            <div key={m.slug} className="rounded-xl border border-line bg-white p-4">
              <dt className="font-semibold">{m.name}</dt>
              <dd className="mt-1 text-sm">{m.description}</dd>
              <dd className="mt-2 text-sm">
                <Link href={`/search?method=${m.slug}`} className="text-primary underline underline-offset-4">
                  この方法で医療機関を探す
                </Link>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="g-ask" className="mt-12 rounded-xl bg-blush-50 p-5">
        <h2 id="g-ask" className="mb-3 text-lg font-bold">医療機関に相談するときのヒント</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>痛みが不安なことや、過去につらかった経験があることを、処置の前に伝えて大丈夫です。</li>
          <li>「この処置では、どんな麻酔や痛み止めが使えますか」と処置の名前を挙げて聞くと、答えが具体的になります。</li>
          <li>麻酔を使う場合の条件（予約の要否、付き添い、当日の運転、追加費用など）も確認しておくと安心です。</li>
          <li>処置中につらくなったときに中断できるか、合図の方法も事前に相談できます。</li>
        </ul>
      </section>
    </div>
  );
}
