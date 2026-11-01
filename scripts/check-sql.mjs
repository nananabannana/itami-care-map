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

// ---- 0004：データ拡充 ----
const ex = async (label, sql, shouldFail) => {
  try { const r = sql.trim().replace(/;$/, "").includes(";") ? (await db.exec(sql)).at(-1) : await db.query(sql); if (shouldFail) { console.log("NG  ", label, "（失敗するはずが成功）"); process.exitCode = 1; } else console.log("OK  ", label); return r.rows; }
  catch (e) { if (shouldFail) console.log("OK  ", label, "→ 拒否:", e.message.slice(0, 60)); else { console.log("FAIL", label, e.message); process.exitCode = 1; } }
};
// 既存の11施設は承認できる（麻酔の根拠がある）
for (const r of await q("select slug from facilities order by slug")) await ex(`承認可：${r.slug}`, `select approve_facility('${r.slug}')`);
await ex("候補を登録", `insert into listing_candidates (id, navii_key, name, facility_type, prefecture_code, address, data_source, data_date)
  values ('11111111-1111-1111-1111-111111111111', 'clinic:0000000001', 'テスト婦人科クリニック', 'clinic', 23, '愛知県名古屋市中区栄1-1-1', 'テスト', '2026-06-01')`);
await ex("未掲載可能の候補は昇格できない", "select promote_candidates(array['11111111-1111-1111-1111-111111111111'::uuid])", true);
await ex("掲載可能にする", "update listing_candidates set status='publishable'");
await ex("根拠なしの昇格は拒否", "select promote_candidates(array['11111111-1111-1111-1111-111111111111'::uuid])", true);
await ex("確度Aなのに公式URLなしは拒否", `insert into candidate_evidence (candidate_id, procedure_id, anesthesia_method_id, support_status, evidence_status, verification_method, evidence_excerpt, verified_at)
  values ('11111111-1111-1111-1111-111111111111', (select id from procedures where slug='iud'), (select id from anesthesia_methods where slug='local'), 'available', 'A', 'official_site', '原文', '2026-11-01')`, true);
await ex("確度Dで実施は拒否", `insert into candidate_evidence (candidate_id, procedure_id, anesthesia_method_id, support_status, evidence_status, verification_method, source_url, evidence_excerpt, verified_at)
  values ('11111111-1111-1111-1111-111111111111', (select id from procedures where slug='iud'), (select id from anesthesia_methods where slug='local'), 'available', 'D', 'official_site', 'https://example.com', '原文', '2026-11-01')`, true);
await ex("根拠を登録", `insert into candidate_evidence (candidate_id, procedure_id, anesthesia_method_id, support_status, evidence_status, verification_method, source_url, source_title, evidence_excerpt, verified_at)
  values ('11111111-1111-1111-1111-111111111111', (select id from procedures where slug='iud'), (select id from anesthesia_methods where slug='local'), 'available', 'A', 'official_site', 'https://example.com/iud', 'IUDについて', '「局所麻酔を使用します」', '2026-11-01')`);
const slugs = await ex("昇格", "select promote_candidates(array['11111111-1111-1111-1111-111111111111'::uuid]) as s");
console.log("     →", slugs?.[0]?.s, JSON.stringify(await q("select review_status, is_published, navii_key from facilities where navii_key='clinic:0000000001'")),
  "support:", (await q("select count(*)::int n from facility_procedure_support s join facilities f on f.id=s.facility_id where f.navii_key='clinic:0000000001'"))[0].n);
await ex("二重昇格は拒否", "select promote_candidates(array['11111111-1111-1111-1111-111111111111'::uuid])", true);
await ex("21件の昇格は拒否", `select promote_candidates((select array_agg(gen_random_uuid()) from generate_series(1,21)))`, true);
await ex("昇格した施設を承認", "select approve_facility('navii-clinic-0000000001')");
// 取り消し
await ex("麻酔の根拠がない施設", `insert into facilities (slug, name, prefecture_code, address, facility_type) values ('no-evidence', '根拠なし病院', 23, '愛知県', 'hospital')`);
await ex("麻酔の根拠がない施設は承認不可", "select approve_facility('no-evidence')", true);
await ex("取り込み記録", `insert into import_batches (id, source, label) values ('22222222-2222-2222-2222-222222222222', 'navii', 'テスト')`);
await ex("新規候補（取り込み）", `insert into listing_candidates (id, navii_key, name, facility_type, prefecture_code, address, data_source, first_batch_id, last_batch_id)
  values ('33333333-3333-3333-3333-333333333333', 'clinic:0000000002', '取消テスト', 'clinic', 13, '東京都港区1-1', 'テスト', '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222');
  insert into import_batch_changes (batch_id, table_name, record_id, action) values ('22222222-2222-2222-2222-222222222222', 'listing_candidates', '33333333-3333-3333-3333-333333333333', 'insert');
  insert into import_batch_changes (batch_id, table_name, record_id, action, before)
    select '22222222-2222-2222-2222-222222222222', 'listing_candidates', id, 'update', to_jsonb(c) from listing_candidates c where id = '11111111-1111-1111-1111-111111111111';
  update listing_candidates set address = '変更後の住所' where id = '11111111-1111-1111-1111-111111111111';`);
console.log("     revert →", JSON.stringify((await ex("取り込みの取り消し", "select revert_import_batch('22222222-2222-2222-2222-222222222222') as r"))?.[0]?.r),
  JSON.stringify(await q("select address from listing_candidates where id='11111111-1111-1111-1111-111111111111'")));
await ex("二重取り消しは拒否", "select revert_import_batch('22222222-2222-2222-2222-222222222222')", true);
// 非管理者
await db.exec(`update auth._claims set claims = '{}'`);
await ex("非管理者は昇格不可", "select promote_candidates(array['11111111-1111-1111-1111-111111111111'::uuid])", true);
