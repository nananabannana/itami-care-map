/**
 * Supabase に流す SQL をローカルの PGlite（WASM版PostgreSQL）で検証する。
 *   node scripts/check-sql.mjs
 * Supabase 固有の auth スキーマとロールは最小限のスタブで代用する。
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const db = new PGlite();
const stub = `
  create role anon; create role authenticated;
  create schema auth;
  create table auth._claims (claims jsonb);
  insert into auth._claims values ('{}');
  create function auth.jwt() returns jsonb language sql stable as $$ select claims from auth._claims limit 1 $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(claims->>'sub','')::uuid from auth._claims limit 1 $$;
`;
await db.exec(stub);
const run = async (label, sql) => {
  try {
    const res = await db.exec(sql);
    console.log("OK  ", label);
    return res;
  } catch (e) {
    console.log("FAIL", label, "\n     ", e.message);
    process.exitCode = 1;
  }
};
// pgcrypto は PGlite に無い（gen_random_uuid は PostgreSQL 13 以降は本体の関数なので外して検証）
const migration = (f) => readFileSync(`supabase/migrations/${f}`, "utf8").replace(/create extension if not exists "pgcrypto";/, "");
for (const f of readdirSync("supabase/migrations").sort()) await run(f, migration(f));
for (const f of readdirSync("supabase/seed").sort()) {
  const res = await run(f, readFileSync(`supabase/seed/${f}`, "utf8"));
  const last = res?.at(-1)?.rows;
  if (last) console.table(last);
}
// 2回目の実行で重複しないこと
for (const f of readdirSync("supabase/seed").sort()) await run(`${f}（2回目）`, readFileSync(`supabase/seed/${f}`, "utf8"));

if (process.exitCode) process.exit(1);
const q = async (sql) => (await db.query(sql)).rows;
console.log("facilities:", (await q("select count(*)::int n from facilities"))[0].n,
  "support:", (await q("select count(*)::int n from facility_procedure_support"))[0].n,
  "published:", (await q("select count(*)::int n from facilities where is_published"))[0].n,
  "candidates:", (await q("select count(*)::int n from research_candidates"))[0].n);

// 制約の確認：承認なしでは公開できない
try { await db.exec("update facilities set is_published = true where slug = 'hamada-hospital'"); console.log("NG 承認なしで公開できてしまった"); process.exitCode = 1; }
catch { console.log("OK   承認なしの公開はDBが拒否"); }
// 確度Dで「実施」は登録できない
try { await db.exec("update facility_procedure_support set evidence_status = 'D' where support_status = 'available' and source_id is not null"); console.log("NG 確度Dで実施"); process.exitCode = 1; }
catch { console.log("OK   確度Dの「実施」はDBが拒否"); }
// 管理者以外は承認できない
try { await db.exec("select approve_facility('hamada-hospital')"); console.log("NG 非管理者が承認できた"); process.exitCode = 1; }
catch { console.log("OK   非管理者の承認はDBが拒否"); }
// 管理者は承認でき、施設と対応情報が公開になり、監査ログが残る
await db.exec(`update auth._claims set claims = '{"sub":"00000000-0000-0000-0000-000000000001","app_metadata":{"role":"admin"}}'`);
await db.exec("select approve_facility('hamada-hospital', 'テスト承認')");
console.log("approve ->", JSON.stringify(await q("select f.review_status, f.is_published, bool_and(s.is_published) rows_published from facilities f join facility_procedure_support s on s.facility_id=f.id where f.slug='hamada-hospital' group by 1,2")),
  "audit:", (await q("select action from audit_logs"))[0]);
await db.exec("select set_facility_draft('hamada-hospital', 'draft', 'テスト戻し')");
console.log("draft   ->", await q("select review_status, is_published from facilities where slug='hamada-hospital'"));
console.log("counts view (published only):", (await q("select sum(facility_count)::int n from public_prefecture_counts"))[0].n);
console.log("iwate review_due:", await q("select review_due_at::text from facility_procedure_support s join facilities f on f.id=s.facility_id where f.slug='iwate-medical-university-hospital'"));
