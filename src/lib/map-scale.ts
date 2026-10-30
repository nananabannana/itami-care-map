import type { RegionKey } from "./types";

/** 都道府県の検索結果URL（地図・一覧・地域別検索で共通） */
export const prefHref = (code: number) => `/search?pref=${code}`;

/** 掲載件数の段階（色だけでなく凡例に数値を併記する） */
export const COUNT_BINS: { min: number; max: number | null; label: string; fill: string }[] = [
  { min: 0, max: 0, label: "0件", fill: "#f3f0f9" },
  { min: 1, max: 1, label: "1件", fill: "#dcd2ef" },
  { min: 2, max: 4, label: "2〜4件", fill: "#c1b1e1" },
  { min: 5, max: 9, label: "5〜9件", fill: "#a08ccd" },
  { min: 10, max: null, label: "10件以上", fill: "#8170b4" },
];

export function binOf(count: number) {
  return COUNT_BINS.find((b) => count >= b.min && (b.max === null || count <= b.max)) ?? COUNT_BINS[0];
}

/** 地域ごとの淡い色（地域別の色分け用） */
export const REGION_FILL: Record<RegionKey, string> = {
  hokkaido_tohoku: "#d5e3f3",
  kanto: "#e9d6ee",
  chubu: "#d8eadb",
  kinki: "#f3e3cc",
  chugoku_shikoku: "#d4e9ec",
  kyushu_okinawa: "#f2d6dc",
};

/** 選択中（ホバー・フォーカス）の色 */
export const ACTIVE_FILL = "#4b3c7a";
/** 境界線 */
export const BORDER = "#7b6ba6";
