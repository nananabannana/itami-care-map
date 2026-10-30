import type {
  AnesthesiaMethod,
  CareItemKey,
  CareStatus,
  EvidenceStatus,
  Prefecture,
  Procedure,
  RegionKey,
  SourceType,
  SupportStatus,
  Tier,
} from "./types";

export const REGIONS: { key: RegionKey; name: string }[] = [
  { key: "hokkaido_tohoku", name: "北海道・東北" },
  { key: "kanto", name: "関東" },
  { key: "chubu", name: "中部" },
  { key: "kinki", name: "近畿" },
  { key: "chugoku_shikoku", name: "中国・四国" },
  { key: "kyushu_okinawa", name: "九州・沖縄" },
];

const P = (code: number, slug: string, name: string, region: RegionKey): Prefecture => ({
  code,
  slug,
  name,
  region,
});

export const PREFECTURES: Prefecture[] = [
  P(1, "hokkaido", "北海道", "hokkaido_tohoku"),
  P(2, "aomori", "青森県", "hokkaido_tohoku"),
  P(3, "iwate", "岩手県", "hokkaido_tohoku"),
  P(4, "miyagi", "宮城県", "hokkaido_tohoku"),
  P(5, "akita", "秋田県", "hokkaido_tohoku"),
  P(6, "yamagata", "山形県", "hokkaido_tohoku"),
  P(7, "fukushima", "福島県", "hokkaido_tohoku"),
  P(8, "ibaraki", "茨城県", "kanto"),
  P(9, "tochigi", "栃木県", "kanto"),
  P(10, "gunma", "群馬県", "kanto"),
  P(11, "saitama", "埼玉県", "kanto"),
  P(12, "chiba", "千葉県", "kanto"),
  P(13, "tokyo", "東京都", "kanto"),
  P(14, "kanagawa", "神奈川県", "kanto"),
  P(15, "niigata", "新潟県", "chubu"),
  P(16, "toyama", "富山県", "chubu"),
  P(17, "ishikawa", "石川県", "chubu"),
  P(18, "fukui", "福井県", "chubu"),
  P(19, "yamanashi", "山梨県", "chubu"),
  P(20, "nagano", "長野県", "chubu"),
  P(21, "gifu", "岐阜県", "chubu"),
  P(22, "shizuoka", "静岡県", "chubu"),
  P(23, "aichi", "愛知県", "chubu"),
  P(24, "mie", "三重県", "kinki"),
  P(25, "shiga", "滋賀県", "kinki"),
  P(26, "kyoto", "京都府", "kinki"),
  P(27, "osaka", "大阪府", "kinki"),
  P(28, "hyogo", "兵庫県", "kinki"),
  P(29, "nara", "奈良県", "kinki"),
  P(30, "wakayama", "和歌山県", "kinki"),
  P(31, "tottori", "鳥取県", "chugoku_shikoku"),
  P(32, "shimane", "島根県", "chugoku_shikoku"),
  P(33, "okayama", "岡山県", "chugoku_shikoku"),
  P(34, "hiroshima", "広島県", "chugoku_shikoku"),
  P(35, "yamaguchi", "山口県", "chugoku_shikoku"),
  P(36, "tokushima", "徳島県", "chugoku_shikoku"),
  P(37, "kagawa", "香川県", "chugoku_shikoku"),
  P(38, "ehime", "愛媛県", "chugoku_shikoku"),
  P(39, "kochi", "高知県", "chugoku_shikoku"),
  P(40, "fukuoka", "福岡県", "kyushu_okinawa"),
  P(41, "saga", "佐賀県", "kyushu_okinawa"),
  P(42, "nagasaki", "長崎県", "kyushu_okinawa"),
  P(43, "kumamoto", "熊本県", "kyushu_okinawa"),
  P(44, "oita", "大分県", "kyushu_okinawa"),
  P(45, "miyazaki", "宮崎県", "kyushu_okinawa"),
  P(46, "kagoshima", "鹿児島県", "kyushu_okinawa"),
  P(47, "okinawa", "沖縄県", "kyushu_okinawa"),
];

export const PROCEDURES: Procedure[] = [
  {
    slug: "cervical-dilation",
    name: "子宮頸管拡張（ラミナリアなど）",
    category: "子宮頸管",
    description:
      "子宮の入り口（頸管）を広げる処置です。中絶手術や子宮内の処置の前に、ラミナリアなどの拡張材を入れて行われることがあります。",
  },
  {
    slug: "endometrial-biopsy",
    name: "子宮内膜検査・子宮内膜生検",
    category: "検査",
    description:
      "子宮の内側の膜（内膜）の細胞や組織を採取して調べる検査です。不正出血の原因を調べる目的などで行われます。",
  },
  {
    slug: "hysteroscopy",
    name: "子宮鏡検査",
    category: "検査",
    description:
      "細いカメラを子宮の中に入れて、内部の様子を直接観察する検査です。",
  },
  {
    slug: "hysteroscopic-surgery",
    name: "子宮鏡下手術",
    category: "手術",
    description:
      "子宮鏡を使って、子宮内膜ポリープや粘膜下筋腫などを切除する手術です。診断目的の子宮鏡検査とは麻酔の方法が異なることがあります。",
  },
  {
    slug: "iud",
    name: "子宮内避妊具（IUD）挿入・抜去",
    category: "避妊",
    description:
      "子宮の中に避妊具（IUD・IUS）を入れる、または取り出す処置です。",
  },
  {
    slug: "abortion",
    name: "中絶手術",
    category: "手術",
    description:
      "人工妊娠中絶の手術です。方法や麻酔は妊娠週数や医療機関の体制によって異なります。",
  },
  {
    slug: "fertility",
    name: "人工授精・不妊治療に伴う処置",
    category: "不妊治療",
    description:
      "人工授精、採卵、胚移植など、不妊治療の過程で行われる処置です。",
  },
  {
    slug: "intrauterine-surgery",
    name: "子宮内処置・手術",
    category: "手術",
    description:
      "子宮内容除去術、子宮内膜ポリープ切除など、子宮の内側に対して行う処置や手術です。",
  },
  {
    slug: "pelvic-exam",
    name: "内診・経腟超音波検査",
    category: "診察",
    description:
      "内診台で行う診察や、腟から細い超音波プローブを入れて行う検査です。",
  },
  {
    slug: "labor",
    name: "分娩・無痛分娩",
    category: "分娩",
    description:
      "出産時の麻酔・鎮痛です。無痛分娩（和痛分娩）の対応は、婦人科の他の処置の麻酔対応とは別に確認が必要です。",
  },
  {
    slug: "other",
    name: "その他の婦人科処置",
    category: "その他",
    description: "上記以外の婦人科の処置です。",
  },
];

export const METHODS: AnesthesiaMethod[] = [
  {
    slug: "local",
    name: "局所麻酔",
    description: "処置する部分に麻酔薬を注射したり塗ったりして、感覚を和らげる方法です。",
    isConsultationOnly: false,
  },
  {
    slug: "paracervical-block",
    name: "傍頸管ブロック",
    description:
      "子宮の入り口（頸管）の周りに局所麻酔薬を注射する方法で、局所麻酔の一種です。頸管を広げる処置などで使われることがあります。",
    isConsultationOnly: false,
  },
  {
    slug: "iv-anesthesia",
    name: "静脈麻酔",
    description: "点滴から麻酔薬を入れ、眠っている状態で処置を受ける方法です。",
    isConsultationOnly: false,
  },
  {
    slug: "sedation",
    name: "鎮静",
    description:
      "薬で緊張や不安を和らげ、うとうとした状態にする方法です。眠りの深さは薬の量や方法によって異なります。",
    isConsultationOnly: false,
  },
  {
    slug: "nitrous-oxide",
    name: "笑気麻酔",
    description: "笑気ガス（亜酸化窒素）を鼻から吸って、緊張や痛みを和らげる方法です。",
    isConsultationOnly: false,
  },
  {
    slug: "spinal",
    name: "脊髄くも膜下麻酔（腰椎麻酔）",
    description:
      "背中から細い針で麻酔薬を入れ、下半身の感覚をなくす方法です。「下半身麻酔」「腰椎麻酔」とも呼ばれます。",
    isConsultationOnly: false,
  },
  {
    slug: "general",
    name: "全身麻酔",
    description: "意識がない状態で処置や手術を受ける方法です。呼吸の管理を伴うことがあります。",
    isConsultationOnly: false,
  },
  {
    slug: "epidural",
    name: "硬膜外麻酔",
    description:
      "背中から細い管を入れて麻酔薬を少しずつ入れる方法です。無痛分娩で多く使われます。",
    isConsultationOnly: false,
  },
  {
    slug: "analgesics",
    name: "鎮痛薬の使用",
    description: "処置の前後に飲み薬や坐薬などの痛み止めを使う方法です。",
    isConsultationOnly: false,
  },
  {
    slug: "consultation",
    name: "麻酔方法を個別相談できる",
    description:
      "決まった方法ではなく、希望や体の状態に合わせて麻酔・鎮痛を相談できることを示します。",
    isConsultationOnly: true,
  },
  {
    slug: "none",
    name: "麻酔を使用しない",
    description:
      "通常は麻酔を使わずに行うことが確認できたものです。痛みへの対応がないという意味ではありません。",
    isConsultationOnly: false,
    isNone: true,
  },
];

/** 検索・入口に出す麻酔方法（「麻酔を使用しない」は探す条件にしない） */
export const SEARCHABLE_METHODS = METHODS.filter((m) => !m.isNone);

export const CARE_ITEMS: { key: CareItemKey; label: string; filterLabel?: string }[] = [
  { key: "explanation_before_procedure", label: "処置前の説明" },
  { key: "informed_consent", label: "患者の同意確認" },
  { key: "stop_on_request", label: "痛みが強い場合の中断対応", filterLabel: "患者の意思による中断に対応" },
  { key: "pain_management_consultation", label: "麻酔・鎮痛の相談" },
  { key: "female_doctor_available", label: "女性医師の希望", filterLabel: "女性医師の対応あり" },
  { key: "female_staff_available", label: "女性スタッフの立ち会い希望" },
  { key: "consultation_only", label: "初診時の相談のみの受診", filterLabel: "初診は相談のみも可" },
];

export const EVIDENCE: Record<
  EvidenceStatus,
  { short: string; label: string; className: string }
> = {
  A: {
    short: "A 公式確認",
    label: "公式サイトで個別の対応内容を確認済み",
    className: "bg-ev-a-bg text-ev-a border-ev-a",
  },
  B: {
    short: "B 直接確認",
    label: "医療機関へ直接確認済み",
    className: "bg-ev-b-bg text-ev-b border-ev-b",
  },
  C: {
    short: "C 相談方針",
    label: "公式サイトに麻酔・鎮痛への相談方針を確認済み",
    className: "bg-ev-c-bg text-ev-c border-ev-c",
  },
  D: {
    short: "D 基本情報",
    label: "一般的な診療情報のみ確認済み",
    className: "bg-ev-d-bg text-ev-d border-ev-d",
  },
  U: {
    short: "U 未確認",
    label: "未確認",
    className: "bg-white text-ink-muted border-line border-dashed",
  },
};

export const SUPPORT_STATUS: Record<SupportStatus, string> = {
  available: "実施",
  consultation: "個別に相談可",
  not_offered: "実施していない",
  unknown: "未確認",
};

export const CARE_STATUS: Record<CareStatus, string> = {
  yes: "対応あり",
  conditional: "条件付きで対応",
  no: "対応なし",
  unknown: "未確認",
};

export const SOURCE_TYPE: Record<SourceType, string> = {
  official_site: "公式サイト",
  direct_inquiry: "医療機関へ直接確認",
  public_registry: "公的情報",
};

export const TIER_LABEL: Record<Tier, { title: string; description: string }> = {
  1: {
    title: "公式情報で対応を確認済み",
    description: "希望する処置での麻酔・鎮痛の実施が、医療機関の公式サイトで確認できた医療機関です。",
  },
  2: {
    title: "医療機関へ直接確認済み",
    description: "希望する処置での麻酔・鎮痛の実施を、医療機関への問い合わせで確認した医療機関です。",
  },
  3: {
    title: "麻酔・鎮痛について個別相談が可能",
    description: "決まった方法の実施は確認できていませんが、麻酔・鎮痛について相談できることが確認できた医療機関です。",
  },
  4: {
    title: "情報が未確認",
    description:
      "地域などの条件には合いますが、希望する処置の麻酔・鎮痛対応を確認できていない医療機関です。対応しているという意味ではありません。",
  },
};

/** 確認から何日経過したら「古い可能性」と表示するか */
export const STALE_AFTER_DAYS = 365;

export const prefByCode = (code: number) => PREFECTURES.find((p) => p.code === code);
export const prefBySlug = (slug: string) => PREFECTURES.find((p) => p.slug === slug);
export const procedureBySlug = (slug: string) => PROCEDURES.find((p) => p.slug === slug);
export const methodBySlug = (slug: string) => METHODS.find((m) => m.slug === slug);
export const careLabel = (key: CareItemKey) => CARE_ITEMS.find((c) => c.key === key)?.label ?? key;
