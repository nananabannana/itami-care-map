-- 公開前レビューの仕組みと、第1次調査データの登録に必要な項目
-- 方針：調査で登録したデータは「下書き」。管理者が承認するまで公開されない

-- ---------------------------------------------------------------
-- 審査状態
-- ---------------------------------------------------------------
create type review_status as enum ('draft', 'approved', 'rejected');

alter table facilities
  add column city text,                                   -- 市区町村名（表示・絞り込み用）
  add column review_status review_status not null default 'draft',
  add column review_note text,
  add column approved_by uuid,
  add column approved_at timestamptz,
  add constraint published_requires_approval check (not is_published or review_status = 'approved');

-- 出典：住所確認用のページかどうか、資料に書かれた作成日・掲載日
alter table sources
  add column is_basic_info boolean not null default false,
  add column document_date text;                          -- 例：「2024年1月作成」「2026年7月28日掲載」「記載なし」

-- ---------------------------------------------------------------
-- 処置・麻酔方法の追加
-- ---------------------------------------------------------------
-- 子宮鏡「検査」と「手術」を区別する
insert into procedures (slug, name, category, description, sort_order) values
  ('hysteroscopic-surgery', '子宮鏡下手術', '手術',
   '子宮鏡を使って、子宮内膜ポリープや粘膜下筋腫などを切除する手術です。診断目的の子宮鏡検査とは麻酔の方法が異なることがあります。', 4)
on conflict (slug) do nothing;
update procedures set sort_order = case slug
  when 'cervical-dilation' then 1 when 'endometrial-biopsy' then 2 when 'hysteroscopy' then 3
  when 'hysteroscopic-surgery' then 4 when 'iud' then 5 when 'abortion' then 6 when 'fertility' then 7
  when 'intrauterine-surgery' then 8 when 'pelvic-exam' then 9 when 'labor' then 10 when 'other' then 11
  else sort_order end;

-- 「麻酔を使用しない」は、痛みへの対応としては数えない（検索の順位付けに使わない）
alter table anesthesia_methods add column is_none boolean not null default false;
insert into anesthesia_methods (slug, name, description, is_consultation_only, is_none, sort_order) values
  ('spinal', '脊髄くも膜下麻酔（腰椎麻酔）', '背中から細い針で麻酔薬を入れ、下半身の感覚をなくす方法です。「下半身麻酔」「腰椎麻酔」とも呼ばれます。', false, false, 7),
  ('none', '麻酔を使用しない', '通常は麻酔を使わずに行うことが確認できたものです。痛みへの対応がないという意味ではありません。', false, true, 20)
on conflict (slug) do nothing;
update anesthesia_methods set sort_order = case slug
  when 'local' then 1 when 'paracervical-block' then 2 when 'iv-anesthesia' then 3 when 'sedation' then 4
  when 'nitrous-oxide' then 5 when 'spinal' then 6 when 'general' then 7 when 'epidural' then 8
  when 'analgesics' then 9 when 'consultation' then 10 when 'none' then 20 else sort_order end;

-- ---------------------------------------------------------------
-- 追加調査候補（麻酔対応が未確認の施設。公開しない）
-- ---------------------------------------------------------------
create type research_status as enum ('pending', 'in_progress', 'registered', 'dropped');

create table research_candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prefecture_code smallint not null references prefectures(code),
  note text,
  status research_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, prefecture_code)
);
alter table research_candidates enable row level security;
create policy research_admin on research_candidates for all using (is_admin()) with check (is_admin());

-- 監査ログ：管理者のみ書き込み
create policy audit_admin_insert on audit_logs for insert with check (is_admin());

-- ---------------------------------------------------------------
-- 承認・差し戻し・非公開（管理者のみ。1回の操作で施設と対応情報をまとめて切り替える）
-- ---------------------------------------------------------------
create or replace function approve_facility(p_slug text, p_note text default null)
returns void language plpgsql security invoker as $$
declare fid uuid;
begin
  if not is_admin() then raise exception '管理者のみ実行できます'; end if;
  update facilities
     set review_status = 'approved', is_published = true, review_note = p_note,
         approved_by = auth.uid(), approved_at = now(), updated_at = now()
   where slug = p_slug
  returning id into fid;
  if fid is null then raise exception '医療機関が見つかりません: %', p_slug; end if;
  update facility_procedure_support set is_published = true, updated_at = now() where facility_id = fid;
  insert into audit_logs (actor_id, table_name, record_id, action, diff)
  values (auth.uid(), 'facilities', fid::text, 'approve', jsonb_build_object('slug', p_slug, 'note', p_note));
end $$;

create or replace function set_facility_draft(p_slug text, p_status review_status, p_note text default null)
returns void language plpgsql security invoker as $$
declare fid uuid;
begin
  if not is_admin() then raise exception '管理者のみ実行できます'; end if;
  if p_status = 'approved' then raise exception '承認は approve_facility を使ってください'; end if;
  update facilities
     set review_status = p_status, is_published = false, review_note = p_note, updated_at = now()
   where slug = p_slug
  returning id into fid;
  if fid is null then raise exception '医療機関が見つかりません: %', p_slug; end if;
  update facility_procedure_support set is_published = false, updated_at = now() where facility_id = fid;
  insert into audit_logs (actor_id, table_name, record_id, action, diff)
  values (auth.uid(), 'facilities', fid::text, 'set_' || p_status::text, jsonb_build_object('slug', p_slug, 'note', p_note));
end $$;

revoke all on function approve_facility(text, text) from public, anon;
revoke all on function set_facility_draft(text, review_status, text) from public, anon;
grant execute on function approve_facility(text, text) to authenticated;
grant execute on function set_facility_draft(text, review_status, text) to authenticated;
