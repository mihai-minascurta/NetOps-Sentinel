import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getPulseTimeline, pulseCycleMs, routerIds, type EdgeActivity, type TopologyStatus } from './topology';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const pauseMs = 3000;

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function prefersReducedMotion() {
  return window.matchMedia(reducedMotionQuery).matches;
}

function usePulseCycle(firing: boolean, animated: boolean, staggerMs = 0) {
  const [startsAt, setStartsAt] = useState<number | null>(null);

  useEffect(() => {
    if (!animated && startsAt === null) return;
    if (animated && !firing && startsAt === null) return;

    const delay = !animated ? 0 : startsAt === null ? staggerMs :
      Math.max(0, startsAt + pulseCycleMs + (firing ? pauseMs : 0) - performance.now());
    const timer = window.setTimeout(() => setStartsAt(animated && firing ? performance.now() : null), delay);
    return () => window.clearTimeout(timer);
  }, [animated, firing, staggerMs, startsAt]);

  return animated ? startsAt : null;
}

export function useTopologyPulses(snapshot: TopologyStatus | null, fitReady: boolean) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const available = Boolean(snapshot?.alerts_available && fitReady);
  const animated = available && !reducedMotion;
  const r1Firing = available && Boolean(snapshot?.active_alerts.some((alert) => alert.status === 'firing' && alert.node === 'r1'));
  const r2Firing = available && Boolean(snapshot?.active_alerts.some((alert) => alert.status === 'firing' && alert.node === 'r2'));
  const r1Start = usePulseCycle(r1Firing, animated);
  const r2Start = usePulseCycle(r2Firing, animated, 250);

  return useMemo(() => {
    const activities = new Map<string, EdgeActivity>();
    const starts = { r1: r1Start, r2: r2Start };
    const firing = { r1: r1Firing, r2: r2Firing };

    for (const router of routerIds) {
      const start = starts[router];
      const highlight = reducedMotion && firing[router];
      if (start === null && !highlight) continue;

      for (const { edgeIds, startsAt } of getPulseTimeline(router, start ?? 0)) {
        for (const edge of edgeIds) {
          const activity = activities.get(edge) ?? {};
          if (highlight) activity.highlight = true;
          if (start !== null) {
            activity.pulses ??= [];
            activity.pulses.push({ id: `${router}-${start}`, startsAt });
          }
          activities.set(edge, activity);
        }
      }
    }

    return activities;
  }, [r1Start, r2Start, r1Firing, r2Firing, reducedMotion]);
}
