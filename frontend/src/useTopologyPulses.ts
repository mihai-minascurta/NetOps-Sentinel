import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  getPulseTimeline,
  getPulseTiming,
  routerIds,
  type EdgeActivity,
  type TopologyStatus,
} from './topology';
import { getSimulationFrame, type SimulationTimeline } from './topologySimulationTimeline';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function prefersReducedMotion() {
  return window.matchMedia(reducedMotionQuery).matches;
}

function usePulseCycle(firing: boolean, animated: boolean, session: number, staggerMs = 0) {
  const [cycle, setCycle] = useState<{ session: number; startsAt: number } | null>(null);
  const startsAt = cycle?.session === session ? cycle.startsAt : null;
  const { cycleMs, pauseMs } = getPulseTiming();

  useEffect(() => {
    if (startsAt === null && !(animated && firing)) return;

    const delay = !animated ? 0 : startsAt === null ? staggerMs :
      Math.max(0, startsAt + cycleMs + (firing ? pauseMs : 0) - performance.now());
    const timer = window.setTimeout(() => setCycle(animated && firing
      ? { session, startsAt: performance.now() }
      : null), delay);
    return () => window.clearTimeout(timer);
  }, [animated, cycleMs, firing, pauseMs, session, staggerMs, startsAt]);

  return animated ? startsAt : null;
}

type PlaybackClock = { session: number; startedAt: number; elapsedMs: number };

function useSimulationPlayback(
  timeline: SimulationTimeline | null,
  fitReady: boolean,
  session: number,
  reducedMotion: boolean,
) {
  const [clock, setClock] = useState<PlaybackClock | null>(null);
  const activeClock = clock?.session === session ? clock : null;
  const elapsedMs = reducedMotion ? timeline?.durationMs ?? 0 : activeClock?.elapsedMs ?? 0;
  const frame = useMemo(() => getSimulationFrame(timeline, elapsedMs), [elapsedMs, timeline]);
  const nextBoundary = Math.min(frame?.current?.endsAtMs ?? Infinity, frame?.nextLogAtMs ?? Infinity);

  useEffect(() => {
    if (!timeline) return;

    // One clock advances both step boundaries and journal entries alongside the SVG pulses.
    let delay: number;
    let advance: () => PlaybackClock;
    if (reducedMotion) {
      if (activeClock && activeClock.elapsedMs >= timeline.durationMs) return;
      delay = 0;
      advance = () => ({ session, startedAt: activeClock?.startedAt ?? performance.now(), elapsedMs: timeline.durationMs });
    } else if (!activeClock && fitReady) {
      delay = 0;
      advance = () => ({ session, startedAt: performance.now(), elapsedMs: 0 });
    } else if (activeClock && Number.isFinite(nextBoundary)) {
      delay = Math.max(0, Math.ceil(activeClock.startedAt + nextBoundary - performance.now()));
      advance = () => ({
        ...activeClock,
        elapsedMs: Math.max(nextBoundary, performance.now() - activeClock.startedAt),
      });
    } else {
      return;
    }

    const timer = window.setTimeout(() => setClock(advance()), delay);
    return () => window.clearTimeout(timer);
  }, [activeClock, fitReady, nextBoundary, reducedMotion, session, timeline]);

  return { frame, startedAt: activeClock?.startedAt };
}

export function useTopologyPulses(
  snapshot: TopologyStatus | null,
  fitReady: boolean,
  session: number,
  timeline: SimulationTimeline | null,
) {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false);
  const { frame, startedAt } = useSimulationPlayback(timeline, fitReady, session, reducedMotion);
  const available = Boolean(!timeline && snapshot?.alerts_available && fitReady);
  const animated = available && !reducedMotion;
  const r1Firing = available && Boolean(snapshot?.active_alerts.some((alert) => alert.status === 'firing' && alert.node === 'r1'));
  const r2Firing = available && Boolean(snapshot?.active_alerts.some((alert) => alert.status === 'firing' && alert.node === 'r2'));
  const r1Start = usePulseCycle(r1Firing, animated, session);
  const r2Start = usePulseCycle(r2Firing, animated, session, 250);
  const simulationPlaying = Boolean(frame?.current);

  const edgeActivities = useMemo(() => {
    const activities = new Map<string, EdgeActivity>();

    if (timeline) {
      if (simulationPlaying && startedAt !== undefined && !reducedMotion) {
        // Queuing the SVG animations ahead of time also keeps consecutive moves on the same edge visible.
        for (const { moves, startsAtMs, durationMs } of timeline.steps) {
          for (const { edgeId, reverse } of moves) {
            const activity = activities.get(edgeId) ?? { pulses: [] };
            activity.pulses?.push({
              id: `${session}-${startsAtMs}-${edgeId}`,
              startsAt: startedAt + startsAtMs,
              durationMs,
              reverse,
            });
            activities.set(edgeId, activity);
          }
        }
      }
      return activities;
    }

    const starts = { r1: r1Start, r2: r2Start };
    const firing = { r1: r1Firing, r2: r2Firing };

    for (const router of routerIds) {
      const start = starts[router];
      const highlight = reducedMotion && firing[router];
      if (start === null && !highlight) continue;

      for (const { edgeIds, startsAt, durationMs } of getPulseTimeline(router, start ?? 0)) {
        for (const edge of edgeIds) {
          const activity = activities.get(edge) ?? {};
          if (highlight) activity.highlight = true;
          if (start !== null) {
            activity.pulses ??= [];
            activity.pulses.push({ id: `${router}-${start}`, startsAt, durationMs });
          }
          activities.set(edge, activity);
        }
      }
    }

    return activities;
  }, [r1Firing, r1Start, r2Firing, r2Start, reducedMotion, session, simulationPlaying, startedAt, timeline]);

  return { edgeActivities, simulationFrame: frame };
}
