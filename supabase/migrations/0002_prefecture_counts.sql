-- 都道府県別の掲載医療機関数（トップページの地図用）
-- 0件の都道府県も行を返す（地図上で0件と表示し、検索できるようにするため）
-- security_invoker により、呼び出し側の RLS（公開済みのみ）がそのまま適用される

create or replace view public_prefecture_counts
with (security_invoker = true) as
select
  p.code as prefecture_code,
  count(f.id)::int as facility_count
from prefectures p
left join facilities f
  on f.prefecture_code = p.code
 and f.is_published
group by p.code;

grant select on public_prefecture_counts to anon, authenticated;

-- 47都道府県マスタ（未投入の環境向け。既にある場合は何もしない）
insert into prefectures (code, name, region, sort_order) values
  (1,'北海道','hokkaido_tohoku',1),(2,'青森県','hokkaido_tohoku',2),(3,'岩手県','hokkaido_tohoku',3),
  (4,'宮城県','hokkaido_tohoku',4),(5,'秋田県','hokkaido_tohoku',5),(6,'山形県','hokkaido_tohoku',6),
  (7,'福島県','hokkaido_tohoku',7),(8,'茨城県','kanto',8),(9,'栃木県','kanto',9),(10,'群馬県','kanto',10),
  (11,'埼玉県','kanto',11),(12,'千葉県','kanto',12),(13,'東京都','kanto',13),(14,'神奈川県','kanto',14),
  (15,'新潟県','chubu',15),(16,'富山県','chubu',16),(17,'石川県','chubu',17),(18,'福井県','chubu',18),
  (19,'山梨県','chubu',19),(20,'長野県','chubu',20),(21,'岐阜県','chubu',21),(22,'静岡県','chubu',22),
  (23,'愛知県','chubu',23),(24,'三重県','kinki',24),(25,'滋賀県','kinki',25),(26,'京都府','kinki',26),
  (27,'大阪府','kinki',27),(28,'兵庫県','kinki',28),(29,'奈良県','kinki',29),(30,'和歌山県','kinki',30),
  (31,'鳥取県','chugoku_shikoku',31),(32,'島根県','chugoku_shikoku',32),(33,'岡山県','chugoku_shikoku',33),
  (34,'広島県','chugoku_shikoku',34),(35,'山口県','chugoku_shikoku',35),(36,'徳島県','chugoku_shikoku',36),
  (37,'香川県','chugoku_shikoku',37),(38,'愛媛県','chugoku_shikoku',38),(39,'高知県','chugoku_shikoku',39),
  (40,'福岡県','kyushu_okinawa',40),(41,'佐賀県','kyushu_okinawa',41),(42,'長崎県','kyushu_okinawa',42),
  (43,'熊本県','kyushu_okinawa',43),(44,'大分県','kyushu_okinawa',44),(45,'宮崎県','kyushu_okinawa',45),
  (46,'鹿児島県','kyushu_okinawa',46),(47,'沖縄県','kyushu_okinawa',47)
on conflict (code) do nothing;

-- 処置・麻酔方法マスタ（アプリの src/lib/master.ts と slug を一致させる）
insert into procedures (slug, name, category, sort_order) values
  ('cervical-dilation','子宮頸管拡張（ラミナリアなど）','子宮頸管',1),
  ('endometrial-biopsy','子宮内膜検査・子宮内膜生検','検査',2),
  ('hysteroscopy','子宮鏡検査','検査',3),
  ('iud','子宮内避妊具（IUD）挿入・抜去','避妊',4),
  ('abortion','中絶手術','手術',5),
  ('fertility','人工授精・不妊治療に伴う処置','不妊治療',6),
  ('intrauterine-surgery','子宮内処置・手術','手術',7),
  ('pelvic-exam','内診・経腟超音波検査','診察',8),
  ('labor','分娩・無痛分娩','分娩',9),
  ('other','その他の婦人科処置','その他',10)
on conflict (slug) do nothing;

insert into anesthesia_methods (slug, name, is_consultation_only, sort_order) values
  ('local','局所麻酔',false,1),
  ('paracervical-block','傍頸管ブロック',false,2),
  ('iv-anesthesia','静脈麻酔',false,3),
  ('sedation','鎮静',false,4),
  ('nitrous-oxide','笑気麻酔',false,5),
  ('general','全身麻酔',false,6),
  ('epidural','硬膜外麻酔',false,7),
  ('analgesics','鎮痛薬の使用',false,8),
  ('consultation','麻酔方法を個別相談できる',true,9)
on conflict (slug) do nothing;
