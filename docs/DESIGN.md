# いたみケア婦人科マップ 設計書（Phase 1）

最終更新：2026-10-30

## 0. 既存プロジェクトの確認結果

作業環境に既存のコードベースは見つからなかったため、要件書の推奨構成で新規構築した。

| 項目 | 採用 | 備考 |
| --- | --- | --- |
| フレームワーク | Next.js 16（App Router） | `cacheComponents` / `partialPrefetching` 有効。リクエスト依存処理は `<Suspense>` 内に置く |
| 言語 | TypeScript | |
| スタイル | Tailwind CSS v4 | デザイントークンは `src/app/globals.css` の `@theme` |
| DB | Supabase（PostgreSQL） | スキーマは `supabase/migrations/0001_init.sql`。MVPはデモデータで動作 |
| 地図（トップの全国地図） | 自前のSVG（47都道府県を個別に操作） | 地球地図日本（国土地理院）由来の jpn-atlas を `scripts/build-japan-map.mjs` で簡略化・加工 |
| 地図（医療機関の位置） | MapLibre（Phase 4） | Google Maps は従量課金・利用規約の確認が必要なため後回し |
| デプロイ | Vercel | |

---

## 1. ページ構成

| パス | 内容 | フェーズ |
| --- | --- | --- |
| `/` | トップ（キーワード検索、全国インタラクティブ地図、地域別・処置別・麻酔方法別、情報の信頼性） | MVP |
| `/search` | 医療機関一覧。クエリで絞り込み（`pref` `city` `procedure` `method` `q` `female_doctor` `consult_only` `stop_on_request` `evidence`） | MVP |
| `/area` | 47都道府県を6地域で一覧 | MVP |
| `/area/[pref]` | 都道府県 → `/search?pref=` へ集約（URLを一本化しSEO重複を避ける） | MVP |
| `/facilities/[id]` | 医療機関詳細（基本情報・処置別の麻酔対応・患者への配慮・出典） | MVP |
| `/guide` | 処置・麻酔方法について知る（中立的な一般説明。診断・推奨はしない） | MVP |
| `/about` | このサイトについて（情報の確度、掲載方針、広告と検索順位の分離、免責） | MVP |
| `/corrections` | 医療機関情報の修正・掲載申請（MVPでは受付方針の掲示、フォームはPhase 4） | MVP（告知のみ） |
| `/admin/*` | 管理画面（Supabase Auth＋役割で保護） | Phase 3 |

都道府県ページを `/search?pref=xx` に寄せる理由：一覧の表示ロジックを1か所にまとめ、「地域から」「処置から」の入口が違っても同じ並び順・同じ表示ルールになることを保証するため。

---

## 2. データベース設計

要件書のテーブル案をベースに、**「対応していないものを対応しているように見せない」ことをDB側の制約で担保する**方向で調整した。DDLは `supabase/migrations/0001_init.sql`。

### 2.1 要件書の案からの変更点と理由

| 変更 | 理由 |
| --- | --- |
| `facility_care_policies`（横長1行）→ **`facility_care_items`（1配慮項目＝1行）** | 案では1医療機関に `source_url` と `verified_at` が1つしかなく、「女性医師は公式サイトで確認」「中断対応は電話で確認」のように**項目ごとに出典・確認日が違う**ケースを表現できない。項目ごとに状態（あり／なし／条件付き／未確認）、確度、出典、確認日を持たせる |
| `facility_procedure_support.source_url` → **`source_id`（`sources` への外部キー）** | 同じ公式ページを複数の処置で参照するため、URLの重複を排除。出典の抜粋・確認者・確認日を一元管理 |
| `prefectures` / `municipalities` マスタを追加 | 都道府県・市区町村の表記ゆれ防止。市区町村は総務省の全国地方公共団体コードをキーにする |
| `support_status` を列挙型で定義 | `available`（実施）/ `consultation`（個別相談）/ `not_offered`（実施していないと明記）/ `unknown`（未確認） |
| `review_due_at`（再確認期限）、`is_published` を追加 | 更新期限の警告と公開制御のため |
| `is_demo` を `facilities` に追加 | デモデータが本番に混在しても画面上で必ず「デモデータ」と表示できるように |
| `correction_requests` に `requester_type` と管理メモ等を追加。**病状・氏名は保存しない** | 個人の医療情報を収集しない方針。フォームでも入力しないよう明示 |
| `audit_logs` を追加（Phase 3） | 誰がいつ何を変更したかの追跡。医療情報の掲載責任のため |

### 2.2 テーブル一覧

```
prefectures(code PK, name, region, sort_order)
municipalities(code PK, prefecture_code FK, name)

facilities(id PK, slug UQ, name, prefecture_code FK, municipality_code FK,
           address, phone, website_url, latitude, longitude,
           facility_type, departments[], nearest_stations[], consultation_hours,
           is_demo, is_published, created_at, updated_at)

procedures(id PK, slug UQ, name, category, description, sort_order)
anesthesia_methods(id PK, slug UQ, name, description, is_consultation_only, sort_order)

sources(id PK, facility_id FK, source_type, source_url, source_title,
        evidence_excerpt, contacted_department, checked_at, checked_by, notes)

facility_procedure_support(id PK, facility_id FK, procedure_id FK, anesthesia_method_id FK,
        support_status, conditions, schedule_note, extra_fee, extra_fee_note, notes,
        evidence_status, source_id FK, verified_at, last_checked_at, review_due_at,
        is_published)
  UNIQUE(facility_id, procedure_id, anesthesia_method_id)

facility_care_items(facility_id FK, care_item, status, note,
        evidence_status, source_id FK, verified_at, review_due_at)
  PK(facility_id, care_item)

correction_requests(id PK, facility_id FK NULL, request_type, requester_type,
        message, contact_email NULL, status, admin_note, created_at, resolved_at)

audit_logs(id PK, actor_id, table_name, record_id, action, diff, created_at)
```

リレーション：1医療機関 × N処置 × M麻酔方法を `facility_procedure_support` の1行＝「この施設で、この処置に、この方法を使うか」で表す。例えば「子宮頸管拡張に傍頸管ブロック（A：公式確認済み）」と「子宮頸管拡張に静脈麻酔（U：未確認）」は別行になるので、「麻酔あり」と一括りにならない。

### 2.3 確度ステータスとDB制約

| コード | 意味 | 出典 |
| --- | --- | --- |
| A | 公式サイトで個別の対応内容を確認済み | `sources.source_type = 'official_site'` 必須 |
| B | 医療機関へ直接確認済み | `source_type = 'direct_inquiry'` 必須（確認日・部署を記録、個人名は記録しない） |
| C | 公式サイトに麻酔・鎮痛の相談方針を確認済み | `official_site` 必須 |
| D | 一般的な診療情報のみ確認済み | 公的情報（ナビイ等）可 |
| U | 未確認 | 出典なし |

DBで強制するルール（CHECK制約・トリガー）：

- `support_status = 'available'`（実施）は確度 **A または B のときだけ** 登録できる
- `support_status = 'consultation'`（個別相談）は **A / B / C** のときだけ
- 確度が U 以外なら `source_id` と `verified_at` が必須。U なら `source_id` は空
- 確度 A/C の出典は公式サイト、B の出典は直接問い合わせであること（トリガーで検証）
- 公開側（anon）からは `is_published = true` の行だけ参照可能（RLS）。書き込みは管理者ロールのみ

これにより「麻酔科学会の認定病院だから」「無痛分娩をやっているから」といった推測でD以下の情報から `available` を作ることが、管理画面の操作ミスでもできない。

---

## 3. コンポーネント一覧

| 区分 | コンポーネント | 役割 |
| --- | --- | --- |
| レイアウト | `SiteHeader` / `SiteFooter` / `DemoBanner` | グローバルナビ、免責、デモデータ表示 |
| 検索 | `HeroSearch`（Client） | 都道府県→市区町村の連動セレクト、処置、麻酔方法 |
| | `FilterPanel` | 一覧の絞り込み。素のGETフォームでJSなしでも動作。モバイルでは折りたたみ |
| | `PrefectureGrid` / `ProcedureGrid` / `MethodGrid` | 入口リンク群 |
| 一覧 | `FacilityCard` | カード表示。並び順の理由（ティア）を明示 |
| | `ResultTierHeading` | 「公式情報で確認済み」「直接確認済み」「個別相談可」「未確認」の区切り |
| 詳細 | `SupportTable` | 処置×麻酔方法の対応表（条件・費用・出典・確認日） |
| | `CareItemList` | 患者への配慮（項目ごとに状態・確度・確認日） |
| | `SourceList` | 出典一覧（種別・確認日・抜粋） |
| 共通 | `EvidenceBadge` | A/B/C/D/U を色＋文字で表示（色だけに頼らない） |
| | `StatusLabel` | 実施／個別相談／実施なし／未確認 |
| | `StaleNotice` | 確認から12か月以上経過した情報に警告 |
| | `Disclaimer` | 診断・安全性を保証しない旨 |

---

## 4. MVP開発工程

| # | 内容 | 状態 |
| --- | --- | --- |
| 1 | プロジェクト雛形・デザイントークン・レイアウト | 完了 |
| 2 | マスタ（都道府県・処置・麻酔方法・配慮項目・確度） | 完了 |
| 3 | データアクセス層（`Repository` インターフェース＋デモ実装） | 完了 |
| 4 | 検索・並び順ロジック（純粋関数＋単体テスト） | 完了 |
| 5 | トップ / 地域一覧 / 検索結果 / 詳細 / 解説 / このサイトについて | 完了 |
| 6 | Supabase スキーマ（DDL・RLS・制約） | 完了（未接続） |
| 7 | Supabase 実装の `Repository` を追加し環境変数で切替 | Phase 3 |
| 8 | 管理画面・認証 | Phase 3 |

### 検索結果の並び順（広告・掲載料は一切関与しない）

希望条件（処置・麻酔方法）に合う行だけを見て、医療機関ごとに最上位のティアを決める。

1. 希望する処置の麻酔対応が **公式情報（A）で実施確認**
2. **直接確認（B）で実施確認**
3. 麻酔・鎮痛について **個別相談可**（`consultation`、または「個別相談できる」方法）
4. **未確認**（地域条件には合うが、希望処置の情報がない）— カード上で「この処置の麻酔対応は未確認」と明示

同じティア内は確認日が新しい順 → 名称順。「実施していない」と出典付きで確認できた方法は、その方法で絞り込んだときに結果から除外する。DBには掲載料・優先度などの列を持たせない。

---

## 5. 実装上の課題

1. **情報収集のコスト**：全国の婦人科・産婦人科は数千施設。処置×麻酔方法の粒度で公式情報を確認するのは手作業が中心になる。地域を絞って（例：愛知県から）段階的に公開する方が現実的。
2. **鮮度管理**：麻酔の実施体制は医師の異動で変わる。再確認期限（初期値：確認日＋6か月）を設け、期限切れは管理画面で警告、公開画面でも12か月超は警告表示。
3. **「未確認」の見せ方**：未確認施設を一覧に出すと探す手がかりになる一方、対応しているように誤読されるリスクがある。ティア見出しとカード内の文言で区別し、色だけに頼らない。
4. **医療広告ガイドライン**：本サービスが医療機関の「広告」と見なされないよう、医療機関から対価を受けない・誘引表現を使わない・体験談を載せない。リリース前に専門家確認が必要。
5. **中絶手術の情報**：検索・閲覧履歴自体がセンシティブ。アクセス解析は最小限にし、検索条件をサーバーログやURL共有で第三者に残しにくい配慮（後述のプライバシー対応）を検討する。
6. **プライバシー**：会員登録なし・投稿なしでも使えるようにする。修正依頼フォームで病状を書かないよう案内し、自由記述は公開しない。
7. **医療機関の掲載同意・削除依頼**：公開情報の整理でも掲載拒否の申し出に応じるフローを用意する（Phase 4）。
8. **Next.js 16 の Cache Components**：検索結果と詳細は `<Suspense>` 内で `connection()` を呼び、日付比較などをリクエスト時に行う。マスタ系ページは静的配信。

---

## 6. 情報収集・出典管理の方法

### 6.1 収集フロー

```
対象地域を決める
  → 公的情報（ナビイ）で婦人科・産婦人科の施設リストを作る［D：基本情報のみ］
  → 各施設の公式サイトを確認
      ├ 処置ごとの麻酔方法が書かれている → 該当行を A で登録（URL・該当箇所の抜粋・確認日）
      ├ 「痛みに配慮」「麻酔は相談」など方針のみ → C（consultation）で登録
      └ 記載なし → U のまま
  → 必要に応じて電話・問い合わせフォームで確認 → B で登録（確認日・部署、個人名なし）
  → ダブルチェック（登録者と別の担当者が出典と照合）→ 公開
  → 再確認期限が来たら同じ手順で更新
```

### 6.2 ルール

- **AIによる推測で掲載しない**。AIを使う場合は「公式サイトのどの文章が根拠か」の候補抽出までに留め、登録は人が原文を確認して行う。
- 出典には **URL・ページタイトル・根拠となる箇所の短い抜粋・確認日・確認者** を必ず残す（抜粋は引用の範囲に留める）。
- 麻酔科学会の認定病院であること、無痛分娩に対応していること、「麻酔あり」という記載だけを根拠に、個別処置の対応を `available` にしない（DB制約でも防止）。
- 口コミ・体験談は出典にしない。
- 公式サイトが更新されて記載が消えた場合は、確度を下げる（A→U）か非公開にする。
- 問い合わせ時は「掲載目的であること」を伝え、回答内容は要約して記録する。

### 6.3 参考にする公的情報

- 厚生労働省 医療情報ネット（ナビイ） https://www.iryou.teikyouseido.mhlw.go.jp/
- 日本麻酔科学会 認定病院検索 https://anesth.or.jp/users/common/search （施設の麻酔体制の参考。婦人科処置の対応根拠にはしない）

---

## 7. デモデータについて

`src/data/demo.ts` の医療機関はすべて架空。名称に「デモ」を含め、住所は「（デモ住所）」、電話番号は `000-` 始まり、URLは `example.com` を使用している。画面上部にも常時「デモデータ」と表示する。実在の医療機関の情報は一切含まない。

---

## 8. トップページの全国地図（2026-10-30 追加）

### 構成
ヘッダー → メインコピー → キーワード検索 → **全国インタラクティブ地図（主役）** → 地域別に探す（都道府県一覧） → 処置から探す → 麻酔・鎮痛方法から探す → 情報の信頼性について → フッター

### 地図の仕様
| 項目 | 実装 |
| --- | --- |
| データ | 地球地図日本（国土地理院）→ jpn-atlas → `scripts/build-japan-map.mjs` で `src/data/japan-map.ts` を生成。小笠原・南鳥島・奄美群島・先島諸島などは描画のみ省略（検索対象には含む）。沖縄本島周辺は左上の枠内に拡大配置 |
| 遷移先 | 地図・地域別一覧・都道府県ページすべて `prefHref()`（`/search?pref=N`）に統一。0件の都道府県も遷移・検索できる |
| 色分け | 「掲載件数」（淡いラベンダーの5段階）と「地域」（6地域）を切り替え。どちらのモードでも件数は数字のバッジで表示し、凡例に段階の数値を明記 |
| 選択中 | ホバー・フォーカス中の都道府県を濃いラベンダーで塗り、輪郭を強調。ツールチップに都道府県名と件数。PCは右側のカードにも表示 |
| キーボード | 地図全体で Tab 停止は1か所（ロービングtabindex）。矢印キーで隣の都道府県へ、Enter/Space で検索。地図をとばすスキップリンクあり |
| スマホ | 「地図で探す／地域別リストで探す」を切り替え。地域ボタンでその地方に拡大でき、小さな県もタップしやすい。件数バッジは拡大率に関係なく画面上で一定サイズ |
| PC | 地図の高さを画面の約72%に収め、右に選択中カード・色分け切替・凡例 |
| 件数の取得 | `getPrefectureCounts()`（`use cache` + `cacheLife("minutes")`）。Supabase 接続時はビュー `public_prefecture_counts` から取得。管理画面での更新時は `updateTag("prefecture-counts")` で即時反映（Phase 3） |

### Supabase との接続
- 環境変数 `SUPABASE_URL` / `SUPABASE_ANON_KEY` を設定すると `SupabaseRepository` に切り替わる（未設定時はデモデータ）
- マイグレーション `0002_prefecture_counts.sql`：都道府県別件数ビュー（0件の県も返す）、都道府県・処置・麻酔方法マスタの投入
- 実データベースへの接続確認は未実施（Supabase プロジェクト作成後に行う）
