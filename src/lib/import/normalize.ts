/**
 * 重複判定のための正規化。
 * 表記ゆれ（全角半角・空白・法人名・丁目番地号・漢数字）をそろえてから比較する。
 */
import { PREFECTURES } from "../master";

const LEGAL_PREFIXES = [
  "地方独立行政法人",
  "独立行政法人",
  "国立研究開発法人",
  "国立大学法人",
  "公立大学法人",
  "社会医療法人財団",
  "社会医療法人社団",
  "社会医療法人",
  "特定医療法人",
  "医療法人財団",
  "医療法人社団",
  "医療法人",
  "一般財団法人",
  "公益財団法人",
  "一般社団法人",
  "公益社団法人",
  "社会福祉法人",
  "学校法人",
  "宗教法人",
  "国家公務員共済組合連合会",
  "日本赤十字社",
];

/** 全角英数→半角、空白除去、カタカナの長音など NFKC でそろえる */
export function nfkc(s: string): string {
  return s.normalize("NFKC").replace(/[\s　]+/g, "").trim();
}

/**
 * 施設名の正規化。法人格と、その直後の法人名（「〇〇会」など）を除いた「施設名の本体」を返す。
 * 例：「医療法人社団ワンアンドオンリー 新横浜母と子の病院」→「新横浜母と子の病院」
 */
export function normName(name: string): string {
  let s = name.normalize("NFKC").replace(/　/g, " ").trim();
  for (const p of LEGAL_PREFIXES) {
    if (s.startsWith(p)) {
      s = s.slice(p.length).trim();
      // 法人格の後に空白区切りで法人名が続く場合は、その法人名も除く
      const sp = s.search(/\s/);
      if (sp > 0 && sp < s.length - 1) s = s.slice(sp + 1);
      break;
    }
  }
  return nfkc(s)
    .replace(/[・･\-‐―ー()（）「」『』]/g, "")
    .replace(/附属/g, "付属")
    .toLowerCase();
}

/** 片方の名前がもう片方を含む（例：「順天堂医院」と「順天堂大学医学部附属順天堂医院」） */
export function namesRelated(a: string, b: string): boolean {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 3 && long.includes(short);
}

const KANJI_DIGIT: Record<string, number> = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** 「二十三」→23 など、丁目・番地で使われる程度の漢数字を数字にする */
export function kanjiToNumber(s: string): string {
  return s.replace(/[〇一二三四五六七八九十百]+/g, (m) => {
    let total = 0;
    let current = 0;
    for (const ch of m) {
      if (ch === "百") {
        total += (current || 1) * 100;
        current = 0;
      } else if (ch === "十") {
        total += (current || 1) * 10;
        current = 0;
      } else current = current * 10 + KANJI_DIGIT[ch];
    }
    return String(total + current);
  });
}

/**
 * 住所の正規化。郵便番号・都道府県名・空白を除き、丁目／番地／番／号をハイフンにそろえる。
 * 例：「〒136-0075 東京都江東区新砂3丁目3番20号」→「江東区新砂3-3-20」
 */
export function normAddress(address: string): string {
  // 番地の後ろの空白・カンマ以降（建物名・階数）は、空白を詰める前に切り落とす
  const cut = address
    .normalize("NFKC")
    .replace(/〒?\s*\d{3}-?\d{4}/, "")
    .trim()
    .replace(/^(.*?[\d一二三四五六七八九十〇][号番地]?)[\s\u3000,、][\s\S]*$/, "$1");
  let s = nfkc(cut);
  for (const p of PREFECTURES) {
    if (s.startsWith(p.name)) {
      s = s.slice(p.name.length);
      break;
    }
  }
  s = s.replace(/([〇一二三四五六七八九十百]+)(?=丁目|番地|番|号|条|線)/g, (m) => kanjiToNumber(m));
  s = s
    .replace(/丁目|番地の?|番|の(?=\d)/g, "-")
    .replace(/号/g, "")
    .replace(/[‐―−ー－]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-$/, "");
  // 建物名など、番地より後ろは比較に使わない
  const m = s.match(/^(.*?\d+(?:-\d+)*)/);
  return (m ? m[1] : s).toLowerCase();
}

export function normPhone(phone?: string | null): string {
  return (phone ?? "").normalize("NFKC").replace(/\D/g, "");
}

/** 2点間の距離（メートル） */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// 政令指定都市（「市」の後に「区」が続く）
const DESIGNATED_CITIES = [
  "札幌市", "仙台市", "さいたま市", "千葉市", "横浜市", "川崎市", "相模原市", "新潟市", "静岡市", "浜松市",
  "名古屋市", "京都市", "大阪市", "堺市", "神戸市", "岡山市", "広島市", "北九州市", "福岡市", "熊本市",
];
// 名前の途中に「市」「町」「村」を含む市区町村（先に照合する）
const TRICKY_NAMES = [
  "四日市市", "廿日市市", "野々市市", "市川市", "市原市", "市貝町", "大町市", "町田市", "十日町市", "大村市", "東村山市",
  "武蔵村山市", "羽村市", "村上市", "村山市", "田村市", "西村山郡", "北村山郡", "東村山郡", "中新川郡",
];

/** 住所から市区町村名を取り出す（例：「名古屋市中区栄…」→「名古屋市中区」、「紫波郡矢巾町…」→「紫波郡矢巾町」） */
export function parseCity(address: string): string {
  let s = nfkc(address).replace(/〒?\d{3}-?\d{4}/, "");
  for (const p of PREFECTURES) {
    if (s.startsWith(p.name)) {
      s = s.slice(p.name.length);
      break;
    }
  }
  for (const t of TRICKY_NAMES) {
    if (s.startsWith(t)) {
      if (t.endsWith("郡")) {
        const rest = s.slice(t.length).match(/^(.+?[町村])/);
        return rest ? t + rest[1] : t;
      }
      return t;
    }
  }
  const gun = s.match(/^(.+?郡.+?[町村])/);
  if (gun && gun[1].length <= 10) return gun[1];
  for (const c of DESIGNATED_CITIES) {
    if (s.startsWith(c)) {
      const ward = s.slice(c.length).match(/^(.{1,4}?区)/);
      return ward ? c + ward[1] : c;
    }
  }
  const m = s.match(/^(.{1,6}?[市区町村])/);
  return m ? m[1] : "";
}

/** 住所から郵便番号を取り出す（無ければ undefined） */
export function parsePostal(address: string): string | undefined {
  const m = address.normalize("NFKC").match(/(\d{3})-?(\d{4})/);
  return m && /〒|^\s*\d{3}-?\d{4}/.test(address.normalize("NFKC")) ? `${m[1]}-${m[2]}` : undefined;
}
