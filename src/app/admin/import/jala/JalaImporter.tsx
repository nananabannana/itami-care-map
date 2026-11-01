"use client";

import { useRef, useState } from "react";
import { JALA_INTERVAL_MS, type JalaRecord } from "@/lib/import/jala";
import { findMatch, type IndexEntry, type MatchKind } from "@/lib/import/match";
import { MATCH_KIND } from "@/lib/candidate-labels";
import { prefByCode, PREFECTURES, REGIONS } from "@/lib/master";
import { commitJalaRecords, createImportBatch, fetchJalaPrefecture, getJalaExisting, getMatchIndex } from "../actions";

const CHUNK = 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Row {
  rec: JalaRecord;
  state: "new" | "update" | "same";
  match?: { name: string; type: "facility" | "candidate"; kind: MatchKind };
}

export function JalaImporter({ today }: { today: string }) {
  const [prefs, setPrefs] = useState<Set<number>>(new Set());
  const [log, setLog] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const stop = useRef(false);

  const togglePref = (code: number) => setPrefs((s) => {
    const n = new Set(s);
    if (n.has(code)) n.delete(code);
    else n.add(code);
    return n;
  });

  async function fetchAll() {
    setError(null);
    setResult(null);
    setRows(null);
    stop.current = false;
    const list = [...prefs].sort((a, b) => a - b);
    const got: JalaRecord[] = [];
    const lines: string[] = [];
    for (let i = 0; i < list.length; i++) {
      if (stop.current) {
        lines.push("中止しました。");
        break;
      }
      const p = list[i];
      setBusy(`JALAの一覧ページを取得しています… ${i + 1} / ${list.length}（${prefByCode(p)?.name}）`);
      const r = await fetchJalaPrefecture(p);
      if (!r.ok) {
        lines.push(`${prefByCode(p)?.name}：取得できませんでした（${r.message}）`);
      } else {
        lines.push(`${prefByCode(p)?.name}：${r.data.records.length}件（${r.data.url}）`);
        got.push(...r.data.records);
      }
      setLog([...lines]);
      if (i < list.length - 1) await sleep(JALA_INTERVAL_MS); // サイトに負担をかけないよう間隔をあける
    }
    if (!got.length) {
      setBusy(null);
      return;
    }
    setBusy("既存の施設・候補と照合しています…（保存はしません）");
    const fetchedPrefs = [...new Set(got.map((g) => g.prefectureCode))];
    const [idx, existing] = await Promise.all([getMatchIndex(fetchedPrefs), getJalaExisting(fetchedPrefs)]);
    setBusy(null);
    if (!idx.ok) return setError(idx.message);
    if (!existing.ok) return setError(existing.message);
    const ex = new Map(existing.data.map((e) => [e.jala_id, e]));
    const index: IndexEntry[] = idx.data;
    setRows(
      got.map((rec) => {
        const m = findMatch({ name: rec.name, prefectureCode: rec.prefectureCode, address: rec.address, phone: rec.phone }, index);
        const prev = ex.get(rec.jalaId);
        const state: Row["state"] = !prev ? "new" : prev.name === rec.name && prev.address === rec.address && prev.phone === (rec.phone ?? null) && prev.website_url === (rec.websiteUrl ?? null) ? "same" : "update";
        return { rec, state, match: m ? { name: m.target.name, type: m.target.type, kind: m.kind } : undefined };
      }),
    );
  }

  async function commit() {
    if (!rows) return;
    setError(null);
    const fetchedPrefs = [...new Set(rows.map((r) => r.rec.prefectureCode))].sort((a, b) => a - b);
    const batch = await createImportBatch({
      source: "jala",
      label: `JALA取り込み：${fetchedPrefs.length}都道府県`,
      dataDate: today,
      fileNames: [],
      summary: {
        fetched: rows.length,
        new: rows.filter((r) => r.state === "new").length,
        update_candidate: rows.filter((r) => r.state === "update").length,
        unchanged: rows.filter((r) => r.state === "same").length,
        prefectures: fetchedPrefs.length,
      },
    });
    if (!batch.ok) return setError(batch.message);
    const send = rows.filter((r) => r.state !== "same").map((r) => r.rec);
    const total = { inserted: 0, updated: 0, matchedFacilities: 0, matchedCandidates: 0, rejected: 0 };
    for (let i = 0; i < send.length; i += CHUNK) {
      setBusy(`保存しています… ${Math.min(i + CHUNK, send.length)} / ${send.length}件`);
      const r = await commitJalaRecords(batch.data, send.slice(i, i + CHUNK), today);
      if (!r.ok) {
        setBusy(null);
        return setError(`保存に失敗しました：${r.message}（保存済みの分は「取り込み履歴」から取り消せます）`);
      }
      for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += r.data[k];
    }
    setBusy(null);
    setRows(null);
    setResult(
      `保存しました。新規 ${total.inserted}件、更新 ${total.updated}件。掲載施設とひも付け ${total.matchedFacilities}件、候補とひも付け ${total.matchedCandidates}件。` +
        "\nJALAの情報は「分娩・無痛分娩」の欄にだけ表示され、婦人科処置の麻酔対応には使われません。",
    );
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="j1" className="rounded-2xl border border-line bg-white p-4 sm:p-6">
        <h2 id="j1" className="text-lg font-bold">1. 都道府県を選ぶ</h2>
        <p className="mt-1 text-sm text-ink-muted">
          JALAの「全国無痛分娩施設検索」の都道府県別一覧ページだけを取得します（各施設の詳細ページは取得しません）。サイトに負担をかけないよう、1ページごとに{JALA_INTERVAL_MS / 1000}秒あけて順番に取得します。
        </p>
        <div className="mt-3 space-y-3">
          {REGIONS.map((r) => {
            const list = PREFECTURES.filter((p) => p.region === r.key);
            const all = list.every((p) => prefs.has(p.code));
            return (
              <div key={r.key} className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrefs((s) => { const n = new Set(s); list.forEach((p) => (all ? n.delete(p.code) : n.add(p.code))); return n; })}
                  className="min-h-10 w-28 rounded-lg border border-line bg-mist px-2 text-sm font-semibold"
                >
                  {r.name}
                </button>
                {list.map((p) => (
                  <button key={p.code} type="button" aria-pressed={prefs.has(p.code)} onClick={() => togglePref(p.code)} className={`min-h-10 rounded-full border px-3 text-sm ${prefs.has(p.code) ? "border-primary bg-primary text-white" : "border-lavender-200 bg-white"}`}>
                    {p.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={!prefs.size || !!busy} onClick={fetchAll} className="min-h-11 rounded-lg bg-primary px-5 font-bold text-white disabled:opacity-50">
            取得してプレビュー（{prefs.size}都道府県・約{Math.ceil((prefs.size * JALA_INTERVAL_MS) / 60000)}分）
          </button>
          {busy && (
            <button type="button" onClick={() => (stop.current = true)} className="min-h-11 rounded-lg border border-line bg-white px-4">
              中止
            </button>
          )}
        </div>
        {log.length > 0 && <pre className="mt-4 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-mist p-3 text-xs">{log.join("\n")}</pre>}
      </section>

      {rows && (
        <section aria-labelledby="j2" className="rounded-2xl border border-line bg-white p-4 sm:p-6">
          <h2 id="j2" className="text-lg font-bold">2. プレビュー（まだ保存していません）</h2>
          <p className="mt-1 text-sm">
            取得 {rows.length}件：新規 {rows.filter((r) => r.state === "new").length}件／更新 {rows.filter((r) => r.state === "update").length}件／変更なし {rows.filter((r) => r.state === "same").length}件
          </p>
          <div className="mt-3 max-h-[60vh] overflow-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-mist text-left">
                <tr>
                  <th className="px-3 py-2">扱い</th>
                  <th className="px-3 py-2">名称</th>
                  <th className="px-3 py-2">住所・電話</th>
                  <th className="px-3 py-2">ひも付け先</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ rec, state, match }) => (
                  <tr key={rec.jalaId} className="border-t border-line align-top">
                    <td className="whitespace-nowrap px-3 py-2">{state === "new" ? "新規" : state === "update" ? "更新" : "変更なし"}</td>
                    <td className="px-3 py-2"><a href={rec.jalaUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{rec.name}</a></td>
                    <td className="px-3 py-2">{rec.address}<br /><span className="text-ink-muted">{rec.phone ?? "電話番号なし"}</span></td>
                    <td className="px-3 py-2">
                      {match ? (
                        <>
                          {match.type === "facility" ? "掲載施設" : "掲載候補"}「{match.name}」
                          <p className={`text-xs ${match.kind === "name_only" ? "text-warn" : "text-ink-muted"}`}>
                            {MATCH_KIND[match.kind]}{match.kind === "name_only" && "：ひも付けません"}
                          </p>
                        </>
                      ) : (
                        <span className="text-ink-muted">なし（JALA情報として保存のみ）</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 rounded-lg bg-lavender-50 p-3 text-sm">
            保存したJALA情報は、ひも付いた掲載施設の詳細ページの「分娩・無痛分娩」欄にだけ表示されます。<strong>婦人科処置（ラミナリア・子宮鏡など）の麻酔対応としては扱いません。</strong>
          </p>
          <button type="button" disabled={!!busy || rows.every((r) => r.state === "same")} onClick={commit} className="mt-3 min-h-11 rounded-lg bg-primary px-5 font-bold text-white disabled:opacity-50">
            保存する
          </button>
        </section>
      )}

      {busy && <p role="status" className="rounded-lg bg-lavender-50 px-4 py-3 text-sm">{busy}</p>}
      {error && <p role="alert" className="rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">{error}</p>}
      {result && <p role="status" className="whitespace-pre-wrap rounded-lg bg-ev-a-bg px-4 py-3 text-sm text-ev-a">{result}</p>}
    </div>
  );
}
