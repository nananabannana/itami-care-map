import { describe, expect, it } from "vitest";
import { validateFacility } from "@/lib/integrity";
import { rowToFacility, type FacilityRow } from "@/lib/supabase-repository";

const row: FacilityRow = {
  slug: "demo-row",
  name: "デモ・テスト婦人科",
  prefecture_code: 23,
  address: "愛知県名古屋市中区（デモ住所）",
  phone: null,
  website_url: "https://example.com/demo/row",
  latitude: null,
  longitude: null,
  facility_type: "clinic",
  departments: ["婦人科"],
  nearest_stations: [],
  consultation_hours: null,
  is_demo: true,
  municipalities: { name: "名古屋市中区" },
  sources: [
    { id: "s1", source_type: "official_site", source_url: "https://example.com/demo/row/a", source_title: "麻酔について", evidence_excerpt: null, contacted_department: null, checked_at: "2026-10-01" },
    { id: "s2", source_type: "public_registry", source_url: "https://www.iryou.teikyouseido.mhlw.go.jp/", source_title: "ナビイ", evidence_excerpt: null, contacted_department: null, checked_at: "2026-10-01" },
  ],
  facility_procedure_support: [
    { support_status: "available", conditions: null, schedule_note: null, extra_fee: "unknown", extra_fee_note: null, notes: null, evidence_status: "A", source_id: "s1", verified_at: "2026-10-01", procedures: { slug: "abortion" }, anesthesia_methods: { slug: "iv-anesthesia" } },
  ],
  facility_care_items: [
    { care_item: "female_doctor_available", status: "yes", note: null, evidence_status: "A", source_id: "s1", verified_at: "2026-10-01" },
  ],
};

describe("Supabaseの行 → Facility", () => {
  it("slugをIDにし、nullをundefinedにして、整合性ルールを満たす", () => {
    const f = rowToFacility(row);
    expect(f.id).toBe("demo-row");
    expect(f.city).toBe("名古屋市中区");
    expect(f.phone).toBeUndefined();
    expect(f.basicInfoSourceId).toBe("s2");
    expect(f.support[0]).toMatchObject({ procedureSlug: "abortion", methodSlug: "iv-anesthesia", evidenceStatus: "A" });
    expect(validateFacility(f)).toEqual([]);
  });
});
