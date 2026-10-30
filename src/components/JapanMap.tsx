"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { MAP_HEIGHT, MAP_WIDTH, OKINAWA_FRAME, PREFECTURE_SHAPES, type PrefectureShape } from "@/data/japan-map";
import { ACTIVE_FILL, BORDER, binOf, COUNT_BINS, prefHref, REGION_FILL } from "@/lib/map-scale";
import { prefByCode, REGIONS } from "@/lib/master";
import type { RegionKey } from "@/lib/types";

type ColorMode = "count" | "region";
type Zoom = RegionKey | "all";
type Box = [number, number, number, number]; // x, y, w, h

const FULL: Box = [0, 0, MAP_WIDTH, MAP_HEIGHT];

/** 地域の表示範囲（全体と同じ縦横比を保って中心に合わせる） */
function regionBox(region: RegionKey): Box {
  const shapes = PREFECTURE_SHAPES.filter(
    (s) => prefByCode(s.code)?.region === region && s.code !== 47, // 沖縄は左上の枠内にあるため拡大範囲から外す
  );
  const x0 = Math.min(...shapes.map((s) => s.bbox[0]));
  const y0 = Math.min(...shapes.map((s) => s.bbox[1]));
  const x1 = Math.max(...shapes.map((s) => s.bbox[2]));
  const y1 = Math.max(...shapes.map((s) => s.bbox[3]));
  const pad = 14;
  let w = x1 - x0 + pad * 2;
  let h = y1 - y0 + pad * 2;
  const aspect = MAP_WIDTH / MAP_HEIGHT;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return [(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h];
}

/** 矢印キーで、その方向にある最も近い都道府県を探す */
function neighbor(from: PrefectureShape, key: string): PrefectureShape | undefined {
  const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[key];
  if (!dir) return;
  const [fx, fy] = from.label;
  let best: PrefectureShape | undefined;
  let bestScore = Infinity;
  for (const s of PREFECTURE_SHAPES) {
    if (s.code === from.code) continue;
    const dx = s.label[0] - fx;
    const dy = s.label[1] - fy;
    const along = dx * dir[0] + dy * dir[1];
    if (along <= 0) continue;
    const across = Math.abs(dx * dir[1] - dy * dir[0]);
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

function useAnimatedBox(target: Box): Box {
  const [box, setBox] = useState<Box>(target);
  const fromRef = useRef<Box>(target);
  useEffect(() => {
    const from = fromRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const dur = reduce ? 0 : 380;
    let raf = 0;
    const tick = (now: number) => {
      const t = dur === 0 ? 1 : Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const next = from.map((v, i) => v + (target[i] - v) * e) as Box;
      fromRef.current = next;
      setBox(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return box;
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-lavender-200 bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-full px-4 text-sm font-semibold transition-colors ${
            value === o.value ? "bg-primary text-white" : "text-ink hover:bg-lavender-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function JapanMap({ counts, listAnchorId }: { counts: Record<number, number>; listAnchorId: string }) {
  const router = useRouter();
  const uid = useId();
  const [mode, setMode] = useState<ColorMode>("count");
  const [zoom, setZoom] = useState<Zoom>("all");
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [active, setActive] = useState<number | null>(null);
  const [focusCode, setFocusCode] = useState<number>(23);
  const linkRefs = useRef(new Map<number, { focus: () => void }>());

  const target = useMemo<Box>(() => (zoom === "all" ? FULL : regionBox(zoom)), [zoom]);
  const box = useAnimatedBox(target);

  // SVGの表示幅を測り、件数バッジや文字を画面上で一定のピクセルサイズに保つ
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgPx, setSvgPx] = useState(MAP_WIDTH);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSvgPx(entry.contentRect.width || MAP_WIDTH));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const unitsPerPx = box[2] / svgPx;

  const countOf = useCallback((code: number) => counts[code] ?? 0, [counts]);
  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  const fillOf = (code: number) => {
    if (code === active) return ACTIVE_FILL;
    if (mode === "region") {
      const r = prefByCode(code)?.region;
      return r ? REGION_FILL[r] : "#eee";
    }
    return binOf(countOf(code)).fill;
  };

  const go = (code: number) => router.push(prefHref(code));

  const onKeyDown = (e: React.KeyboardEvent, shape: PrefectureShape) => {
    const next = neighbor(shape, e.key);
    if (next) {
      e.preventDefault();
      setFocusCode(next.code);
      linkRefs.current.get(next.code)?.focus();
    } else if (e.key === " ") {
      e.preventDefault();
      go(shape.code);
    }
  };

  const activeShape = active ? PREFECTURE_SHAPES.find((s) => s.code === active) : undefined;
  const activePref = active ? prefByCode(active) : undefined;
  const tipPos = activeShape
    ? {
        left: `${((activeShape.label[0] - box[0]) / box[2]) * 100}%`,
        top: `${((activeShape.label[1] - box[1]) / box[3]) * 100}%`,
      }
    : undefined;
  const tipVisible =
    tipPos && parseFloat(tipPos.left) >= 0 && parseFloat(tipPos.left) <= 100 && parseFloat(tipPos.top) >= 0 && parseFloat(tipPos.top) <= 100;

  const badgeR = 10.5 * unitsPerPx;
  const fontSize = 12 * unitsPerPx;
  const okiLabel = 12 * unitsPerPx;

  const colorToggle = (
    <Segmented
      label="地図の色分け"
      value={mode}
      onChange={setMode}
      options={[
        { value: "count", label: "掲載件数で色分け" },
        { value: "region", label: "地域で色分け" },
      ]}
    />
  );

  const legend = (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm lg:flex-col">
      {mode === "count" ? (
        <>
          <span className="font-semibold">掲載件数</span>
          {COUNT_BINS.map((b) => (
            <span key={b.label} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-4 w-6 rounded border" style={{ background: b.fill, borderColor: BORDER }} />
              {b.label}
            </span>
          ))}
        </>
      ) : (
        <>
          <span className="font-semibold">地域</span>
          {REGIONS.map((r) => (
            <span key={r.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-4 w-6 rounded border" style={{ background: REGION_FILL[r.key], borderColor: BORDER }} />
              {r.name}
            </span>
          ))}
        </>
      )}
      <span className="inline-flex items-start gap-1.5 text-ink-muted">
        <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#4b3c7a] text-[11px] font-bold text-white">
          3
        </span>
        <span>＝掲載件数。0件の都道府県も選んで検索できます</span>
      </span>
    </div>
  );

  return (
    <div>
      {/* スマホ：地図と地域別リストを切り替え */}
      <div className="mb-4 flex justify-center md:hidden">
        <Segmented
          label="表示の切り替え"
          value={mobileView}
          onChange={(v) => {
            setMobileView(v);
            if (v === "list") document.getElementById(listAnchorId)?.scrollIntoView({ behavior: "smooth" });
          }}
          options={[
            { value: "map", label: "地図で探す" },
            { value: "list", label: "地域別リストで探す" },
          ]}
        />
      </div>

      <div className={mobileView === "list" ? "hidden md:block" : ""}>
        <div role="group" aria-label="地域を拡大" className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ key: "all" as Zoom, name: "全国" }, ...REGIONS.map((r) => ({ key: r.key as Zoom, name: r.name }))].map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={zoom === r.key}
              onClick={() => setZoom(r.key)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${
                zoom === r.key
                  ? "border-primary bg-primary font-semibold text-white"
                  : "border-lavender-200 bg-white text-ink hover:bg-lavender-50"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>

        <a href={`#${listAnchorId}`} className="sr-only focus:not-sr-only focus:mb-2 focus:inline-block focus:text-primary focus:underline">
          地図をとばして都道府県の一覧へ
        </a>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-6">
          <div className="relative overflow-hidden rounded-2xl border border-lavender-200 bg-white">
            {/* PCでは画面の高さに収める */}
            <div className="mx-auto lg:max-w-[calc(72vh*var(--map-aspect))]" style={{ ["--map-aspect" as string]: MAP_WIDTH / MAP_HEIGHT }}>
              <div className="relative">
                <svg
                  ref={svgRef}
                  viewBox={box.join(" ")}
                  role="group"
                  aria-label={`日本地図。都道府県を選んで検索できます（掲載 合計${total}件）`}
                  aria-describedby={`${uid}-help`}
                  className="block h-auto w-full touch-manipulation select-none"
                  style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}
                  onMouseLeave={() => setActive(null)}
                >
                  <rect
                    x={OKINAWA_FRAME[0]}
                    y={OKINAWA_FRAME[1]}
                    width={OKINAWA_FRAME[2]}
                    height={OKINAWA_FRAME[3]}
                    rx={4}
                    fill="none"
                    stroke={BORDER}
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                    opacity={0.6}
                    aria-hidden="true"
                  />
                  <text
                    x={OKINAWA_FRAME[0] + 5 * unitsPerPx}
                    y={OKINAWA_FRAME[1] + OKINAWA_FRAME[3] - 6 * unitsPerPx}
                    fontSize={okiLabel}
                    fill="#5e5869"
                    aria-hidden="true"
                  >
                    沖縄県
                  </text>

                  {PREFECTURE_SHAPES.map((s) => {
                    const pref = prefByCode(s.code)!;
                    const n = countOf(s.code);
                    return (
                      <a
                        key={s.code}
                        href={prefHref(s.code)}
                        ref={(el) => {
                          if (el) linkRefs.current.set(s.code, el);
                          else linkRefs.current.delete(s.code);
                        }}
                        tabIndex={s.code === focusCode ? 0 : -1}
                        aria-label={`${pref.name}（掲載${n}件）`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                          e.preventDefault();
                          go(s.code);
                        }}
                        onMouseEnter={() => setActive(s.code)}
                        onFocus={() => {
                          setActive(s.code);
                          setFocusCode(s.code);
                        }}
                        onBlur={() => setActive((a) => (a === s.code ? null : a))}
                        onKeyDown={(e) => onKeyDown(e, s)}
                        className="cursor-pointer outline-none"
                      >
                        <path
                          d={s.d}
                          fill={fillOf(s.code)}
                          stroke={BORDER}
                          strokeWidth={0.9}
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                          className="transition-[fill] duration-150"
                        />
                      </a>
                    );
                  })}

                  {/* 選択中の都道府県の輪郭を最前面に */}
                  {activeShape && (
                    <path
                      d={activeShape.d}
                      fill="none"
                      stroke="#2b2733"
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      pointerEvents="none"
                      aria-hidden="true"
                    />
                  )}

                  {/* 掲載件数（色だけに頼らず数値も表示） */}
                  <g aria-hidden="true" pointerEvents="none">
                    {PREFECTURE_SHAPES.filter((s) => countOf(s.code) > 0).map((s) => {
                      const isActive = s.code === active;
                      return (
                        <g key={s.code} transform={`translate(${s.label[0]} ${s.label[1]})`}>
                          <circle
                            r={badgeR}
                            fill={isActive ? "#ffffff" : "#4b3c7a"}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            vectorEffect="non-scaling-stroke"
                          />
                          <text textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight={700} fill={isActive ? "#4b3c7a" : "#ffffff"}>
                            {countOf(s.code)}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* ホバー・フォーカス時の都道府県名 */}
                {activePref && tipVisible && (
                  <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+16px)] whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-sm text-white shadow-lg"
                    style={tipPos}
                    aria-hidden="true"
                  >
                    <span className="font-bold">{activePref.name}</span>
                    <span className="ml-2">掲載 {countOf(activePref.code)}件</span>
                  </div>
                )}
              </div>
            </div>

            <div className="sr-only" aria-live="polite">
              {activePref ? `${activePref.name}、掲載${countOf(activePref.code)}件` : ""}
            </div>
          </div>

          <aside aria-label="地図の操作と凡例" className="mt-4 space-y-5 lg:mt-0">
            {/* 選択中の都道府県（PC） */}
            <div className="hidden rounded-2xl border border-lavender-200 bg-white p-4 lg:block">
              <p className="text-xs font-semibold text-ink-muted">選択中の都道府県</p>
              {activePref ? (
                <>
                  <p className="mt-1 text-xl font-bold">{activePref.name}</p>
                  <p className="mt-1">
                    掲載 <strong className="text-2xl tabular-nums text-primary">{countOf(activePref.code)}</strong> 件
                  </p>
                  <p className="mt-2 text-sm text-ink-muted">クリックまたはEnterで検索結果へ</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-ink-muted">地図の都道府県にカーソルを合わせると、掲載件数が表示されます。</p>
              )}
            </div>

            <div>{colorToggle}</div>
            {legend}
            <p id={`${uid}-help`} className="text-sm text-ink-muted">
              都道府県を選ぶと、その地域の検索結果に移動します。キーボードでは矢印キーで移動し、Enterで決定できます。小さな都道府県は、上の地域ボタンで拡大すると選びやすくなります。
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
