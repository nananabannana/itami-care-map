/**
 * CSV の読み込み（ブラウザ・サーバー共通）
 *   - UTF-8（BOM あり／なし）に対応。UTF-8 として読めない場合は Shift_JIS として読む
 *   - ダブルクォート、カンマや改行を含む値、CRLF に対応
 *   - 1行ずつコールバックするので、全国分の大きなファイルでも配列を2重に持たない
 */
import { unzipSync } from "fflate";

export function decodeText(bytes: Uint8Array): { text: string; encoding: "utf-8" | "shift_jis" } {
  try {
    // ignoreBOM: false（既定）で先頭の BOM は取り除かれる
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { text: text.replace(/^﻿/, ""), encoding: "utf-8" };
  } catch {
    return { text: new TextDecoder("shift_jis").decode(bytes), encoding: "shift_jis" };
  }
}

/** ZIP なら中の CSV を、CSV ならそのまま返す */
export function extractCsvFiles(name: string, bytes: Uint8Array): { name: string; bytes: Uint8Array }[] {
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // "PK"
  if (!isZip) return [{ name, bytes }];
  const entries = unzipSync(bytes, { filter: (f) => /\.csv$/i.test(f.name) });
  return Object.entries(entries).map(([n, b]) => ({ name: n, bytes: b }));
}

/** CSV を1行ずつ読む。1行目はヘッダーとして返す */
export function parseCsv(text: string, onRow: (row: string[], index: number) => void): string[] {
  let header: string[] | null = null;
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;

  const endRow = () => {
    row.push(field);
    field = "";
    if (!(row.length === 1 && row[0] === "")) {
      if (header === null) header = row.map((h) => h.trim());
      else onRow(row, index++);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") endRow();
    else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else field += ch;
  }
  if (field !== "" || row.length > 0) endRow();
  return header ?? [];
}

/** ヘッダー名 → 列番号。必須列が無ければ名前を返す */
export function columnIndex<T extends string>(header: string[], names: readonly T[]) {
  const idx = {} as Record<T, number>;
  const missing: T[] = [];
  for (const n of names) {
    const i = header.indexOf(n);
    if (i < 0) missing.push(n);
    idx[n] = i;
  }
  return { idx, missing };
}
