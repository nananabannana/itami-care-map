"use client";

import { useId, useState } from "react";
import { PREFECTURES, REGIONS } from "@/lib/master";

const selectClass =
  "block min-h-12 w-full rounded-lg border border-line bg-white px-3 text-base text-ink disabled:bg-mist disabled:text-ink-muted";

/** 都道府県 → 市区町村 の連動セレクト。JSが無効でも都道府県だけで検索できる */
export function PrefCitySelect({
  citiesByPref,
  defaultPref,
  defaultCity,
}: {
  citiesByPref: Record<number, string[]>;
  defaultPref?: number;
  defaultCity?: string;
}) {
  const [pref, setPref] = useState<string>(defaultPref ? String(defaultPref) : "");
  const id = useId();
  const cities = pref ? (citiesByPref[Number(pref)] ?? []) : [];

  return (
    <>
      <div>
        <label htmlFor={`${id}-pref`} className="mb-1 block text-sm font-semibold">
          都道府県
        </label>
        <select
          id={`${id}-pref`}
          name="pref"
          value={pref}
          onChange={(e) => setPref(e.target.value)}
          className={selectClass}
        >
          <option value="">全国</option>
          {REGIONS.map((r) => (
            <optgroup key={r.key} label={r.name}>
              {PREFECTURES.filter((p) => p.region === r.key).map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-city`} className="mb-1 block text-sm font-semibold">
          市区町村
        </label>
        <select
          id={`${id}-city`}
          name="city"
          key={pref}
          defaultValue={cities.includes(defaultCity ?? "") ? defaultCity : ""}
          disabled={!pref || cities.length === 0}
          aria-describedby={`${id}-city-hint`}
          className={selectClass}
        >
          <option value="">{pref ? "すべての市区町村" : "先に都道府県を選択"}</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <p id={`${id}-city-hint`} className="sr-only">
          掲載のある市区町村のみ表示します
        </p>
      </div>
    </>
  );
}
