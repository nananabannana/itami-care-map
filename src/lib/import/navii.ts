/**
 * 医療情報ネット（ナビイ）オープンデータの取り込み
 *
 * ファイル（2026年6月1日時点の名称）
 *   01-1_hospital_facility_info_YYYYMMDD.csv   病院（施設票）
 *   01-2_hospital_speciality_hours_YYYYMMDD.csv 病院（診療科・診療時間票）
 *   02-1_clinic_facility_info_YYYYMMDD.csv     診療所（施設票）
 *   02-2_clinic_speciality_hours_YYYYMMDD.csv  診療所（診療科・診療時間票）
 *
 * 列名は「医療情報ネット_オープンデータ定義書（利用者向け）令和6年度 v1.0」による。
 * 電話番号・郵便番号の列は無い（未確認として扱う）。
 */
import { columnIndex, parseCsv } from "./csv";
import { parseCity, parsePostal } from "./normalize";

export type NaviiKind = "hospital" | "clinic";
export type NaviiTable = "facility" | "speciality";

/** 婦人科・産婦人科・産科（例：「産婦人科」「婦人科」「産科」「婦人科（不妊治療）」） */
export const GYN_PATTERN = /産婦人科|婦人科|産科/;

export const FACILITY_COLUMNS = [
  "ID",
  "正式名称",
  "正式名称（フリガナ）",
  "機関区分",
  "都道府県コード",
  "市区町村コード",
  "所在地",
  "所在地座標（緯度）",
  "所在地座標（経度）",
  "案内用ホームページアドレス",
] as const;

const DAYS = ["月", "火", "水", "木", "金", "土", "日", "祝"] as const;
export const SPECIALITY_COLUMNS = [
  "ID",
  "診療科目名",
  ...DAYS.flatMap((d) => [`${d}_診療開始時間`, `${d}_診療終了時間`] as const),
] as const;

export interface NaviiRecord {
  naviiKey: string; // 'clinic:1234567890'
  kind: NaviiKind;
  name: string;
  nameKana?: string;
  prefectureCode: number;
  municipalityCode?: string;
  city: string;
  address: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  websiteUrl?: string;
  departments: string[];
  consultationHours?: string;
  dataSource: string;
  dataDate?: string; // YYYY-MM-DD
}

/** ファイル名から種別・票・基準日を推定する */
export function detectNaviiFile(fileName: string): { kind?: NaviiKind; table?: NaviiTable; dataDate?: string } {
  const n = fileName.toLowerCase();
  const kind: NaviiKind | undefined = n.includes("hospital") || n.includes("病院") ? "hospital" : n.includes("clinic") || n.includes("診療所") ? "clinic" : undefined;
  const table: NaviiTable | undefined =
    n.includes("speciality") || n.includes("specialty") || n.includes("診療科") ? "speciality" : n.includes("facility") || n.includes("施設") ? "facility" : undefined;
  const d = n.match(/(20\d{2})(\d{2})(\d{2})/);
  return { kind, table, dataDate: d ? `${d[1]}-${d[2]}-${d[3]}` : undefined };
}

export interface SpecialityInfo {
  departments: Set<string>;
  hasGyn: boolean;
  /** 婦人科系の診療科の時間帯（曜日 → 「9:00-12:00」の集合） */
  gynHours: Map<string, Set<string>>;
}

const trimTime = (t: string) => t.trim().replace(/^0(\d):/, "$1:");

/** ヘッダーを先に読み、列番号を決めてから本体を読む汎用ヘルパー */
function readWithHeader<T extends string>(
  text: string,
  columns: readonly T[],
  onRow: (row: string[], idx: Record<T, number>) => void,
): { rows: number; missing: T[]; header: string[] } {
  const firstLineEnd = text.search(/\r?\n/);
  const headerLine = firstLineEnd < 0 ? text : text.slice(0, firstLineEnd);
  const header = parseCsv(headerLine + "\n", () => {});
  const { idx, missing } = columnIndex(header, columns);
  let rows = 0;
  if (missing.length === 0) parseCsv(text, (row) => (rows++, onRow(row, idx)));
  return { rows, missing, header };
}

/** 診療科・診療時間票を読み、ID ごとの診療科と婦人科系の診療時間をまとめる */
export function readSpecialityTable(text: string, into = new Map<string, SpecialityInfo>()) {
  const res = readWithHeader(text, SPECIALITY_COLUMNS, (row, idx) => {
    const id = row[idx.ID]?.trim();
    const dept = row[idx["診療科目名"]]?.trim();
    if (!id || !dept) return;
    let info = into.get(id);
    if (!info) {
      info = { departments: new Set(), hasGyn: false, gynHours: new Map() };
      into.set(id, info);
    }
    info.departments.add(dept);
    if (GYN_PATTERN.test(dept)) {
      info.hasGyn = true;
      for (const d of DAYS) {
        const s = row[idx[`${d}_診療開始時間`]];
        const e = row[idx[`${d}_診療終了時間`]];
        if (s?.trim() && e?.trim()) {
          const set = info.gynHours.get(d) ?? new Set<string>();
          set.add(`${trimTime(s)}-${trimTime(e)}`);
          info.gynHours.set(d, set);
        }
      }
    }
  });
  return { map: into, rows: res.rows, missing: res.missing as string[] };
}

/** 「月 9:00-12:00, 14:00-18:00／火 …」の形にまとめる（婦人科系の診療科） */
export function summarizeHours(gynHours: Map<string, Set<string>>): string | undefined {
  const parts: string[] = [];
  for (const d of DAYS) {
    const set = gynHours.get(d);
    if (set?.size) parts.push(`${d} ${[...set].sort().join(", ")}`);
  }
  return parts.length ? parts.join("／") : undefined;
}

const toNum = (s?: string) => {
  const n = Number((s ?? "").trim());
  return s?.trim() && Number.isFinite(n) && n !== 0 ? n : undefined;
};

function normalizeUrl(u?: string): string | undefined {
  const s = (u ?? "").trim().normalize("NFKC");
  if (!s) return undefined;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s)) return `https://${s}`;
  return undefined; // URL として解釈できないものは入れない
}

const KIND_LABEL: Record<NaviiKind, string> = { hospital: "病院", clinic: "診療所" };

/** 施設票を読み、婦人科系の診療科がある施設だけを NaviiRecord にする */
export function readFacilityTable(
  text: string,
  kind: NaviiKind,
  specialities: Map<string, SpecialityInfo>,
  dataDate?: string,
) {
  const records: NaviiRecord[] = [];
  const errors: string[] = [];
  const res = readWithHeader(text, FACILITY_COLUMNS, (row, idx) => {
    const id = row[idx.ID]?.trim();
    if (!id) return;
    const sp = specialities.get(id);
    if (!sp?.hasGyn) return;
    const name = row[idx["正式名称"]]?.trim();
    const pref = Number(row[idx["都道府県コード"]]);
    const address = row[idx["所在地"]]?.trim();
    if (!name || !address || !(pref >= 1 && pref <= 47)) {
      errors.push(`ID ${id}：名称・所在地・都道府県コードのいずれかが空または不正です`);
      return;
    }
    const cityCode = row[idx["市区町村コード"]]?.trim();
    records.push({
      naviiKey: `${kind}:${id}`,
      kind,
      name,
      nameKana: row[idx["正式名称（フリガナ）"]]?.trim() || undefined,
      prefectureCode: pref,
      municipalityCode: cityCode ? `${String(pref).padStart(2, "0")}${cityCode.padStart(3, "0")}` : undefined,
      city: parseCity(address),
      address,
      postalCode: parsePostal(address),
      latitude: toNum(row[idx["所在地座標（緯度）"]]),
      longitude: toNum(row[idx["所在地座標（経度）"]]),
      websiteUrl: normalizeUrl(row[idx["案内用ホームページアドレス"]]),
      departments: [...sp.departments].sort((a, b) => a.localeCompare(b, "ja")),
      consultationHours: summarizeHours(sp.gynHours),
      dataSource: `医療情報ネット オープンデータ（${KIND_LABEL[kind]}・施設票／診療科・診療時間票）`,
      dataDate,
    });
  });
  return { records, errors, rows: res.rows, missing: res.missing as string[] };
}
