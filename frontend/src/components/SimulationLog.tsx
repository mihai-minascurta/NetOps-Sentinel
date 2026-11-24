import { useState, type CSSProperties } from 'react';
import { useViewportStore } from '@xyflow/react';
import { simulationQueryRoute } from '../topology';
import type { SimulationLogEntry } from '../topologySimulationLog';

const logWidth = 224;
const logHeight = 228;
const canvasInset = 16;
const controlClearance = 124;
const gap = 6;
const opacityByAge = [1, 0.90, 0.76, 0.62, 0.46, 0.32];

export default function SimulationLog({ entries }: { entries: readonly SimulationLogEntry[] }) {
  const { transform: [x, y, zoom], width, height } = useViewportStore();
  const [expiredThrough, setExpiredThrough] = useState(-1);
  const visible = entries.slice(-opacityByAge.length).filter((entry) => entry.id > expiredThrough);

  let left = canvasInset;
  let bottom = height - controlClearance;
  if (x < left + logWidth + gap) {
    // Use the opening between the queries edge, SQLite and the investigation heading.
    left = Math.max(left, x + simulationQueryRoute.leftX * zoom + gap);
    bottom = Math.min(bottom, y + 576 * zoom - gap);
    if (left + logWidth + gap > x + 224 * zoom ||
      bottom - (y + simulationQueryRoute.returnY * zoom + gap) < logHeight) return null;
  }
  if (left + logWidth + gap > width || bottom < logHeight) return null;

  return (
    <div className="simulation-log" style={{ left, bottom: height - bottom, width: logWidth }}>
      <span className="simulation-log__announcement" aria-live="polite" aria-atomic="true">
        {entries.at(-1)?.message}
      </span>
      <ol aria-hidden="true">
        {visible.map((entry, index) => {
          const age = visible.length - 1 - index;
          return (
            <li
              key={entry.id}
              className="simulation-log__line"
              data-expiring={age === opacityByAge.length - 1 || undefined}
              style={{ '--log-line-opacity': opacityByAge[age] } as CSSProperties}
              onAnimationEnd={(event) => {
                if (event.animationName === 'simulation-log-out') {
                  setExpiredThrough((previous) => Math.max(previous, entry.id));
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
