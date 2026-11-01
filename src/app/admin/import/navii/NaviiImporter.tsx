"use client";

import { useMemo, useState } from "react";
import { decodeText, extractCsvFiles } from "@/lib/import/csv";
import { planNaviiImport, summarizePlan, type PlanAction } from "@/lib/import/match";
import { detectNaviiFile, readFacilityTable, readSpecialityTable, type NaviiKind, type NaviiRecord, type NaviiTable, type SpecialityInfo } from "@/lib/import/navii";
import { prefByCode, PREFECTURES } from "@/lib/master";
import { commitNaviiRecords, createImportBatch, getMatchIndex } from "../actions";

interface LoadedFile {
  name: string;
  bytes: Uint8Array;
  kind?: NaviiKind;
  table?: NaviiTable;
  dataDate?: string;
}

const CHUNK = 300;
const MAX_PER_IMPORT = 5000;
const yieldUi = () => new Promise((r) => setTimeout(r, 0));

const ACTION_LABEL: Record<PlanAction["action"], string> = {
  new: "新規（候補に追加）",
  update_candidate: "更新候補（候補の内容を更新）",
  unchanged: "変更なし",
  facility_match: "既存の掲載施設と一致（新規登録しない）",
  possible_duplicate: "重複の可能性（登録しない）",
  duplicate_in_file: "ファイル内で重複（登録しない）",
};
const FIELD_LABEL: Record<string, string> = {
  name: "名称", address: "住所", city: "市区町村", website_url: "ホームページ", consultation_hours: "診療時間",
  departments: "診療科", latitude: "緯度", longitude: "経度",
};
const fmt = (v: unknown) => (Array.isArray(v) ? v.join("・") : v == null || v === "" ? "（空欄）" : String(v));

export function NaviiImporter() {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [records, setRecords] = useState<NaviiRecord[] | null>(null);
  const [readLog, setReadLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Set<number>>(new Set());
  const [dataDate, setDataDate] = useState("");
  const [plan, setPlan] = useState<PlanAction[] | null>(null);
  const [filter, setFilter] = useState<PlanAction["action"] | "all">("all");
  const [understood, setUnderstood] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onPick(list: FileList | null) {
    if (!list) return;
    setError(null);
    setBusy("ファイルを開いています…");
    try {
      const out: LoadedFile[] = [];
      for (const f of Array.from(list)) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        for (const csv of extractCsvFiles(f.name, bytes)) out.push({ ...csv, ...detectNaviiFile(csv.name) });
      }
      setFiles((prev) => [...prev, ...out]);
      const d = out.find((f) => f.dataDate)?.dataDate;
      if (d && !dataDate) setDataDate(d);
      setRecords(null);
      setPlan(null);
    } catch (e) {
      setError(`ファイルを開けませんでした：${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  }

  function setFileMeta(i: number, patch: Partial<LoadedFile>) {
    setFiles((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
    setRecords(null);
    setPlan(null);
  }

  async function readAll() {
    setError(null);
    setPlan(null);
    setResult(null);
    const log: string[] = [];
    const all: NaviiRecord[] = [];
    try {
      for (const kind of ["hospital", "clinic"] as NaviiKind[]) {
        const fac = files.filter((f) => f.kind === kind && f.table === "facility");
        const spec = files.filter((f) => f.kind === kind && f.table === "speciality");
        if (!fac.length && !spec.length) continue;
        const label = kind === "hospital" ? "病院" : "診療所";
        if (!fac.length || !spec.length) {
          log.push(`${label}：施設票と診療科・診療時間票の両方が必要です（片方だけのため読み込みませんでした）`);
          continue;
        }
        const map = new Map<string, SpecialityInfo>();
        for (const f of spec) {
          setBusy(`${label}の診療科・診療時間票を読んでいます…（${f.name}）`);
          await yieldUi();
          const { text, encoding } = decodeText(f.bytes);
          const r = readSpecialityTable(text, map);
          if (r.missing.length) throw new Error(`${f.name}：必要な列がありません（${r.missing.join("、")}）`);
          log.push(`${label}・診療科票 ${f.name}：${r.rows.toLocaleString()}行（${encoding}）`);
        }
        const gyn = [...map.values()].filter((v) => v.hasGyn).length;
        log.push(`${label}：婦人科・産婦人科・産科のある施設 ${gyn.toLocaleString()}件`);
        for (const f of fac) {
          setBusy(`${label}の施設票を読んでいます…（${f.name}）`);
          await yieldUi();
          const { text, encoding } = decodeText(f.bytes);
          const r = readFacilityTable(text, kind, map, dataDate || f.dataDate);
          if (r.missing.length) throw new Error(`${f.name}：必要な列がありません（${r.missing.join("、")}）`);
          log.push(`${label}・施設票 ${f.name}：${r.rows.toLocaleString()}行 → 抽出 ${r.records.length.toLocaleString()}件（${encoding}）`);
          r.errors.slice(0, 5).forEach((e) => log.push(`  ⚠ ${e}`));
          if (r.errors.length > 5) log.push(`  ⚠ ほか${r.errors.length - 5}件`);
          all.push(...r.records);
        }
      }
      if (!all.length) log.push("抽出された施設がありません。ファイルの種類の指定を確認してください。");
      setRecords(all);
      setReadLog(log);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReadLog(log);
    } finally {
      setBusy(null);
    }
  }

  const countsByPref = useMemo(() => {
    const m = new Map<number, number>();
    records?.forEach((r) => m.set(r.prefectureCode, (m.get(r.prefectureCode) ?? 0) + 1));
    return m;
  }, [records]);
  const selected = useMemo(() => (records ?? []).filter((r) => prefs.has(r.prefectureCode)).map((r) => ({ ...r, dataDate: dataDate || r.dataDate })), [records, prefs, dataDate]);

  async function dryRun() {
    setError(null);
    setResult(null);
    setBusy("既存の施設・候補と照合しています…（データベースには書き込みません）");
    const idx = await getMatchIndex([...prefs]);
    setBusy(null);
    if (!idx.ok) return setError(idx.message);
    setPlan(planNaviiImport(selected, idx.data));
    setFilter("all");
    setUnderstood(false);
  }

  async function commit() {
    if (!plan) return;
    setError(null);
    const summary = summarizePlan(plan);
    const prefNames = [...prefs].sort((a, b) => a - b).map((p) => prefByCode(p)?.name).join("・");
    const batch = await createImportBatch({
      source: "navii",
      label: `ナビイ取り込み：${prefNames}`,
      dataDate: dataDate || undefined,
      fileNames: files.map((f) => f.name),
      summary,
    });
    if (!batch.ok) return setError(batch.message);
    const toSend = plan.filter((p) => p.action === "new" || p.action === "update_candidate" || p.action === "facility_match").map((p) => p.record);
    const total = { inserted: 0, updated: 0, facilityMatches: 0, unchanged: 0, skipped: 0, rejected: 0 };
    const messages: string[] = [];
    for (let i = 0; i < toSend.length; i += CHUNK) {
      setBusy(`保存しています… ${Math.min(i + CHUNK, toSend.length).toLocaleString()} / ${toSend.length.toLocaleString()}件`);
      const r = await commitNaviiRecords(batch.data, toSend.slice(i, i + CHUNK));
      if (!r.ok) {
        setBusy(null);
        return setError(`${i}件目以降の保存に失敗しました：${r.message}（保存済みの分は「取り込み履歴」から取り消せます）`);
      }
      for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += r.data[k] ?? 0;
      messages.push(...r.data.messages);
    }
    setBusy(null);
    setPlan(null);
    setResult(
      `保存しました。新規 ${total.inserted}件、更新 ${total.updated}件（うち既存の掲載施設と一致 ${total.facilityMatches}件）、変更なし ${total.unchanged}件、見送り ${total.skipped + total.rejected}件。` +
        (messages.length ? `\n${messages.slice(0, 10).join("\n")}` : "") +
        "\nすべて「未確認」の掲載候補として保存され、公開はされていません。",
    );
  }

  const summary = plan ? summarizePlan(plan) : null;
  const shown = plan?.filter((p) => filter === "all" || p.action === filter) ?? [];

  return (
    <div className="space-y-8">
      {/* 1. ファイル */}
      <section aria-labelledby="step1" className="rounded-2xl border border-line bg-white p-4 sm:p-6">
        <h2 id="step1" className="text-lg font-bold">1. ファイルを選ぶ</h2>
        <p className="mt-1 text-sm text-ink-muted">
          厚生労働省「医療情報ネットのオープンデータ」から、病院・診療所の「施設票」と「診療科・診療時間票」をダウンロードして選んでください（ZIPのままで構いません）。ファイルはこの端末の中で読み込み、婦人科系の施設だけを送信します。
        </p>
        <input
          type="file"
          multiple
          accept=".csv,.zip,text/csv,application/zip"
          onChange={(e) => onPick(e.target.files)}
          className="mt-3 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:font-semibold file:text-white"
        />
        {files.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line text-sm">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 break-all">{f.name}（{(f.bytes.length / 1024 / 1024).toFixed(1)}MB）</span>
                <select aria-label={`${f.name}の種別`} value={f.kind ?? ""} onChange={(e) => setFileMeta(i, { kind: (e.target.value || undefined) as NaviiKind })} className="min-h-10 rounded-lg border border-line px-2">
                  <option value="">種別？</option>
                  <option value="hospital">病院</option>
                  <option value="clinic">診療所</option>
                </select>
                <select aria-label={`${f.name}の票`} value={f.table ?? ""} onChange={(e) => setFileMeta(i, { table: (e.target.value || undefined) as NaviiTable })} className="min-h-10 rounded-lg border border-line px-2">
                  <option value="">票？</option>
                  <option value="facility">施設票</option>
                  <option value="speciality">診療科・診療時間票</option>
                </select>
                <button type="button" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} className="min-h-10 rounded-lg border border-line px-3 hover:bg-mist">
                  外す
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="data-date" className="mb-1 block text-sm font-semibold">データ基準日</label>
            <input id="data-date" type="date" value={dataDate} onChange={(e) => setDataDate(e.target.value)} className="min-h-11 rounded-lg border border-line px-3" />
          </div>
          <button type="button" disabled={!files.length || !!busy} onClick={readAll} className="min-h-11 rounded-lg bg-primary px-5 font-bold text-white hover:bg-primary-strong disabled:opacity-50">
            読み込んで婦人科系を抽出
          </button>
        </div>
        {readLog.length > 0 && (
          <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-mist p-3 text-xs">{readLog.join("\n")}</pre>
        )}
      </section>

      {/* 2. 都道府県 */}
      {records && records.length > 0 && (
        <section aria-labelledby="step2" className="rounded-2xl border border-line bg-white p-4 sm:p-6">
          <h2 id="step2" className="text-lg font-bold">2. 取り込む都道府県を選ぶ</h2>
          <p className="mt-1 text-sm text-ink-muted">
            一度に大量に取り込まないよう、都道府県ごとに分けて進めます（1回 {MAX_PER_IMPORT.toLocaleString()}件まで）。選択中：{selected.length.toLocaleString()}件
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PREFECTURES.filter((p) => countsByPref.has(p.code)).map((p) => {
              const on = prefs.has(p.code);
              return (
                <button
                  key={p.code}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const next = new Set(prefs);
                    if (on) next.delete(p.code);
                    else next.add(p.code);
                    setPrefs(next);
                    setPlan(null);
                  }}
                  className={`min-h-10 rounded-full border px-3 text-sm ${on ? "border-primary bg-primary text-white" : "border-lavender-200 bg-white hover:bg-lavender-50"}`}
                >
                  {p.name}（{countsByPref.get(p.code)}）
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!prefs.size || selected.length > MAX_PER_IMPORT || !!busy}
            onClick={dryRun}
            className="mt-4 min-h-11 rounded-lg bg-primary px-5 font-bold text-white hover:bg-primary-strong disabled:opacity-50"
          >
            ドライラン（照合のみ・保存しない）
          </button>
          {selected.length > MAX_PER_IMPORT && <p className="mt-2 text-sm text-warn">選択が多すぎます。都道府県を減らしてください。</p>}
        </section>
      )}

      {/* 3. ドライラン結果 */}
      {plan && summary && (
        <section aria-labelledby="step3" className="rounded-2xl border border-line bg-white p-4 sm:p-6">
          <h2 id="step3" className="text-lg font-bold">3. ドライランの結果（まだ保存していません）</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={`min-h-10 rounded-full border px-3 text-sm ${filter === "all" ? "border-primary bg-primary text-white" : "border-line bg-white"}`}>
              すべて（{summary.total}）
            </button>
            {(Object.keys(ACTION_LABEL) as PlanAction["action"][]).map((a) => (
              <button key={a} type="button" aria-pressed={filter === a} disabled={!summary[a]} onClick={() => setFilter(a)} className={`min-h-10 rounded-full border px-3 text-sm disabled:opacity-40 ${filter === a ? "border-primary bg-primary text-white" : "border-line bg-white"}`}>
                {ACTION_LABEL[a]}（{summary[a]}）
              </button>
            ))}
          </div>
          <div className="mt-4 max-h-[60vh] overflow-auto rounded-xl border border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-mist text-left">
                <tr>
                  <th className="px-3 py-2">扱い</th>
                  <th className="px-3 py-2">名称</th>
                  <th className="px-3 py-2">所在地</th>
                  <th className="px-3 py-2">診療科</th>
                  <th className="px-3 py-2">一致・差分</th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, 300).map((p) => (
                  <tr key={p.record.naviiKey} className="border-t border-line align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{ACTION_LABEL[p.action]}</td>
                    <td className="px-3 py-2">{p.record.name}</td>
                    <td className="px-3 py-2">{p.record.address}</td>
                    <td className="px-3 py-2">{p.record.departments.filter((d) => /婦人科|産科/.test(d)).join("・")}</td>
                    <td className="px-3 py-2">
                      {"target" in p && <p>一致：{p.target.name}{"kind" in p && p.kind === "name_only" && <strong className="ml-1 text-warn">（名前のみ一致・要確認）</strong>}</p>}
                      {"changes" in p &&
                        Object.entries(p.changes).map(([k, c]) => (
                          <p key={k} className="text-xs">
                            {FIELD_LABEL[k] ?? k}：<span className="text-ink-muted line-through">{fmt(c.current)}</span> → {fmt(c.incoming)}
                          </p>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {shown.length > 300 && <p className="px-3 py-2 text-sm text-ink-muted">ほか{shown.length - 300}件（先頭300件を表示）</p>}
          </div>

          <div className="mt-6 space-y-3 rounded-xl bg-lavender-50 p-4">
            <p className="text-sm">
              保存すると、新規・更新候補・既存施設と一致したものが「掲載候補（未確認）」として保存されます。<strong>サイトには公開されず、既存の掲載施設の内容も変更されません。</strong>取り込みは「取り込み履歴」から取り消せます。
            </p>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--color-primary)]" />
              <span>内容を確認しました。掲載候補として保存します。</span>
            </label>
            <button type="button" disabled={!understood || !!busy || summary.new + summary.update_candidate + summary.facility_match === 0} onClick={commit} className="min-h-11 rounded-lg bg-primary px-5 font-bold text-white hover:bg-primary-strong disabled:opacity-50">
              掲載候補として保存する
            </button>
          </div>
        </section>
      )}

      {busy && (
        <p role="status" className="rounded-lg bg-lavender-50 px-4 py-3 text-sm">
          {busy}
        </p>
      )}
      {error && (
        <p role="alert" className="whitespace-pre-wrap rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          {error}
        </p>
      )}
      {result && (
        <p role="status" className="whitespace-pre-wrap rounded-lg bg-ev-a-bg px-4 py-3 text-sm text-ev-a">
          {result}
        </p>
      )}
    </div>
  );
}
