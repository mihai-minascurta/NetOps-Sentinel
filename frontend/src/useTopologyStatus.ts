import { useEffect, useState } from 'react';
import { isRouterId, type NodeStatus, type TopologyAlert, type TopologyStatus } from './topology';

const pollIntervalMs = 5000;
const requestDeadlineMs = 4000;
const idle = { snapshot: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isNodeStatus(value: unknown): value is NodeStatus {
  return value === 'up' || value === 'down' || value === 'unknown';
}

function isAlert(value: unknown): value is TopologyAlert {
  return isRecord(value)
    && typeof value.fingerprint === 'string'
    && typeof value.alertname === 'string'
    && typeof value.severity === 'string'
    && (value.node === null || isRouterId(value.node))
    && (value.status === 'firing' || value.status === 'resolved')
    && isTimestamp(value.starts_at);
}

function isSnapshot(value: unknown): value is TopologyStatus {
  return isRecord(value)
    && isTimestamp(value.generated_at)
    && isRecord(value.nodes)
    && isNodeStatus(value.nodes.r1)
    && isNodeStatus(value.nodes.r2)
    && typeof value.alerts_available === 'boolean'
    && Array.isArray(value.active_alerts)
    && value.active_alerts.every(isAlert)
    && (value.alerts_available || value.active_alerts.length === 0);
}

export function useTopologyStatus(enabled: boolean) {
  const pollingEnabled = import.meta.env.DEV && enabled;
  const [result, setResult] = useState<{ snapshot: TopologyStatus | null }>(idle);

  useEffect(() => {
    if (!pollingEnabled) return;

    const baseUrl = (import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:8000').replace(/\/+$/, '');
    let timer: number | undefined;
    let current: AbortController | null = null;

    async function poll() {
      if (document.hidden || current) return;

      const request = new AbortController();
      current = request;
      const startedAt = performance.now();
      const deadline = window.setTimeout(() => request.abort(), requestDeadlineMs);

      try {
        const response = await fetch(`${baseUrl}/api/topology/status`, { signal: request.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Topology request failed');
        const data: unknown = await response.json();
        if (!isSnapshot(data)) throw new Error('Invalid topology response');
        if (current === request) setResult({ snapshot: data });
      } catch {
        if (current === request) setResult({ snapshot: null });
      } finally {
        window.clearTimeout(deadline);
        if (current === request) {
          current = null;
          if (!document.hidden) {
            timer = window.setTimeout(poll, Math.max(0, pollIntervalMs - (performance.now() - startedAt)));
          }
        }
      }
    }

    function stopPolling() {
      window.clearTimeout(timer);
      const request = current;
      current = null;
      request?.abort();
    }

    function onVisibilityChange() {
      if (document.hidden) stopPolling();
      else void poll();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    void poll();
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stopPolling();
    };
  }, [pollingEnabled]);

  return pollingEnabled ? result : idle;
}
