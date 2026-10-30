/**
 * 都道府県SVGパスの生成スクリプト
 *
 *   node scripts/build-japan-map.mjs
 *
 * 入力：jpn-atlas（国土地理院「地球地図日本」2016 をもとにした TopoJSON。投影済み 850x680）
 * 出力：src/data/japan-map.ts
 *
 * 加工内容
 *  - 線を簡略化（境界は共有したまま）
 *  - ごく小さな島を除外（クリック対象にならず、描画を重くするだけのため）
 *  - 東京都の小笠原諸島・南鳥島など本土から遠い島は除外（地図の範囲が大きく広がるため）
 *  - 鹿児島県の奄美群島は除外（地図の範囲が南に大きく広がるため）
 *  - 沖縄県は本島周辺を左上の枠内に拡大して配置（全国地図で一般的な表現）
 *  ※ 除外した島も都道府県としての検索対象には含まれる（地図の描画上の省略のみ）
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { presimplify, simplify, planarTriangleArea } from "topojson-simplify";
import { geoPath, geoIdentity } from "d3-geo";

const require = createRequire(import.meta.url);
const topo = structuredClone(require("jpn-atlas/japan/japan.json"));

// ---- 設定 ---------------------------------------------------------------
const SIMPLIFY_MIN_WEIGHT = 0.06; // 平方px。大きいほど粗くなる
const MIN_ISLAND_AREA = 1.2; // これ未満の島は除外（都道府県で最大のポリゴンは常に残す）
const TOKYO_MAX_Y = 345; // 東京都はこのyより南の島を除外（伊豆大島付近まで残す）
const KAGOSHIMA_MAX_Y = 500; // 鹿児島県はこのyより南（奄美群島など）を除外。種子島・屋久島は残す
const OKINAWA_RADIUS = 30; // 沖縄本島の重心からこの距離内の島だけ残す（先島・大東諸島は除外）
const OKINAWA_INSET = { x: 200, y: 60, scale: 2.4 }; // 沖縄の移動先（左上）と倍率
const PAD = 8;

// ---- 簡略化 -------------------------------------------------------------
const simplified = simplify(presimplify(topo, planarTriangleArea), SIMPLIFY_MIN_WEIGHT);
const features = feature(simplified, simplified.objects.prefectures).features;
const plain = geoPath();

function polygonsOf(geom) {
  return geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];
}

function filterPolygons(code, geom) {
  const polys = polygonsOf(geom);
  const withArea = polys.map((c) => ({ c, area: plain.area({ type: "Polygon", coordinates: c }) }));
  const maxArea = Math.max(...withArea.map((p) => p.area));
  return withArea
    .filter(({ c, area }) => {
      if (area === maxArea) return true;
      if (area < MIN_ISLAND_AREA) return false;
      const [cx, cy] = plain.centroid({ type: "Polygon", coordinates: c });
      if (code === 13 && cy > TOKYO_MAX_Y) return false;
      if (code === 46 && cy > KAGOSHIMA_MAX_Y) return false;
      if (code === 47) {
        const main = withArea.find((p) => p.area === maxArea).c;
        const [mx, my] = plain.centroid({ type: "Polygon", coordinates: main });
        if (Math.hypot(cx - mx, cy - my) > OKINAWA_RADIUS) return false;
      }
      return true;
    })
    .map((p) => p.c);
}

const transformRing = (ring, fn) => ring.map(([x, y]) => fn(x, y));

const prepared = features.map((f) => {
  const code = Number(f.id);
  let polys = filterPolygons(code, f.geometry);
  if (code === 47) {
    const b = plain.bounds({ type: "MultiPolygon", coordinates: polys });
    const { x, y, scale } = OKINAWA_INSET;
    polys = polys.map((poly) =>
      poly.map((ring) => transformRing(ring, (px, py) => [x + (px - b[0][0]) * scale, y + (py - b[0][1]) * scale])),
    );
  }
  return { code, geometry: { type: "MultiPolygon", coordinates: polys } };
});

// ---- 表示範囲 -------------------------------------------------------------
const all = { type: "FeatureCollection", features: prepared.map((p) => ({ type: "Feature", geometry: p.geometry })) };
const [[minX, minY], [maxX, maxY]] = plain.bounds(all);
const ox = minX - PAD;
const oy = minY - PAD;
const width = Math.ceil(maxX - minX + PAD * 2);
const height = Math.ceil(maxY - minY + PAD * 2);

// 原点を (0,0) に合わせ、小数1桁に丸めて出力
const shift = geoIdentity().translate([-ox, -oy]);
const out = geoPath(shift).digits(1);

const r1 = (n) => Math.round(n * 10) / 10;

const prefectures = prepared
  .sort((a, b) => a.code - b.code)
  .map(({ code, geometry }) => {
    const feat = { type: "Feature", geometry };
    const [[x0, y0], [x1, y1]] = out.bounds(feat);
    // ラベル位置：最大ポリゴンの重心（本土側に置くため）
    const largest = geometry.coordinates
      .map((c) => ({ c, a: plain.area({ type: "Polygon", coordinates: c }) }))
      .sort((a, b) => b.a - a.a)[0].c;
    const [cx, cy] = out.centroid({ type: "Polygon", coordinates: largest });
    return {
      code,
      d: out(feat),
      bbox: [r1(x0), r1(y0), r1(x1), r1(y1)],
      label: [r1(cx), r1(cy)],
    };
  });

// 沖縄インセットの枠
const oki = prefectures.find((p) => p.code === 47).bbox;
const okinawaFrame = [r1(oki[0] - 10), r1(oki[1] - 10), r1(oki[2] - oki[0] + 20), r1(oki[3] - oki[1] + 20)];

const ts = `/* 自動生成ファイル：scripts/build-japan-map.mjs で生成。手で編集しないこと。
 * 出典：地球地図日本（国土地理院）https://www.gsi.go.jp/kankyochiri/gm_jpn.html
 *       jpn-atlas（BSD-3-Clause）を加工して作成
 */
export interface PrefectureShape {
  /** 都道府県コード（1〜47） */
  code: number;
  /** SVG path */
  d: string;
  /** [minX, minY, maxX, maxY] */
  bbox: [number, number, number, number];
  /** 件数ラベルの位置 */
  label: [number, number];
}

export const MAP_WIDTH = ${width};
export const MAP_HEIGHT = ${height};
/** 沖縄県インセット枠 [x, y, width, height] */
export const OKINAWA_FRAME: [number, number, number, number] = ${JSON.stringify(okinawaFrame)};

export const PREFECTURE_SHAPES: PrefectureShape[] = ${JSON.stringify(prefectures)};
`;

writeFileSync(new URL("../src/data/japan-map.ts", import.meta.url), ts);
console.log(`viewBox 0 0 ${width} ${height}, ${prefectures.length} prefectures, ${(ts.length / 1024).toFixed(1)} KB`);
