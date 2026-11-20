import { useState } from 'react';
import { SecondSnapshot } from '../types/typing';

interface WpmTimelineChartProps {
  data: SecondSnapshot[];
  height?: number;
}

export function WpmTimelineChart({ data, height = 190 }: WpmTimelineChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border text-xs"
        style={{
          height,
          borderColor: 'var(--border-hairline)',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--ink-muted)',
        }}
      >
        No timeline samples recorded.
      </div>
    );
  }

  const width = 760;
  const padLeft = 40;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = Math.max(
    40,
    ...data.map((d) => Math.max(d.wpm, d.rawWpm))
  );
  const yMax = Math.ceil(maxVal / 20) * 20;

  const xForIndex = (i: number) => {
    if (data.length === 1) return padLeft + plotW / 2;
    return padLeft + (i / (data.length - 1)) * plotW;
  };

  const yForValue = (v: number) => {
    return padTop + plotH - (v / yMax) * plotH;
  };

  const wpmPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i).toFixed(1)} ${yForValue(d.wpm).toFixed(1)}`)
    .join(' ');

  const rawPath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i).toFixed(1)} ${yForValue(d.rawWpm).toFixed(1)}`)
    .join(' ');

  const yTicks = [0, Math.round(yMax / 2), yMax];
  const activePoint = hoverIdx !== null ? data[hoverIdx] : null;

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5" style={{ color: 'var(--ink-primary)' }}>
            <span
              className="inline-block h-0.5 w-4"
              style={{ backgroundColor: 'var(--accent)' }}
            />
            Net WPM
          </span>
          <span className="flex items-center gap-1.5" style={{ color: 'var(--ink-muted)' }}>
            <span
              className="inline-block h-0.5 w-4 border-t border-dashed"
              style={{ borderColor: 'var(--ink-muted)' }}
            />
            Raw WPM
          </span>
          <span className="flex items-center gap-1.5" style={{ color: 'var(--error)' }}>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: 'var(--error)' }}
            />
            Errors
          </span>
        </div>

        <div
          className="font-mono-typing text-xs tabular-nums"
          style={{ color: 'var(--ink-muted)' }}
        >
          {activePoint
            ? `${activePoint.second}s · ${activePoint.wpm} WPM · ${activePoint.rawWpm} raw · ${activePoint.errors} err`
            : 'Hover chart to inspect'}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full overflow-visible select-none"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {yTicks.map((tick) => {
          const y = yForValue(tick);
          return (
            <g key={tick}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="var(--border-hairline)"
                strokeWidth="1"
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--ink-muted)"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {tick}
              </text>
            </g>
          );
        })}

        <path
          d={rawPath}
          fill="none"
          stroke="var(--ink-muted)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        <path
          d={wpmPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {data.map((d, i) => {
          const cx = xForIndex(i);
          const cy = yForValue(d.wpm);
          return (
            <g key={d.second}>
              {d.errors > 0 && (
                <circle
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill="var(--error)"
                  stroke="var(--bg-surface)"
                  strokeWidth="1.5"
                />
              )}
              {hoverIdx === i && (
                <>
                  <line
                    x1={cx}
                    y1={padTop}
                    x2={cx}
                    y2={padTop + plotH}
                    stroke="var(--border-hairline)"
                    strokeWidth="1"
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4.5}
                    fill="var(--accent)"
                    stroke="var(--bg-surface)"
                    strokeWidth="2"
                  />
                </>
              )}
              <rect
                x={cx - Math.max(8, plotW / Math.max(1, data.length) / 2)}
                y={padTop}
                width={Math.max(16, plotW / Math.max(1, data.length))}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            </g>
          );
        })}

        {data
          .filter(
            (_, i) =>
              data.length <= 12 ||
              i === 0 ||
              i === data.length - 1 ||
              i % Math.ceil(data.length / 6) === 0
          )
          .map((d) => {
            const idx = data.indexOf(d);
            return (
              <text
                key={`x-${d.second}`}
                x={xForIndex(idx)}
                y={height - 6}
                textAnchor="middle"
                fontSize="10"
                fill="var(--ink-muted)"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {d.second}s
              </text>
            );
          })}
      </svg>
    </div>
  );
}
