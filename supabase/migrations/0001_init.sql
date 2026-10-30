-- いたみケア婦人科マップ 初期スキーマ
-- 方針：対応していないものを対応しているように見せない、をDB制約で担保する

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- 列挙型
-- ---------------------------------------------------------------
create type region as enum ('hokkaido_tohoku','kanto','chubu','kinki','chugoku_shikoku','kyushu_okinawa');
create type facility_type as enum ('clinic','hospital');
create type support_status as enum ('available','consultation','not_offered','unknown');
create type evidence_status as enum ('A','B','C','D','U');
create type source_type as enum ('official_site','direct_inquiry','public_registry');
create type extra_fee as enum ('none','required','unknown');
create type care_item as enum (
  'explanation_before_procedure',
  'informed_consent',
  'stop_on_request',
  'pain_management_consultation',
  'female_doctor_available',
  'female_staff_available',
  'consultation_only'
);
create type care_status as enum ('yes','conditional','no','unknown');
create type correction_type as enum ('correction','deletion','new_listing','other');
create type requester_type as enum ('facility','patient','other');
create type request_status as enum ('new','reviewing','resolved','rejected');

-- ---------------------------------------------------------------
-- マスタ
-- ---------------------------------------------------------------
create table prefectures (
  code smallint primary key check (code between 1 and 47),
  name text not null unique,
  region region not null,
  sort_order smallint not null
);

-- 総務省 全国地方公共団体コード（5桁）
create table municipalities (
  code char(5) primary key,
  prefecture_code smallint not null references prefectures(code),
  name text not null,
  unique (prefecture_code, name)
);

create table procedures (
  id smallserial primary key,
  slug text not null unique,
  name text not null,
  category text not null,
  description text,
  sort_order smallint not null default 0
);

create table anesthesia_methods (
  id smallserial primary key,
  slug text not null unique,
  name text not null,
  description text,
  is_consultation_only boolean not null default false, -- 「麻酔方法を個別相談できる」
  sort_order smallint not null default 0
);

-- ---------------------------------------------------------------
-- 医療機関
-- ---------------------------------------------------------------
create table facilities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  prefecture_code smallint not null references prefectures(code),
  municipality_code char(5) references municipalities(code),
  address text not null,
  phone text,
  website_url text,
  latitude double precision,
  longitude double precision,
  facility_type facility_type not null,
  departments text[] not null default '{}',
  nearest_stations text[] not null default '{}',
  consultation_hours text,
  is_demo boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index facilities_pref_idx on facilities (prefecture_code, municipality_code) where is_published;

-- 出典（1つの公式ページを複数の処置・配慮項目から参照する）
create table sources (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  source_type source_type not null,
  source_url text,
  source_title text not null,
  evidence_excerpt text,              -- 根拠となる箇所の短い抜粋
  contacted_department text,          -- 直接確認時の部署（個人名は記録しない）
  checked_at date not null,
  checked_by uuid,                    -- auth.users.id
  notes text,
  check (source_type <> 'official_site' or source_url is not null),
  check (source_type <> 'direct_inquiry' or contacted_department is not null)
);
create index sources_facility_idx on sources (facility_id);

-- 処置 × 麻酔方法 の対応（1行＝この施設で、この処置に、この方法を使うか）
create table facility_procedure_support (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  procedure_id smallint not null references procedures(id),
  anesthesia_method_id smallint not null references anesthesia_methods(id),
  support_status support_status not null default 'unknown',
  conditions text,
  schedule_note text,
  extra_fee extra_fee not null default 'unknown',
  extra_fee_note text,
  notes text,
  evidence_status evidence_status not null default 'U',
  source_id uuid references sources(id),
  verified_at date,
  last_checked_at date,
  review_due_at date,
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (facility_id, procedure_id, anesthesia_method_id),
  -- 「実施」は公式(A)か直接確認(B)だけ
  constraint available_requires_ab check (support_status <> 'available' or evidence_status in ('A','B')),
  -- 「個別相談」は A/B/C だけ
  constraint consultation_requires_abc check (support_status <> 'consultation' or evidence_status in ('A','B','C')),
  -- 確度が U 以外なら出典と確認日が必須、U なら出典なし
  constraint evidence_has_source check (
    (evidence_status = 'U' and source_id is null)
    or (evidence_status <> 'U' and source_id is not null and verified_at is not null)
  )
);
create index fps_lookup_idx on facility_procedure_support (procedure_id, anesthesia_method_id, support_status) where is_published;

-- 患者への配慮（項目ごとに状態・確度・出典を持つ）
create table facility_care_items (
  facility_id uuid not null references facilities(id) on delete cascade,
  care_item care_item not null,
  status care_status not null default 'unknown',
  note text,
  evidence_status evidence_status not null default 'U',
  source_id uuid references sources(id),
  verified_at date,
  review_due_at date,
  primary key (facility_id, care_item),
  constraint care_yes_requires_abc check (status not in ('yes','conditional','no') or evidence_status in ('A','B','C')),
  constraint care_evidence_has_source check (
    (evidence_status = 'U' and source_id is null)
    or (evidence_status <> 'U' and source_id is not null and verified_at is not null)
  )
);

-- 出典の種別と確度の整合性（A/C=公式サイト、B=直接確認）
create or replace function check_evidence_source() returns trigger
language plpgsql as $$
declare st source_type;
begin
  if new.source_id is null then return new; end if;
  select source_type into st from sources where id = new.source_id;
  if new.evidence_status in ('A','C') and st <> 'official_site' then
    raise exception '確度 % には公式サイトの出典が必要です', new.evidence_status;
  end if;
  if new.evidence_status = 'B' and st <> 'direct_inquiry' then
    raise exception '確度 B には直接確認の出典が必要です';
  end if;
  -- 出典は同じ医療機関のものに限る
  if not exists (select 1 from sources where id = new.source_id and facility_id = new.facility_id) then
    raise exception '別の医療機関の出典は参照できません';
  end if;
  return new;
end $$;

create trigger fps_evidence_check before insert or update on facility_procedure_support
  for each row execute function check_evidence_source();
create trigger care_evidence_check before insert or update on facility_care_items
  for each row execute function check_evidence_source();

-- 再確認期限の初期値（確認日＋6か月）
create or replace function set_review_due() returns trigger
language plpgsql as $$
begin
  if new.verified_at is not null and (tg_op = 'INSERT' or new.verified_at is distinct from old.verified_at) then
    new.review_due_at := coalesce(new.review_due_at, new.verified_at + interval '6 months');
  end if;
  return new;
end $$;
create trigger fps_review_due before insert or update on facility_procedure_support
  for each row execute function set_review_due();
create trigger care_review_due before insert or update on facility_care_items
  for each row execute function set_review_due();

-- ---------------------------------------------------------------
-- 修正依頼（個人の医療情報は保存しない）
-- ---------------------------------------------------------------
create table correction_requests (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facilities(id) on delete set null,
  request_type correction_type not null,
  requester_type requester_type not null,
  message text not null check (char_length(message) <= 2000),
  contact_email text,
  status request_status not null default 'new',
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table audit_logs (
  id bigserial primary key,
  actor_id uuid,
  table_name text not null,
  record_id text not null,
  action text not null,
  diff jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- 権限（RLS）
-- 管理者は auth.users の app_metadata.role = 'admin'
-- ---------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

alter table prefectures enable row level security;
alter table municipalities enable row level security;
alter table procedures enable row level security;
alter table anesthesia_methods enable row level security;
alter table facilities enable row level security;
alter table sources enable row level security;
alter table facility_procedure_support enable row level security;
alter table facility_care_items enable row level security;
alter table correction_requests enable row level security;
alter table audit_logs enable row level security;

-- マスタ：誰でも参照、管理者のみ更新
create policy master_read_pref on prefectures for select using (true);
create policy master_read_muni on municipalities for select using (true);
create policy master_read_proc on procedures for select using (true);
create policy master_read_meth on anesthesia_methods for select using (true);
create policy master_admin_pref on prefectures for all using (is_admin()) with check (is_admin());
create policy master_admin_muni on municipalities for all using (is_admin()) with check (is_admin());
create policy master_admin_proc on procedures for all using (is_admin()) with check (is_admin());
create policy master_admin_meth on anesthesia_methods for all using (is_admin()) with check (is_admin());

-- 公開データ：公開済みのみ参照
create policy facilities_public on facilities for select using (is_published or is_admin());
create policy facilities_admin on facilities for all using (is_admin()) with check (is_admin());

create policy sources_public on sources for select using (
  is_admin() or exists (select 1 from facilities f where f.id = facility_id and f.is_published)
);
create policy sources_admin on sources for all using (is_admin()) with check (is_admin());

create policy fps_public on facility_procedure_support for select using (
  is_admin() or (is_published and exists (select 1 from facilities f where f.id = facility_id and f.is_published))
);
create policy fps_admin on facility_procedure_support for all using (is_admin()) with check (is_admin());

create policy care_public on facility_care_items for select using (
  is_admin() or exists (select 1 from facilities f where f.id = facility_id and f.is_published)
);
create policy care_admin on facility_care_items for all using (is_admin()) with check (is_admin());

-- 修正依頼：誰でも投稿可、閲覧・更新は管理者のみ
create policy corrections_insert on correction_requests for insert with check (status = 'new' and admin_note is null);
create policy corrections_admin on correction_requests for all using (is_admin()) with check (is_admin());

create policy audit_admin on audit_logs for select using (is_admin());
