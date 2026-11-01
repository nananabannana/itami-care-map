-- 医療機関データの拡充：ナビイ（医療情報ネット）オープンデータの取り込みと JALA 情報の管理
--
-- 方針
--   - 取り込んだデータは「掲載候補（listing_candidates）」に入れ、facilities（掲載用）には直接入れない
--   - 掲載は、公式情報で麻酔・鎮痛の記載を確認できた候補だけ（承認時にDBで確認する）
--   - 既存の facilities は取り込みで上書きしない。差分は候補側に「更新候補」として持つ
--   - JALA の情報は別テーブルで管理し、婦人科処置の麻酔対応には使わない
--   - 取り込みは「取り込み記録（import_batches）」単位で、変更前の内容を残して取り消せる

-- ---------------------------------------------------------------
-- 既存テーブルへの追加
-- ---------------------------------------------------------------
alter table facilities
  add column postal_code text,
  add column navii_key text unique,        -- 'hospital:ID' / 'clinic:ID'（ナビイの ID）
  add column data_source text,             -- 基本情報の取得元
  add column data_date date;               -- 基本情報の基準日

-- 確認方法（公式サイト閲覧／電話／問い合わせフォーム／メール／訪問）
create type verification_method as enum ('official_site', 'phone', 'form', 'email', 'visit');
alter table facility_procedure_support add column verification_method verification_method;
alter table facility_care_items add column verification_method verification_method;
update facility_procedure_support s set verification_method = case src.source_type
    when 'official_site' then 'official_site'::verification_method
    when 'direct_inquiry' then 'phone'::verification_method
    else null end
  from sources src where src.id = s.source_id and s.verification_method is null;

-- ---------------------------------------------------------------
-- 取り込み記録
-- ---------------------------------------------------------------
create type import_source as enum ('navii', 'jala');

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  source import_source not null,
  label text not null,
  data_date date,                            -- データ基準日（ナビイは公表時点、JALAは取得日）
  file_names text[] not null default '{}',
  summary jsonb not null default '{}',       -- ドライランの集計（新規・更新候補など）
  created_by uuid,
  created_at timestamptz not null default now(),
  reverted_at timestamptz
);

-- 変更前の内容（取り消し用）
create table import_batch_changes (
  id bigserial primary key,
  batch_id uuid not null references import_batches(id) on delete cascade,
  table_name text not null,                  -- 'listing_candidates' / 'jala_facilities'
  record_id uuid not null,
  action text not null check (action in ('insert', 'update')),
  before jsonb,
  created_at timestamptz not null default now()
);
create index import_batch_changes_batch_idx on import_batch_changes (batch_id);

-- ---------------------------------------------------------------
-- 掲載候補
-- ---------------------------------------------------------------
create type candidate_status as enum (
  'unverified',          -- 未確認
  'awaiting_official',   -- 公式サイト確認待ち
  'official_verified',   -- 公式情報確認済み
  'direct_verified',     -- 直接問い合わせ確認済み
  'publishable',         -- 掲載可能
  'excluded'             -- 掲載対象外
);

create table listing_candidates (
  id uuid primary key default gen_random_uuid(),
  navii_key text unique,                     -- 'hospital:ID' / 'clinic:ID'
  name text not null,
  name_kana text,
  facility_type facility_type not null,
  prefecture_code smallint not null references prefectures(code),
  municipality_code text,                    -- 都道府県コード2桁＋市区町村コード3桁
  city text,
  address text not null,
  postal_code text,                          -- ナビイには無い。JALA 等で判明した場合のみ
  phone text,                                -- 同上
  website_url text,
  latitude double precision,
  longitude double precision,
  departments text[] not null default '{}',
  consultation_hours text,
  data_source text not null,                 -- 例：「医療情報ネット オープンデータ（診療所・施設票）」
  data_date date,                            -- データ基準日
  status candidate_status not null default 'unverified',
  status_note text,
  -- 既存の掲載施設と一致した場合（新規登録せず更新候補として扱う）
  matched_facility_id uuid references facilities(id) on delete set null,
  match_kind text check (match_kind in ('navii_id', 'address_name', 'location_name', 'name_only')),
  pending_changes jsonb,                     -- { 項目: { current, incoming } }
  promoted_facility_id uuid references facilities(id) on delete set null,
  first_batch_id uuid references import_batches(id) on delete set null,
  last_batch_id uuid references import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listing_candidates_status_idx on listing_candidates (status, prefecture_code);
create index listing_candidates_pref_idx on listing_candidates (prefecture_code, city);

-- 候補ごとの処置別の根拠（公式サイトや問い合わせで確認した内容）
create table candidate_evidence (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references listing_candidates(id) on delete cascade,
  procedure_id smallint not null references procedures(id),
  anesthesia_method_id smallint not null references anesthesia_methods(id),
  support_status support_status not null,
  conditions text,
  evidence_status evidence_status not null,
  verification_method verification_method not null,
  source_url text,
  source_title text,
  evidence_excerpt text not null,            -- 根拠となる記述（原文の引用、または問い合わせの回答要旨）
  contacted_department text,                 -- 直接確認した部署（個人名は記録しない）
  document_date text,                        -- 資料の作成日・更新日（「記載なし」も可）
  verified_at date not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (candidate_id, procedure_id, anesthesia_method_id),
  constraint ev_available_requires_ab check (support_status <> 'available' or evidence_status in ('A', 'B')),
  constraint ev_consultation_requires_abc check (support_status <> 'consultation' or evidence_status in ('A', 'B', 'C')),
  constraint ev_no_unknown check (support_status <> 'unknown' and evidence_status not in ('D', 'U')),
  constraint ev_official_has_url check (
    evidence_status not in ('A', 'C') or (verification_method = 'official_site' and source_url is not null)
  ),
  constraint ev_direct_has_department check (
    evidence_status <> 'B' or (verification_method in ('phone', 'form', 'email', 'visit') and contacted_department is not null)
  )
);

-- ---------------------------------------------------------------
-- JALA（無痛分娩関係学会・団体連絡協議会）の施設情報
-- 無痛分娩の情報公開に取り組む施設の一覧。婦人科処置の麻酔対応には使わない。
-- ---------------------------------------------------------------
create table jala_facilities (
  id uuid primary key default gen_random_uuid(),
  jala_id text not null unique,              -- jalasite.org/hp/{jala_id}.html
  name text not null,
  prefecture_code smallint not null references prefectures(code),
  postal_code text,
  address text not null,
  phone text,
  website_url text,                          -- 施設が JALA に登録した URL
  jala_url text not null,
  labor_analgesia_note text not null default 'JALAの全国無痛分娩施設検索に掲載（無痛分娩の診療体制を情報公開している施設）',
  fetched_at date not null,
  matched_facility_id uuid references facilities(id) on delete set null,
  matched_candidate_id uuid references listing_candidates(id) on delete set null,
  match_kind text,
  first_batch_id uuid references import_batches(id) on delete set null,
  last_batch_id uuid references import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jala_facilities_pref_idx on jala_facilities (prefecture_code);

-- ---------------------------------------------------------------
-- 権限
-- ---------------------------------------------------------------
alter table import_batches enable row level security;
alter table import_batch_changes enable row level security;
alter table listing_candidates enable row level security;
alter table candidate_evidence enable row level security;
alter table jala_facilities enable row level security;

create policy batches_admin on import_batches for all using (is_admin()) with check (is_admin());
create policy batch_changes_admin on import_batch_changes for all using (is_admin()) with check (is_admin());
create policy candidates_admin on listing_candidates for all using (is_admin()) with check (is_admin());
create policy evidence_admin on candidate_evidence for all using (is_admin()) with check (is_admin());
create policy jala_admin on jala_facilities for all using (is_admin()) with check (is_admin());
-- 公開中の施設にひも付いた JALA 情報だけは誰でも読める（詳細ページの「分娩」欄に表示）
create policy jala_public on jala_facilities for select using (
  exists (select 1 from facilities f where f.id = matched_facility_id and f.is_published)
);

-- ---------------------------------------------------------------
-- 承認時のルールを追加：麻酔・鎮痛の記載を確認した対応情報が1件もない施設は公開できない
-- ---------------------------------------------------------------
create or replace function approve_facility(p_slug text, p_note text default null)
returns void language plpgsql security invoker as $$
declare fid uuid;
begin
  if not is_admin() then raise exception '管理者のみ実行できます'; end if;
  select id into fid from facilities where slug = p_slug;
  if fid is null then raise exception '医療機関が見つかりません: %', p_slug; end if;
  if not exists (
    select 1 from facility_procedure_support s
      join anesthesia_methods m on m.id = s.anesthesia_method_id
     where s.facility_id = fid
       and s.evidence_status in ('A', 'B', 'C')
       and s.support_status in ('available', 'consultation')
       and not m.is_none
  ) then
    raise exception '麻酔・鎮痛の対応を公式情報または直接確認で確認した情報がないため、公開できません';
  end if;
  update facilities
     set review_status = 'approved', is_published = true, review_note = p_note,
         approved_by = auth.uid(), approved_at = now(), updated_at = now()
   where id = fid;
  update facility_procedure_support set is_published = true, updated_at = now() where facility_id = fid;
  insert into audit_logs (actor_id, table_name, record_id, action, diff)
  values (auth.uid(), 'facilities', fid::text, 'approve', jsonb_build_object('slug', p_slug, 'note', p_note));
end $$;

-- ---------------------------------------------------------------
-- 掲載候補 → 掲載施設（下書き）への昇格。1回最大20件
-- 昇格後は既存の公開前レビュー（approve_facility）を通して公開する
-- ---------------------------------------------------------------
create or replace function promote_candidates(p_ids uuid[])
returns text[] language plpgsql security invoker as $$
declare
  c listing_candidates%rowtype;
  fid uuid;
  sid uuid;
  basic_sid uuid;
  e record;
  new_slug text;
  slugs text[] := '{}';
begin
  if not is_admin() then raise exception '管理者のみ実行できます'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then raise exception '候補が選ばれていません'; end if;
  if array_length(p_ids, 1) > 20 then raise exception '一度に下書きへ送れるのは20件までです'; end if;

  for c in select * from listing_candidates where id = any(p_ids) for update loop
    if c.status <> 'publishable' then
      raise exception '「掲載可能」になっていない候補が含まれています: %', c.name;
    end if;
    if c.matched_facility_id is not null then
      raise exception '既存の掲載施設と一致する候補は昇格できません（更新候補として扱ってください）: %', c.name;
    end if;
    if c.promoted_facility_id is not null then
      raise exception 'すでに下書きへ送った候補です: %', c.name;
    end if;
    if not exists (
      select 1 from candidate_evidence ev join anesthesia_methods m on m.id = ev.anesthesia_method_id
       where ev.candidate_id = c.id and ev.support_status in ('available', 'consultation') and not m.is_none
    ) then
      raise exception '麻酔・鎮痛の根拠が登録されていない候補が含まれています: %', c.name;
    end if;

    new_slug := coalesce('navii-' || replace(c.navii_key, ':', '-'), 'cand-' || left(c.id::text, 8));
    insert into facilities (slug, name, prefecture_code, city, address, postal_code, phone, website_url,
                            latitude, longitude, facility_type, departments, consultation_hours,
                            navii_key, data_source, data_date, is_demo, is_published, review_status, review_note)
    values (new_slug, c.name, c.prefecture_code, c.city, c.address, c.postal_code, c.phone, c.website_url,
            c.latitude, c.longitude, c.facility_type, c.departments, c.consultation_hours,
            c.navii_key, c.data_source, c.data_date, false, false, 'draft', '掲載候補から昇格')
    returning id into fid;

    -- 基本情報の出典（公的情報・確度D相当）
    insert into sources (facility_id, source_type, source_url, source_title, document_date, checked_at, is_basic_info, notes)
    values (fid, 'public_registry', 'https://www.iryou.teikyouseido.mhlw.go.jp/', c.data_source,
            coalesce(to_char(c.data_date, 'YYYY年FMMM月FMDD日時点'), '記載なし'), coalesce(c.data_date, current_date), true,
            '医療情報ネット（ナビイ）オープンデータ。公共データ利用規約（PDL1.0）')
    returning id into basic_sid;

    -- 処置別の根拠を出典・対応情報として登録
    for e in select * from candidate_evidence where candidate_id = c.id loop
      insert into sources (facility_id, source_type, source_url, source_title, evidence_excerpt, contacted_department,
                           document_date, checked_at)
      values (fid,
              case when e.verification_method = 'official_site' then 'official_site'::source_type else 'direct_inquiry'::source_type end,
              e.source_url, coalesce(e.source_title, '確認記録'), e.evidence_excerpt, e.contacted_department,
              e.document_date, e.verified_at)
      returning id into sid;
      insert into facility_procedure_support (facility_id, procedure_id, anesthesia_method_id, support_status, conditions,
                                              extra_fee, evidence_status, source_id, verified_at, last_checked_at,
                                              verification_method, is_published)
      values (fid, e.procedure_id, e.anesthesia_method_id, e.support_status, e.conditions,
              'unknown', e.evidence_status, sid, e.verified_at, e.verified_at, e.verification_method, false);
    end loop;

    update listing_candidates set promoted_facility_id = fid, updated_at = now() where id = c.id;
    update jala_facilities set matched_facility_id = fid, updated_at = now() where matched_candidate_id = c.id;
    insert into audit_logs (actor_id, table_name, record_id, action, diff)
    values (auth.uid(), 'listing_candidates', c.id::text, 'promote', jsonb_build_object('slug', new_slug));
    slugs := slugs || new_slug;
  end loop;

  if coalesce(array_length(slugs, 1), 0) <> array_length(p_ids, 1) then
    raise exception '見つからない候補が含まれています';
  end if;
  return slugs;
end $$;

revoke all on function promote_candidates(uuid[]) from public, anon;
grant execute on function promote_candidates(uuid[]) to authenticated;

-- ---------------------------------------------------------------
-- 取り込みの取り消し
--   - 取り込みで新規作成した候補：まだ手を付けていない（未確認・根拠なし・未昇格）ものだけ削除
--   - 取り込みで更新した候補：変更前の基本情報に戻す（状態・メモ・根拠は変更しない）
--   - JALA：新規は削除、更新は変更前に戻す
-- 戻り値：{ deleted, restored, kept }（kept＝作業済みのため残した件数）
-- ---------------------------------------------------------------
create or replace function revert_import_batch(p_batch uuid)
returns jsonb language plpgsql security invoker as $$
declare
  ch record;
  n_deleted int := 0; n_restored int := 0; n_kept int := 0;
  r listing_candidates%rowtype;
  j jala_facilities%rowtype;
begin
  if not is_admin() then raise exception '管理者のみ実行できます'; end if;
  if exists (select 1 from import_batches where id = p_batch and reverted_at is not null) then
    raise exception 'この取り込みはすでに取り消し済みです';
  end if;

  for ch in select * from import_batch_changes where batch_id = p_batch order by id desc loop
    if ch.table_name = 'listing_candidates' then
      if ch.action = 'insert' then
        delete from listing_candidates c
         where c.id = ch.record_id and c.status = 'unverified' and c.promoted_facility_id is null
           and not exists (select 1 from candidate_evidence e where e.candidate_id = c.id);
        if found then n_deleted := n_deleted + 1; else n_kept := n_kept + 1; end if;
      else
        r := jsonb_populate_record(null::listing_candidates, ch.before);
        update listing_candidates set
          name = r.name, name_kana = r.name_kana, facility_type = r.facility_type, prefecture_code = r.prefecture_code,
          municipality_code = r.municipality_code, city = r.city, address = r.address, website_url = r.website_url,
          postal_code = r.postal_code, phone = r.phone,
          latitude = r.latitude, longitude = r.longitude, departments = r.departments,
          consultation_hours = r.consultation_hours, data_source = r.data_source, data_date = r.data_date,
          matched_facility_id = r.matched_facility_id, match_kind = r.match_kind, pending_changes = r.pending_changes,
          last_batch_id = r.last_batch_id, updated_at = now()
         where id = ch.record_id;
        if found then n_restored := n_restored + 1; end if;
      end if;
    elsif ch.table_name = 'jala_facilities' then
      if ch.action = 'insert' then
        delete from jala_facilities where id = ch.record_id;
        if found then n_deleted := n_deleted + 1; end if;
      else
        j := jsonb_populate_record(null::jala_facilities, ch.before);
        update jala_facilities set
          name = j.name, prefecture_code = j.prefecture_code, postal_code = j.postal_code, address = j.address,
          phone = j.phone, website_url = j.website_url, jala_url = j.jala_url, fetched_at = j.fetched_at,
          matched_facility_id = j.matched_facility_id, matched_candidate_id = j.matched_candidate_id,
          match_kind = j.match_kind, last_batch_id = j.last_batch_id, updated_at = now()
         where id = ch.record_id;
        if found then n_restored := n_restored + 1; end if;
      end if;
    end if;
  end loop;

  update import_batches set reverted_at = now() where id = p_batch;
  insert into audit_logs (actor_id, table_name, record_id, action, diff)
  values (auth.uid(), 'import_batches', p_batch::text, 'revert',
          jsonb_build_object('deleted', n_deleted, 'restored', n_restored, 'kept', n_kept));
  return jsonb_build_object('deleted', n_deleted, 'restored', n_restored, 'kept', n_kept);
end $$;

revoke all on function revert_import_batch(uuid) from public, anon;
grant execute on function revert_import_batch(uuid) to authenticated;
