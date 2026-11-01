/**
 * JALA（無痛分娩関係学会・団体連絡協議会）全国無痛分娩施設検索の一覧ページの読み取り
 *
 *   一覧：https://www.jalasite.org/area/{地方番号}_{都道府県コード}_all
 *   各施設：https://www.jalasite.org/hp/{番号}.html（取得しない。リンクとして保存するだけ）
 *
 * 取得するのは一覧に載っている「名称・郵便番号・住所・URL・電話番号」のみ。
 * この情報は「無痛分娩の情報公開に取り組む施設として掲載されている」ことを示すだけで、
 * 婦人科処置（ラミナリア・子宮鏡など）の麻酔対応の根拠にはしない。
 */
export const JALA_BASE = "https://www.jalasite.org";
export const JALA_USER_AGENT = "itami-care-map/1.0 (+https://itami-care-map.vercel.app/about)";
/** 都道府県ごとの取得間隔（ミリ秒） */
export const JALA_INTERVAL_MS = 4000;

/** JALA の地方番号（URL の先頭の数字） */
export function jalaRegion(pref: number): number {
  if (pref === 1) return 1;
  if (pref <= 7) return 2;
  if (pref <= 14) return 3;
  if (pref <= 20) return 4;
  if (pref <= 24) return 5;
  if (pref <= 30) return 6;
  if (pref <= 35) return 7;
  if (pref <= 39) return 8;
  return 9;
}

export const jalaListUrl = (pref: number) => `${JALA_BASE}/area/${jalaRegion(pref)}_${pref}_all`;

export interface JalaRecord {
  jalaId: string;
  name: string;
  prefectureCode: number;
  postalCode?: string;
  address: string;
  phone?: string;
  websiteUrl?: string;
  jalaUrl: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+|#39);/g, (m, n) => ENTITIES[n] ?? m);
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|dt|dd|tr|th|td|h\d|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t　]+/g, " ")
    .replace(/\n\s*/g, "\n");
}

/** 「ラベル：値」または「ラベル」の次の行の値を取り出す */
function field(text: string, label: string): string | undefined {
  const m = text.match(new RegExp(`${label}\\s*[：:]?\\s*\\n?\\s*([^\\n]+)`));
  const v = m?.[1].trim();
  return v ? v : undefined;
}

/** 一覧ページの HTML から施設を読み取る */
export function parseJalaListPage(html: string, prefectureCode: number): JalaRecord[] {
  const linkRe = /<a\b[^>]*href=["']([^"']*\/hp\/(\d+)\.html)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const firsts: { id: string; href: string; name: string; start: number; end: number }[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const name = htmlToText(m[3]).replace(/\s+/g, " ").trim();
    if (seen.has(m[2])) {
      // 同じ施設への2つ目のリンク（「詳細」など）。名称が空だった場合だけ補う
      const f = firsts.find((x) => x.id === m![2]);
      if (f && !f.name && name) f.name = name;
      continue;
    }
    seen.add(m[2]);
    firsts.push({ id: m[2], href: m[1], name, start: m.index, end: linkRe.lastIndex });
  }
  return firsts
    .map((f, i) => {
      const block = htmlToText(html.slice(f.end, i + 1 < firsts.length ? firsts[i + 1].start : html.length));
      const postal = field(block, "郵便番号")?.match(/\d{3}-?\d{4}/)?.[0];
      const address = field(block, "住所");
      const url = field(block, "URL")?.match(/https?:\/\/\S+/)?.[0];
      const phone = field(block, "電話番号")?.match(/[\d０-９][\d０-９\-－‐()（）\s]{8,}/)?.[0]?.normalize("NFKC").replace(/\s/g, "");
      return {
        jalaId: f.id,
        name: f.name,
        prefectureCode,
        postalCode: postal ? postal.replace(/^(\d{3})-?(\d{4})$/, "$1-$2") : undefined,
        address: address ?? "",
        phone,
        websiteUrl: url,
        jalaUrl: f.href.startsWith("http") ? f.href : `${JALA_BASE}${f.href.startsWith("/") ? "" : "/"}${f.href}`,
      };
    })
    .filter((r) => r.name && r.address);
}
