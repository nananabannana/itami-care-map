import { describe, expect, it } from "vitest";
import { DEMO_FACILITIES } from "@/data/demo";
import { validateFacility } from "@/lib/integrity";
import { filtersToQuery, parseFilters, searchFacilities } from "@/lib/search";
import type { Facility } from "@/lib/types";

const ids = (r: { facility: Facility }[]) => r.map((x) => x.facility.id);

describe("デモデータ", () => {
  it("すべてデモであることが明記され、DB制約と同じルールを満たす", () => {
    for (const f of DEMO_FACILITIES) {
      expect(f.isDemo).toBe(true);
      expect(f.name).toContain("デモ");
      expect(f.address).toContain("デモ住所");
      expect(f.phone?.startsWith("000-")).toBe(true);
      expect(validateFacility(f)).toEqual([]);
    }
  });
});

describe("整合性チェック", () => {
  const base = DEMO_FACILITIES[0];
  it("確度Dの情報から「実施」を作れない", () => {
    const bad: Facility = {
      ...base,
      support: [{ ...base.support[0], evidenceStatus: "D" }],
    };
    expect(validateFacility(bad).join()).toMatch(/確度AまたはB/);
  });
  it("確度Aに直接確認の出典は使えない", () => {
    const bad: Facility = {
      ...base,
      support: [{ ...base.support[0], sourceId: "aoba-s2" }],
    };
    expect(validateFacility(bad).join()).toMatch(/公式サイトの出典/);
  });
});

describe("検索の並び順", () => {
  it("公式確認(A) → 直接確認(B) → 未確認 の順に並ぶ", () => {
    const r = searchFacilities(DEMO_FACILITIES, { procedure: "abortion" });
    const tiers = r.map((x) => x.tier);
    expect(tiers).toEqual([...tiers].sort());
    expect(r[0].facility.id).toBe("demo-aoba"); // A
    expect(r.find((x) => x.facility.id === "demo-minato")?.tier).toBe(2); // B
    // 中絶手術の情報がない病院は未確認として最後に表示（無痛分娩の対応は流用しない）
    expect(r.find((x) => x.facility.id === "demo-hikari")?.tier).toBe(4);
  });

  it("無痛分娩に対応していても、他の処置では対応扱いにならない", () => {
    const r = searchFacilities(DEMO_FACILITIES, { procedure: "endometrial-biopsy", pref: 23 });
    expect(r.find((x) => x.facility.id === "demo-hikari")?.tier).toBe(4);
  });

  it("「実施していない」と確認できた方法で検索すると除外される", () => {
    const r = searchFacilities(DEMO_FACILITIES, { procedure: "abortion", method: "general" });
    expect(ids(r)).not.toContain("demo-minato");
  });

  it("個別相談はティア3", () => {
    const r = searchFacilities(DEMO_FACILITIES, { procedure: "pelvic-exam" });
    expect(r.filter((x) => x.tier === 3).map((x) => x.facility.id).sort()).toEqual(["demo-sakura", "demo-umi"]);
  });

  it("公式確認済みのみ", () => {
    const r = searchFacilities(DEMO_FACILITIES, { procedure: "iud", evidence: ["A"] });
    expect(ids(r)).toEqual(["demo-sakura"]);
  });

  it("女性医師：対応なし・未確認は含まない", () => {
    const r = searchFacilities(DEMO_FACILITIES, { femaleDoctor: true });
    expect(ids(r)).not.toContain("demo-kita"); // no
    expect(ids(r)).not.toContain("demo-yodogawa"); // 未確認
    expect(ids(r)).toContain("demo-sakura");
  });

  it("都道府県・市区町村・キーワード", () => {
    expect(ids(searchFacilities(DEMO_FACILITIES, { pref: 23 })).length).toBe(4);
    expect(ids(searchFacilities(DEMO_FACILITIES, { pref: 23, city: "豊田市" }))).toEqual(["demo-hikari"]);
    expect(ids(searchFacilities(DEMO_FACILITIES, { q: "栄" }))).toEqual(["demo-aoba"]);
    expect(ids(searchFacilities(DEMO_FACILITIES, { q: "ＳＡＫＵＲＡ" }))).toEqual([]); // 名称はカタカナ・漢字のみ
  });
});

describe("クエリ変換", () => {
  it("往復で同じ条件になる", () => {
    const f = parseFilters({ pref: "23", procedure: "abortion", female_doctor: "1", evidence: ["A", "B", "Z"] });
    expect(f).toMatchObject({ pref: 23, procedure: "abortion", femaleDoctor: true, evidence: ["A", "B"] });
    const q = new URLSearchParams(filtersToQuery(f));
    expect(parseFilters({ ...Object.fromEntries(q), evidence: q.getAll("evidence") })).toEqual(f);
  });
  it("不正な都道府県は無視", () => {
    expect(parseFilters({ pref: "99" }).pref).toBeUndefined();
  });
});
