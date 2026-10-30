# いたみケア婦人科マップ（仮称）

婦人科・産婦人科の処置ごとの麻酔・鎮痛対応、患者への配慮を探せる検索サービスのMVP。

> 現在はデモ版です。掲載している医療機関はすべて架空の「デモデータ」です。

## 開発

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # 検索・並び順・データ整合性のテスト
npm run build
```

## Supabase に接続する

`.env.example` を `.env.local` にコピーし、`SUPABASE_URL` と `SUPABASE_PUBLISHABLE_KEY`（`sb_publishable_` で始まる鍵）を設定します。Secret key は使いません。
`supabase/migrations/` の SQL を順に実行してください。未設定の場合はデモデータで動作します。

## 地図データの再生成

```bash
node scripts/build-japan-map.mjs   # src/data/japan-map.ts を生成
```

地図：地球地図日本（国土地理院）をもとに jpn-atlas（BSD-3-Clause）を加工して作成。

## 構成

- `docs/DESIGN.md` … 設計書（ページ構成、DB設計、コンポーネント、工程、課題、出典管理）
- `supabase/migrations/0001_init.sql` … Supabase スキーマ（CHECK制約・トリガー・RLS）
- `src/lib/repository.ts` … データアクセス層（MVPはデモ実装。Phase 3 で Supabase 実装を追加）
- `src/lib/search.ts` … 検索と並び順（確認状況のみで決定。広告・掲載料は関与しない）
- `src/lib/integrity.ts` … DB制約と同じルールのアプリ側検証
- `src/data/demo.ts` … デモデータ（架空）
