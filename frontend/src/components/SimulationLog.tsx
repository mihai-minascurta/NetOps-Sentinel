import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useViewportStore } from '@xyflow/react';
import { simulationQueryRoute } from '../topology';
import type { SimulationLogEntry } from '../topologySimulationLog';

const maxLogLines = 8;
const preferredLogWidth = 232;
const minimumLogWidth = 112;
const canvasInset = 16;
const controlClearance = 124;
const gap = 6;

export default function SimulationLog({ entries }: { entries: readonly SimulationLogEntry[] }) {
  const { transform: [x, y, zoom], width, height } = useViewportStore();
  const measureRef = useRef<HTMLOListElement>(null);
  const [fitCount, setFitCount] = useState(0);
  const [expiry, setExpiry] = useState<{ through: number; newestId?: number }>({ through: -1 });
  const newest = entries.at(-1);
  const recent = entries.slice(-maxLogLines).filter((entry) => entry.id > expiry.through);
  const visible = recent.slice(Math.max(0, recent.length - fitCount));
  const expiringId = newest?.id !== expiry.newestId && visible.length > 1 &&
    (visible.length === maxLogLines || visible.length < recent.length) ? visible[0].id : undefined;

  let left = canvasInset;
  let top = canvasInset;
  let bottom = height - controlClearance;
  let right = Math.min(x, width) - gap;
  if (right - left < minimumLogWidth) {
    // Use the opening between the queries edge, SQLite and the investigation heading.
    left = Math.max(left, x + simulationQueryRoute.leftX * zoom + gap);
    top = Math.max(top, y + simulationQueryRoute.returnY * zoom + gap);
    bottom = Math.min(bottom, y + 576 * zoom - gap);
    right = Math.min(x + 224 * zoom, width) - gap;
  }
  const logWidth = Math.min(preferredLogWidth, right - left);
  const availableHeight = bottom - top;
  const hasRoom = logWidth >= minimumLogWidth && availableHeight > 0;

  useLayoutEffect(() => {
    const list = measureRef.current;
    if (!hasRoom || !list) return;

    const measure = () => {
      const rowGap = Number.parseFloat(getComputedStyle(list).rowGap) || 0;
      let usedHeight = 0;
      let count = 0;
      for (const line of Array.from(list.children).reverse()) {
        usedHeight += line.getBoundingClientRect().height + (count ? rowGap : 0);
        if (usedHeight > availableHeight) break;
        count++;
      }
      setFitCount(count);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [availableHeight, entries, expiry.through, hasRoom, logWidth]);

  if (!hasRoom) return null;

  return (
    <div className="simulation-log" style={{ left, bottom: height - bottom, width: logWidth, maxHeight: availableHeight }}>
      <span className="simulation-log__announcement" aria-live="polite" aria-atomic="true">
        {newest?.message}
      </span>
      <ol className="simulation-log__measure" ref={measureRef} aria-hidden="true">
        {recent.map((entry) => <li key={entry.id}>{entry.message}</li>)}
      </ol>
      <ol aria-hidden="true">
        {visible.map((entry, index) => {
          const age = visible.length - 1 - index;
          return (
            <li
              key={entry.id}
              className="simulation-log__line"
              data-expiring={entry.id === expiringId || undefined}
              style={{ '--log-line-opacity': 1 - age * 0.7 / (maxLogLines - 1) } as CSSProperties}
              onAnimationEnd={(event) => {
                if (event.animationName === 'simulation-log-out') {
                  setExpiry((previous) => ({ through: Math.max(previous.through, entry.id), newestId: newest?.id }));
                }
              }}
            >
              {entry.message}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
