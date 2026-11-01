import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { decodeText, extractCsvFiles, parseCsv } from "@/lib/import/csv";
import { jalaListUrl, parseJalaListPage } from "@/lib/import/jala";
import { findMatch, planNaviiImport, summarizePlan, type IndexEntry } from "@/lib/import/match";
import { detectNaviiFile, FACILITY_COLUMNS, readFacilityTable, readSpecialityTable, SPECIALITY_COLUMNS } from "@/lib/import/navii";
import { namesRelated, normAddress, normName, parseCity } from "@/lib/import/normalize";

// 定義書どおりの列（実ファイルは休診日・病床数などの列がもっとあるが、列名で探すので順番・余分な列は問わない）
const facilityHeader = [...FACILITY_COLUMNS.slice(0, 3), "略称", ...FACILITY_COLUMNS.slice(3), "合計病床数"];
const specialityHeader = [SPECIALITY_COLUMNS[0], "診療科目コード", ...SPECIALITY_COLUMNS.slice(1), "診療時間帯"];
const csv = (header: string[], rows: Record<string, string>[]) =>
  "﻿" + [header.join(","), ...rows.map((r) => header.map((h) => (r[h] ?? "").includes(",") ? `"${r[h]}"` : (r[h] ?? "")).join(","))].join("\r\n") + "\r\n";

const facilityCsv = csv(facilityHeader, [
  { ID: "1310000001", 正式名称: "医療法人社団テスト会　テストレディースクリニック", 機関区分: "2", 都道府県コード: "13", 市区町村コード: "113", 所在地: "東京都渋谷区神南一丁目2番3号", "所在地座標（緯度）": "35.66", "所在地座標（経度）": "139.70", 案内用ホームページアドレス: "www.example.com/test" },
  { ID: "1310000002", 正式名称: "テスト眼科", 機関区分: "2", 都道府県コード: "13", 市区町村コード: "113", 所在地: "東京都渋谷区神南1-1" },
  { ID: "2310000003", 正式名称: "名古屋テスト産科医院", 機関区分: "2", 都道府県コード: "23", 市区町村コード: "106", 所在地: "愛知県名古屋市中区栄3-4-5, 2F", 案内用ホームページアドレス: "なし" },
  { ID: "1310000004", 正式名称: "浜田病院", 機関区分: "2", 都道府県コード: "13", 市区町村コード: "101", 所在地: "東京都千代田区神田駿河台二丁目5番1号" },
]);
const specialityCsv = csv(specialityHeader, [
  { ID: "1310000001", 診療科目名: "婦人科", 月_診療開始時間: "09:00", 月_診療終了時間: "12:00" },
  { ID: "1310000001", 診療科目名: "婦人科", 月_診療開始時間: "14:00", 月_診療終了時間: "18:00", 土_診療開始時間: "09:00", 土_診療終了時間: "13:00" },
  { ID: "1310000001", 診療科目名: "内科" },
  { ID: "1310000002", 診療科目名: "眼科", 月_診療開始時間: "09:00", 月_診療終了時間: "12:00" },
  { ID: "2310000003", 診療科目名: "産科" },
  { ID: "1310000004", 診療科目名: "産婦人科" },
]);

describe("CSV", () => {
  it("UTF-8 BOM を除き、クォート内のカンマ・改行・二重引用符を扱う", () => {
    const { text, encoding } = decodeText(strToU8('﻿a,b\r\n"x, y","say ""hi""\nnext"\r\n'));
    expect(encoding).toBe("utf-8");
    const rows: string[][] = [];
    expect(parseCsv(text, (r) => rows.push(r))).toEqual(["a", "b"]);
    expect(rows).toEqual([["x, y", 'say "hi"\nnext']]);
  });
  it("ZIP の中の CSV を取り出す", () => {
    const zip = zipSync({ "02-1_clinic_facility_info_20260601.csv": strToU8("a\n1\n"), "readme.txt": strToU8("x") });
    expect(extractCsvFiles("x.zip", zip).map((f) => f.name)).toEqual(["02-1_clinic_facility_info_20260601.csv"]);
  });
  it("ファイル名から種別・票・基準日を判定", () => {
    expect(detectNaviiFile("02-2_clinic_speciality_hours_20260601.csv")).toEqual({ kind: "clinic", table: "speciality", dataDate: "2026-06-01" });
    expect(detectNaviiFile("01-1_hospital_facility_info_20251201.csv")).toMatchObject({ kind: "hospital", table: "facility" });
  });
});

describe("ナビイの読み取り", () => {
  const { map } = readSpecialityTable(decodeText(strToU8(specialityCsv)).text);
  const { records, missing, errors } = readFacilityTable(decodeText(strToU8(facilityCsv)).text, "clinic", map, "2026-06-01");

  it("婦人科・産婦人科・産科のある施設だけを抽出する", () => {
    expect(missing).toEqual([]);
    expect(errors).toEqual([]);
    expect(records.map((r) => r.naviiKey)).toEqual(["clinic:1310000001", "clinic:2310000003", "clinic:1310000004"]);
  });
  it("基本情報・診療科・診療時間・データ取得元をまとめる", () => {
    const r = records[0];
    expect(r).toMatchObject({
      prefectureCode: 13,
      municipalityCode: "13113",
      city: "渋谷区",
      latitude: 35.66,
      websiteUrl: "https://www.example.com/test",
      departments: ["内科", "婦人科"],
      consultationHours: "月 14:00-18:00, 9:00-12:00／土 9:00-13:00",
      dataDate: "2026-06-01",
    });
    expect(r.dataSource).toContain("医療情報ネット");
    expect(r.postalCode).toBeUndefined(); // ナビイに郵便番号は無い
    expect(records[1].websiteUrl).toBeUndefined(); // 「なし」はURLとして入れない
    expect(records[1].city).toBe("名古屋市中区");
  });
  it("必須の列が無いときは読み込まずに列名を返す", () => {
    const bad = readFacilityTable("ID,名称\n1,x\n", "clinic", map);
    expect(bad.records).toEqual([]);
    expect(bad.missing).toContain("正式名称");
  });
});

describe("正規化", () => {
  it("住所：郵便番号・都道府県・丁目番地号・漢数字・建物名", () => {
    expect(normAddress("〒136-0075 東京都江東区新砂3丁目3番20号")).toBe("江東区新砂3-3-20");
    expect(normAddress("東京都江東区新砂3-3-20 2階")).toBe("江東区新砂3-3-20");
    expect(normAddress("岩手県紫波郡矢巾町医大通二丁目1番1号")).toBe(normAddress("〒028-3695 岩手県紫波郡矢巾町医大通2-1-1"));
  });
  it("名前：法人格と法人名を除いて比較", () => {
    expect(normName("医療法人社団ワンアンドオンリー　新横浜母と子の病院")).toBe("新横浜母と子の病院");
    expect(namesRelated("順天堂大学医学部附属 順天堂医院", "順天堂医院")).toBe(true);
    expect(namesRelated("浜田病院", "山王病院")).toBe(false);
  });
  it("市区町村", () => {
    expect(parseCity("東京都江東区新砂3-3-20")).toBe("江東区");
    expect(parseCity("岩手県紫波郡矢巾町医大通2-1-1")).toBe("紫波郡矢巾町");
    expect(parseCity("千葉県市川市八幡1-1")).toBe("市川市");
    expect(parseCity("三重県四日市市諏訪町1-1")).toBe("四日市市");
    expect(parseCity("大阪府大阪市中央区法円坂2-1-14")).toBe("大阪市中央区");
    expect(parseCity("京都府長岡京市下海印寺下内田101")).toBe("長岡京市");
  });
});

describe("重複判定", () => {
  const index: IndexEntry[] = [
    { id: "f-hamada", type: "facility", name: "浜田病院", prefectureCode: 13, address: "〒101-0062 東京都千代田区神田駿河台2-5-1", phone: "03-5280-1166" },
    { id: "c-1", type: "candidate", naviiKey: "clinic:1310000001", name: "医療法人社団テスト会　テストレディースクリニック", prefectureCode: 13, address: "東京都渋谷区神南一丁目2番3号", websiteUrl: null, departments: ["婦人科"] },
  ];
  const { map } = readSpecialityTable(decodeText(strToU8(specialityCsv)).text);
  const { records } = readFacilityTable(decodeText(strToU8(facilityCsv)).text, "clinic", map, "2026-06-01");

  it("既存の掲載施設とは新規にせず「既存施設と一致」、同じIDの候補は更新候補にする", () => {
    const plan = planNaviiImport(records, index);
    const byKey = Object.fromEntries(plan.map((p) => [p.record.naviiKey, p]));
    expect(byKey["clinic:1310000004"]).toMatchObject({ action: "facility_match", kind: "address_name" });
    expect(byKey["clinic:1310000001"]).toMatchObject({ action: "update_candidate" });
    expect(byKey["clinic:2310000003"].action).toBe("new");
    expect(summarizePlan(plan)).toMatchObject({ new: 1, update_candidate: 1, facility_match: 1 });
  });
  it("取り込み側が空の項目では上書きしない（差分に出さない）", () => {
    const plan = planNaviiImport(records, index);
    const hamada = plan.find((p) => p.record.naviiKey === "clinic:1310000004");
    expect(hamada && "changes" in hamada ? Object.keys(hamada.changes) : []).not.toContain("website_url");
  });
  it("電話番号の一致（JALA）", () => {
    const m = findMatch({ name: "医療法人小畑会 浜田病院", prefectureCode: 13, address: "東京都千代田区神田駿河台２－５－１", phone: "03(5280)1166" }, index);
    expect(m?.kind).toBe("phone");
  });
  it("同じファイル内の重複", () => {
    const plan = planNaviiImport([records[2], { ...records[2], naviiKey: "hospital:9" }], []);
    expect(plan.map((p) => p.action)).toEqual(["new", "duplicate_in_file"]);
  });
});

describe("JALA 一覧ページ", () => {
  const html = `
    <ul class="list">
      <li><h3><a href="https://www.jalasite.org/hp/10160.html">医療法人社団ワンアンドオンリー　新横浜母と子の病院</a></h3>
        <p>郵便番号：222-0035<br>住所：神奈川県横浜市港北区鳥山町650-1</p>
        <p>URL：<a href="https://www.hahatoko.jp/">https://www.hahatoko.jp/hospital/painless/</a><br>電話番号：045-472-2911</p>
        <a href="/hp/10160.html">詳細</a></li>
      <li><h3><a href="/hp/10163.html">一般財団法人神奈川県警友会けいゆう病院</a></h3>
        <dl><dt>郵便番号</dt><dd>220-8521</dd><dt>住所</dt><dd>神奈川県横浜市西区みなとみらい3-7-3</dd>
        <dt>URL</dt><dd>http://www.keiyu-hospital.com/</dd><dt>電話番号</dt><dd>045-221-8181</dd></dl></li>
    </ul>`;
  it("名称・郵便番号・住所・URL・電話・JALAページURLを読み取る（2つの書式）", () => {
    expect(parseJalaListPage(html, 14)).toEqual([
      { jalaId: "10160", name: "医療法人社団ワンアンドオンリー 新横浜母と子の病院", prefectureCode: 14, postalCode: "222-0035", address: "神奈川県横浜市港北区鳥山町650-1", phone: "045-472-2911", websiteUrl: "https://www.hahatoko.jp/hospital/painless/", jalaUrl: "https://www.jalasite.org/hp/10160.html" },
      { jalaId: "10163", name: "一般財団法人神奈川県警友会けいゆう病院", prefectureCode: 14, postalCode: "220-8521", address: "神奈川県横浜市西区みなとみらい3-7-3", phone: "045-221-8181", websiteUrl: "http://www.keiyu-hospital.com/", jalaUrl: "https://www.jalasite.org/hp/10163.html" },
    ]);
  });
  it("一覧ページのURL（地方番号）", () => {
    expect(jalaListUrl(14)).toBe("https://www.jalasite.org/area/3_14_all");
    expect(jalaListUrl(23)).toBe("https://www.jalasite.org/area/5_23_all");
    expect(jalaListUrl(47)).toBe("https://www.jalasite.org/area/9_47_all");
    expect(jalaListUrl(3)).toBe("https://www.jalasite.org/area/2_3_all");
  });
});
