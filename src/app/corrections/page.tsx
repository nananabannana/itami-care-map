import type { Metadata } from "next";

export const metadata: Metadata = { title: "医療機関情報の修正・掲載申請" };

export default function CorrectionsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">医療機関情報の修正・掲載申請</h1>
      <p className="mt-4 rounded-lg bg-warn-bg p-4 text-sm text-warn">
        受付フォームは準備中です（デモ版）。正式公開時に、このページから送信できるようになります。
      </p>

      <section aria-labelledby="c-what" className="mt-8">
        <h2 id="c-what" className="mb-3 text-xl font-bold">受け付ける内容</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>掲載内容の誤り・古い情報の修正</li>
          <li>掲載の停止・削除のご希望（医療機関の方）</li>
          <li>新しく掲載してほしい医療機関の情報（医療機関の方）</li>
        </ul>
      </section>

      <section aria-labelledby="c-flow" className="mt-8">
        <h2 id="c-flow" className="mb-3 text-xl font-bold">対応の流れ</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>いただいた内容を運営が確認します。投稿内容がそのまま公開されることはありません。</li>
          <li>医療機関の公式サイト、または医療機関への問い合わせで内容を確認します。</li>
          <li>確認できた内容を、出典と確認日をつけて反映します。</li>
        </ol>
      </section>

      <section aria-labelledby="c-note" className="mt-8 rounded-xl bg-blush-50 p-5">
        <h2 id="c-note" className="mb-3 text-lg font-bold">お願い</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>ご自身の病状、受診歴、氏名などの個人情報は書かないでください。</li>
          <li>特定の医療機関や医療従事者への誹謗中傷は掲載しません。</li>
          <li>体験談は掲載情報の根拠として使用しません。</li>
        </ul>
      </section>
    </div>
  );
}
