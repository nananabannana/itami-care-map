-- 第1次調査：公式情報で確認した実在医療機関（2026-10-30 照合）
--
-- 前提：migrations の 0001〜0003 を実行済みであること
-- 方針：
--   - すべて review_status = 'draft'、is_published = false（管理者の承認まで非公開）
--   - is_demo = false（架空のデモデータとは別。デモデータはアプリ内にのみ存在し、DBには入れない）
--   - 根拠は公式ページの該当箇所を短く引用（evidence_excerpt）
--   - 確認日は 2026-10-30。再確認期限は確認日＋6か月（自動）。古い資料は期限を当日にして要再確認にする
--   - 麻酔方法は処置ごとに登録。「子宮鏡検査」と「子宮鏡下手術」、「ラミナリア（頸管拡張）」と「手術」を分ける
--   - 公式ページで確認できなかった項目は登録しない（＝画面では「未確認」）
--   - 何度実行しても重複しない（同じ slug があればスキップ）

-- 共通：1つの対応行を登録する補助関数（この SQL の中だけで使い、最後に削除）
create or replace function pg_temp.add_support(
  p_facility uuid, p_procedure text, p_method text, p_status support_status,
  p_source uuid, p_conditions text default null, p_notes text default null,
  p_review_due date default null
) returns void language plpgsql as $$
begin
  insert into facility_procedure_support
    (facility_id, procedure_id, anesthesia_method_id, support_status, conditions, notes,
     extra_fee, evidence_status, source_id, verified_at, last_checked_at, review_due_at, is_published)
  values
    (p_facility,
     (select id from procedures where slug = p_procedure),
     (select id from anesthesia_methods where slug = p_method),
     p_status, p_conditions, p_notes, 'unknown', 'A', p_source, date '2026-10-30', date '2026-10-30',
     p_review_due, false);
end $$;

-- =====================================================================
-- 東京都
-- =====================================================================

-- 順天堂東京江東高齢者医療センター
do $$
declare f uuid; s uuid;
begin
  if exists (select 1 from facilities where slug = 'juntendo-tokyo-koto') then raise notice 'skip juntendo-tokyo-koto'; return; end if;
  insert into facilities (slug, name, prefecture_code, city, address, phone, website_url, facility_type, is_demo, is_published, review_status)
  values ('juntendo-tokyo-koto', '順天堂大学医学部附属 順天堂東京江東高齢者医療センター', 13, '江東区',
          '〒136-0075 東京都江東区新砂3丁目3番20号', '03-5632-3111', 'https://hosp-gmc.juntendo.ac.jp/', 'hospital', false, false, 'draft')
  returning id into f;
  insert into sources (facility_id, source_type, source_url, source_title, evidence_excerpt, document_date, checked_at, is_basic_info)
  values (f, 'official_site', 'https://hosp-gmc.juntendo.ac.jp/topics/408', '日帰り子宮鏡手術をご希望される患者さんへ',
          '「全身麻酔を伴わない局所麻酔下での子宮鏡手術を行う体制」「処置への恐怖心が強い方などは全身麻酔下での手術(3日程度の入院)をお勧め」',
          '2026年7月28日掲載', date '2026-10-30', true)
  returning id into s;
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'local', 'available', s, '日帰り手術（細径子宮鏡を使用）');
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'general', 'available', s,
    '長時間に及ぶ手術、局所麻酔アレルギーがある場合、処置への恐怖心が強い場合などに推奨（3日程度の入院）');
end $$;

-- 順天堂医院
do $$
declare f uuid; s uuid;
begin
  if exists (select 1 from facilities where slug = 'juntendo-hospital') then raise notice 'skip juntendo-hospital'; return; end if;
  insert into facilities (slug, name, prefecture_code, city, address, phone, website_url, facility_type, is_demo, is_published, review_status)
  values ('juntendo-hospital', '順天堂大学医学部附属 順天堂医院', 13, '文京区',
          '〒113-8431 東京都文京区本郷3-1-3', '03-3813-3111', 'https://hosp.juntendo.ac.jp/', 'hospital', false, false, 'draft')
  returning id into f;
  insert into sources (facility_id, source_type, source_url, source_title, evidence_excerpt, document_date, checked_at)
  values (f, 'official_site', 'https://hosp.juntendo.ac.jp/clinic/center/reproduction/treatment/',
          '女性低侵襲外科・リプロダクションセンター 治療方法', '「麻酔はラリンゲルマスクまたは通常の全身麻酔です。」（子宮鏡手術）',
          '記載なし', date '2026-10-30')
  returning id into s;
  insert into sources (facility_id, source_type, source_url, source_title, document_date, checked_at, is_basic_info, notes)
  values (f, 'official_site', 'https://hosp.juntendo.ac.jp/access.html', '交通アクセス', '記載なし', date '2026-10-30', true, '住所・代表電話の確認に使用');
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'general', 'available', s, 'ラリンゲルマスクまたは通常の全身麻酔');
end $$;

-- 浜田病院
do $$
declare f uuid; s uuid;
begin
  if exists (select 1 from facilities where slug = 'hamada-hospital') then raise notice 'skip hamada-hospital'; return; end if;
  insert into facilities (slug, name, prefecture_code, city, address, phone, website_url, facility_type, is_demo, is_published, review_status)
  values ('hamada-hospital', '浜田病院', 13, '千代田区',
          '〒101-0062 東京都千代田区神田駿河台2-5-1', '03-5280-1166', 'https://obatakai.or.jp/', 'hospital', false, false, 'draft')
  returning id into f;
  insert into sources (facility_id, source_type, source_url, source_title, evidence_excerpt, document_date, checked_at, is_basic_info, notes)
  values (f, 'official_site', 'https://obatakai.or.jp/gairai/fujinka/shujutsu_shikyukyo/', '子宮鏡手術（子宮内膜ポリープ・粘膜下子宮筋腫）',
          '「全身麻酔で行います」', '最終確認日：2026年8月27日（ページの表示）', date '2026-10-30', true, '電話番号は外来の番号');
  select id into s from sources where facility_id = f;
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'general', 'available', s, '1泊2日の入院');
end $$;

-- 山王病院
do $$
declare f uuid; s uuid;
begin
  if exists (select 1 from facilities where slug = 'sanno-hospital') then raise notice 'skip sanno-hospital'; return; end if;
  insert into facilities (slug, name, prefecture_code, city, address, phone, website_url, facility_type, is_demo, is_published, review_status)
  values ('sanno-hospital', '山王病院', 13, '港区',
          '〒107-0052 東京都港区赤坂8-10-16', '03-3402-3151', 'https://www.sannoclc.or.jp/hospital/', 'hospital', false, false, 'draft')
  returning id into f;
  insert into sources (facility_id, source_type, source_url, source_title, evidence_excerpt, document_date, checked_at)
  values (f, 'official_site', 'https://www.sannoclc.or.jp/hospital/repro/inspection/',
          'リプロダクション・婦人科内視鏡治療センター 内視鏡手術', '「麻酔科医による全身麻酔の下で子宮鏡手術を行っています。」',
          '記載なし', date '2026-10-30')
  returning id into s;
  insert into sources (facility_id, source_type, source_url, source_title, document_date, checked_at, is_basic_info, notes)
  values (f, 'official_site', 'https://www.sannoclc.or.jp/hospital/guidance/access.html', '交通アクセス', '記載なし', date '2026-10-30', true, '住所・代表電話の確認に使用');
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'general', 'available', s, '麻酔科医による全身麻酔');
end $$;

-- 東京西徳洲会病院
do $$
declare f uuid; s uuid;
begin
  if exists (select 1 from facilities where slug = 'tokyo-nishi-tokushukai') then raise notice 'skip tokyo-nishi-tokushukai'; return; end if;
  insert into facilities (slug, name, prefecture_code, city, address, phone, website_url, facility_type, is_demo, is_published, review_status)
  values ('tokyo-nishi-tokushukai', '東京西徳洲会病院', 13, '昭島市',
          '〒196-0003 東京都昭島市松原町3-1-1', null, 'https://www.tokyonishi-hp.or.jp/', 'hospital', false, false, 'draft')
  returning id into f;
  insert into sources (facility_id, source_type, source_url, source_title, evidence_excerpt, document_date, checked_at, is_basic_info, notes)
  values (f, 'official_site', 'https://www.tokyonishi-hp.or.jp/section/gynecology/outline', '婦人科 診療概要',
          '「麻酔科医管理による全身麻酔で行いますので、1泊2日あるいは2泊3日となります。」', '記載なし', date '2026-10-30', true,
          '調査メモでは「全身麻酔を推奨」とあったが、ページ上で「推奨」とされているのは1泊2日の入院。電話番号はページに記載なし');
  select id into s from sources where facility_id = f;
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'general', 'available', s, '麻酔科医の管理。1泊2日または2泊3日の入院');
end $$;

-- 聖母病院
do $$
declare f uuid; s uuid;
begin
  if exists (select 1 from facilities where slug = 'seibo-hospital') then raise notice 'skip seibo-hospital'; return; end if;
  insert into facilities (slug, name, prefecture_code, city, address, phone, website_url, facility_type, is_demo, is_published, review_status)
  values ('seibo-hospital', '聖母病院', 13, '新宿区',
          '〒161-8521 東京都新宿区中落合2-5-1', '03-3951-1111', 'https://www.seibokai.or.jp/', 'hospital', false, false, 'draft')
  returning id into f;
  insert into sources (facility_id, source_type, source_url, source_title, evidence_excerpt, document_date, checked_at)
  values (f, 'official_site', 'https://www.seibokai.or.jp/resources/file/pdf/fujinka_ope_sikyu-kyouka.pdf', '子宮鏡下手術に関する説明文書（PDF）',
          '麻酔：「脊髄くも膜下麻酔もしくは全身麻酔を選択します」／ラミナリア挿入：「痛みが強い場合には鎮痛剤を使用します」（通常は鎮痛剤や麻酔を必要としない旨の記載あり）',
          '2024年1月作成（管理番号 07-05）', date '2026-10-30')
  returning id into s;
  insert into sources (facility_id, source_type, source_url, source_title, document_date, checked_at, is_basic_info, notes)
  values (f, 'official_site', 'https://www.seibokai.or.jp/accessmap/', '交通案内', '記載なし', date '2026-10-30', true, '住所・代表電話の確認に使用');
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'spinal', 'available', s, '原則として外来で麻酔科医と面談のうえ、全身麻酔と選択');
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'general', 'available', s, '原則として外来で麻酔科医と面談のうえ、脊髄くも膜下麻酔と選択');
  perform pg_temp.add_support(f, 'cervical-dilation', 'none', 'available', s,
    '子宮鏡下手術の術前処置（ラミナリア挿入）。軽い痛みを伴うことがあるが、ほとんどの場合は鎮痛剤や麻酔は不要とされている');
  perform pg_temp.add_support(f, 'cervical-dilation', 'analgesics', 'available', s,
    '子宮鏡下手術の術前処置（ラミナリア挿入）で、痛みが強い場合');
end $$;

-- =====================================================================
-- 岩手県
-- =====================================================================
do $$
declare f uuid; s uuid;
begin
  if exists (select 1 from facilities where slug = 'iwate-medical-university-hospital') then raise notice 'skip iwate'; return; end if;
  insert into facilities (slug, name, prefecture_code, city, address, phone, website_url, facility_type, is_demo, is_published, review_status, review_note)
  values ('iwate-medical-university-hospital', '岩手医科大学附属病院', 3, '紫波郡矢巾町',
          '〒028-3695 岩手県紫波郡矢巾町医大通二丁目1番1号', '019-613-7111', 'https://www.hosp.iwate-med.ac.jp/yahaba/', 'hospital', false, false, 'draft',
          '根拠資料が古い可能性があるため、公開前に現行の運用を医療機関または最新の公式情報で再確認すること')
  returning id into f;
  insert into sources (facility_id, source_type, source_url, source_title, evidence_excerpt, document_date, checked_at, notes)
  values (f, 'official_site', 'https://www.hosp.iwate-med.ac.jp/wp/wp-content/uploads/2019/07/35d55bfbd265ea5d2f89a01b6268f4d4.pdf',
          '子宮鏡下手術（TCR）を受ける患者様へ【患者様用クリニカルパス】（PDF）', '「麻酔は全身麻酔で行います」',
          '記載なし（2019年7月にアップロードされたファイル）', date '2026-10-30', '産婦人科の患者用クリニカルパス。作成日の欄は空欄')
  returning id into s;
  insert into sources (facility_id, source_type, source_url, source_title, document_date, checked_at, is_basic_info, notes)
  values (f, 'official_site', 'https://www.hosp.iwate-med.ac.jp/yahaba/access/', '地図・アクセス', '記載なし', date '2026-10-30', true, '住所・代表電話の確認に使用');
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'general', 'available', s, null,
    '根拠資料が古い可能性あり。現行の運用は要再確認', date '2026-10-30');
end $$;

-- =====================================================================
-- 千葉県
-- =====================================================================
do $$
declare f uuid; s uuid;
begin
  if exists (select 1 from facilities where slug = 'chiba-aoba-municipal-hospital') then raise notice 'skip chiba-aoba'; return; end if;
  insert into facilities (slug, name, prefecture_code, city, address, phone, website_url, facility_type, is_demo, is_published, review_status)
  values ('chiba-aoba-municipal-hospital', '千葉市立青葉病院', 12, '千葉市中央区',
          '〒260-0852 千葉市中央区青葉町1273-2', '043-227-1131', 'https://hospital.city.chiba.jp/aoba/', 'hospital', false, false, 'draft')
  returning id into f;
  insert into sources (facility_id, source_type, source_url, source_title, evidence_excerpt, document_date, checked_at, is_basic_info)
  values (f, 'official_site', 'https://hospital.city.chiba.jp/aoba/department/section/obstetrics/hysteroscopic_surgery/', '子宮鏡手術・子宮鏡検査について',
          '手術：「全身麻酔、または腰椎麻酔を用いて手術を行います。」／検査：「麻酔は行いませんが、」', '2025年2月18日更新',
          date '2026-10-30', true)
  returning id into s;
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'general', 'available', s, '麻酔科医が担当');
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'spinal', 'available', s, '腰椎麻酔。麻酔科医が担当');
  perform pg_temp.add_support(f, 'hysteroscopy', 'none', 'available', s,
    '診断目的の子宮鏡検査。手術用より細いスコープを使用し、多くは軽い違和感程度とされている');
end $$;

-- =====================================================================
-- 茨城県
-- =====================================================================
do $$
declare f uuid; s uuid;
begin
  if exists (select 1 from facilities where slug = 'tsukuba-central-hospital') then raise notice 'skip tsukuba-central'; return; end if;
  insert into facilities (slug, name, prefecture_code, city, address, phone, website_url, facility_type, is_demo, is_published, review_status)
  values ('tsukuba-central-hospital', 'つくばセントラル病院', 8, '牛久市',
          '茨城県牛久市柏田町1589-3', '029-872-1771', 'https://central.or.jp/', 'hospital', false, false, 'draft')
  returning id into f;
  insert into sources (facility_id, source_type, source_url, source_title, evidence_excerpt, document_date, checked_at, is_basic_info)
  values (f, 'official_site', 'https://central.or.jp/sector/obstet_abortion.php', '人工妊娠中絶について',
          '「静脈麻酔下で吸引法により子宮内容を除去します。」', '記載なし', date '2026-10-30', true)
  returning id into s;
  perform pg_temp.add_support(f, 'abortion', 'iv-anesthesia', 'available', s, '吸引法による手術',
    '中期中絶（子宮頸管拡張後に分娩誘発）の麻酔・鎮痛はページに記載なし');
end $$;

-- =====================================================================
-- 大阪府
-- =====================================================================
do $$
declare f uuid; s uuid;
begin
  if exists (select 1 from facilities where slug = 'osaka-national-hospital') then raise notice 'skip osaka'; return; end if;
  insert into facilities (slug, name, prefecture_code, city, address, phone, website_url, facility_type, is_demo, is_published, review_status)
  values ('osaka-national-hospital', '国立病院機構 大阪医療センター', 27, '大阪市中央区',
          '〒540-0006 大阪市中央区法円坂2-1-14', '06-6942-1331', 'https://osaka.hosp.go.jp/', 'hospital', false, false, 'draft')
  returning id into f;
  insert into sources (facility_id, source_type, source_url, source_title, evidence_excerpt, document_date, checked_at, is_basic_info)
  values (f, 'official_site', 'https://osaka.hosp.go.jp/department/obgyn/service/index.html', '婦人科 診療内容',
          '検査・処置：「鎮痛剤の投与と静脈麻酔（ねむる麻酔）を併用」／手術：「脊髄くも膜下麻酔」「希望により静脈麻酔：ねむる麻酔も併用」',
          '記載なし', date '2026-10-30', true)
  returning id into s;
  perform pg_temp.add_support(f, 'hysteroscopy', 'analgesics', 'available', s, '子宮鏡検査・処置（ファイバースコープ）。静脈麻酔と併用');
  perform pg_temp.add_support(f, 'hysteroscopy', 'iv-anesthesia', 'available', s, '子宮鏡検査・処置（ファイバースコープ）。鎮痛剤と併用');
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'spinal', 'available', s, '手術室で実施');
  perform pg_temp.add_support(f, 'hysteroscopic-surgery', 'iv-anesthesia', 'available', s, '希望により脊髄くも膜下麻酔に併用');
end $$;

-- =====================================================================
-- 京都府
-- =====================================================================
do $$
declare f uuid; s uuid;
begin
  if exists (select 1 from facilities where slug = 'kyoto-saiseikai-hospital') then raise notice 'skip kyoto-saiseikai'; return; end if;
  insert into facilities (slug, name, prefecture_code, city, address, phone, website_url, facility_type, is_demo, is_published, review_status)
  values ('kyoto-saiseikai-hospital', '京都済生会病院', 26, '長岡京市',
          '〒617-8617 京都府長岡京市下海印寺下内田101番地', '075-955-0111', 'https://www.kyoto.saiseikai.or.jp/', 'hospital', false, false, 'draft')
  returning id into f;
  insert into sources (facility_id, source_type, source_url, source_title, evidence_excerpt, document_date, checked_at, is_basic_info)
  values (f, 'official_site', 'https://www.kyoto.saiseikai.or.jp/pickup/2026/07/post-106.html', '人工妊娠中絶をお考えの方へ',
          '麻酔：「静脈麻酔または局所麻酔」（手術による中絶）', '2026年7月1日掲載', date '2026-10-30', true)
  returning id into s;
  perform pg_temp.add_support(f, 'abortion', 'iv-anesthesia', 'available', s, '手術による中絶（妊娠11週6日まで）',
    '頸管拡張は、手術の数時間前に拡張材を入れる方法と、麻酔下で器具により拡張する方法が説明されている。拡張材挿入時の鎮痛は記載なし');
  perform pg_temp.add_support(f, 'abortion', 'local', 'available', s, '手術による中絶（妊娠11週6日まで）');
end $$;

-- =====================================================================
-- 追加調査候補（麻酔方法は未確認。公開しない）
-- =====================================================================
insert into research_candidates (name, prefecture_code, note) values
  ('高知医療センター', 39, '調査メモでは子宮鏡下手術：全身麻酔。2026-10-30時点で婦人科ページが「ホームページ一時公開停止」となっており確認できず'),
  ('名鉄病院', 23, '診療・手術実績は確認済み。麻酔方法は未確認'),
  ('名古屋市立大学医学部附属東部医療センター', 23, '診療・手術実績は確認済み。麻酔方法は未確認'),
  ('大同病院', 23, '診療・手術実績は確認済み。麻酔方法は未確認'),
  ('新潟南病院', 15, '診療・手術実績は確認済み。麻酔方法は未確認'),
  ('NTT東日本札幌病院', 1, '診療・手術実績は確認済み。麻酔方法は未確認'),
  ('福岡中央病院', 40, '診療・手術実績は確認済み。麻酔方法は未確認'),
  ('福岡東医療センター', 40, '診療・手術実績は確認済み。麻酔方法は未確認')
on conflict (name, prefecture_code) do nothing;

-- 確認用
select f.name, f.review_status, f.is_published, count(s.id) as support_rows
from facilities f left join facility_procedure_support s on s.facility_id = f.id
group by f.name, f.review_status, f.is_published order by f.name;
