import { useLayoutEffect, useRef } from 'react';
import { Check, Circle, Minus, TriangleAlert, X } from 'lucide-react';
import type {
  DashboardActivityEntry, DashboardDiagnosisData, DashboardEvidence, DashboardIncident, DashboardRouter,
} from './dashboardSample';
import { getDashboardRouterTone } from './dashboardSimulation';

function UtilizationBar({ router, label, metric }: { router: string; label: string; metric: DashboardRouter['cpu'] }) {
  const { value } = metric;
  return (
    <div className="dash-metric" data-tone={metric.tone}>
      <strong className="dash-metric__value">
        {value === null ? <span title="Unavailable">—</span> : `${value}%`}
      </strong>
      <span className="dash-metric__label">{label}</span>
      {value === null ? <div className="dash-metric__track" aria-hidden="true" /> : (
        <div
          className="dash-metric__track"
          role="meter"
          aria-label={`${router} ${label}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
        >
          <span style={{ width: `${value}%` }} />
        </div>
      )}
    </div>
  );
}

function RouterCard({ router, selected, onSelect }: { router: DashboardRouter; selected: boolean; onSelect: () => void }) {
  const { health, fault, ram } = router;
  const highMemory = ram.value !== null && ram.value > 85;
  const tone = getDashboardRouterTone(router);
  const status = fault?.badge ?? (health.label === 'Up' ? 'Active' : 'DOWN');

  return (
    <article className="dash-router" data-tone={tone} data-selected={selected || undefined}>
      <div className="dash-router__heading">
        <h3>{router.title}</h3>
        <span className="dash-router__status" data-tone={fault ? 'critical' : health.tone}>
          <i className="dash-indicator" aria-hidden="true" />{status}
        </span>
      </div>
      <div className="dash-router__metrics">
        <UtilizationBar router={router.title} label="CPU" metric={router.cpu} />
        <UtilizationBar router={router.title} label="RAM" metric={highMemory ? { ...ram, tone: 'warning' } : ram} />
      </div>
      <button
        className="dash-router__select"
        type="button"
        aria-label={`Select ${router.title}`}
        aria-pressed={selected}
        onClick={onSelect}
      />
    </article>
  );
}

const activityLabels: Record<DashboardActivityEntry['kind'], string> = {
  anomaly: 'Anomaly:',
  alert: 'Alert:',
  incident: 'Incident',
  investigation: 'Investigation:',
  ai: 'AI:',
};

function DashboardActivity({ entries, simulationActive }: { entries: readonly DashboardActivityEntry[]; simulationActive: boolean }) {
  const log = useRef<HTMLOListElement>(null);
  const followsLatest = useRef(true);

  useLayoutEffect(() => {
    const list = log.current;
    if (!list) return;

    if (!simulationActive) {
      followsLatest.current = true;
      list.scrollTop = 0;
    } else if (followsLatest.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [entries.length, simulationActive]);

  return (
    <ol
      ref={log}
      className="dash-activity"
      data-simulation={simulationActive || undefined}
      aria-label="Activity log"
      aria-live={simulationActive ? 'polite' : undefined}
      aria-relevant="additions"
      tabIndex={entries.length > 0 ? 0 : undefined}
      onScroll={({ currentTarget }) => {
        if (!simulationActive) return;
        followsLatest.current = currentTarget.scrollHeight - currentTarget.clientHeight - currentTarget.scrollTop < 3;
      }}
    >
      {entries.length === 0 && <li className="dash-empty">No activity yet.</li>}
      {entries.map(({ id, kind, time, dateTime, message, incidentNumber }) => (
        <li className="dash-activity__entry" data-kind={kind} key={id}>
          <time dateTime={dateTime ?? time}>{time}</time>
          <span className="dash-activity__point" aria-hidden="true" />
          <span>
            <strong>{activityLabels[kind]}{incidentNumber !== undefined && ` #${incidentNumber}`}</strong>{' '}{message}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function DashboardInfrastructure({ routers, activity, simulationActive, selectedId, onSelect }: {
  routers: readonly DashboardRouter[];
  activity: readonly DashboardActivityEntry[];
  simulationActive: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="dash-panel dashboard__left" aria-labelledby="dashboard-infrastructure-title">
      <h2 className="dash-section-title" id="dashboard-infrastructure-title">Node status &amp; activity log</h2>
      <div className="dash-router-list">
        {routers.map((router) => (
          <RouterCard key={router.id} router={router} selected={router.id === selectedId} onSelect={() => onSelect(router.id)} />
        ))}
      </div>
      <DashboardActivity entries={activity} simulationActive={simulationActive} />
    </aside>
  );
}

function IncidentSparkline({ values }: { values: readonly number[] }) {
  const min = Math.min(...values);
  const spread = Math.max(...values) - min || 1;
  const points = values.map((value, index) => {
    const x = 2 + index * 108 / Math.max(1, values.length - 1);
    const y = 29 - (value - min) * 24 / spread;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="dash-incident__sparkline" viewBox="0 0 112 34" aria-hidden="true">
      <path className="dash-incident__sparkline-grid" d="M2 17H110 M2 29H110" />
      <polygon points={`2,32 ${points} 110,32`} />
      <polyline points={points} />
    </svg>
  );
}

export function DashboardIncidents({ incidents }: { incidents: readonly DashboardIncident[] }) {
  return (
    <section className="dash-panel dash-incidents" aria-labelledby="dashboard-incidents-title">
      <h2 className="dash-section-title" id="dashboard-incidents-title">Active incidents</h2>
      {incidents.length === 0 ? <p className="dash-empty">No incidents yet.</p> : (
        <ul className="dash-incidents__list">
          {incidents.map((incident) => (
            <li className="dash-incident" key={incident.id}>
              <div className="dash-incident__heading">
                <TriangleAlert size={16} data-tone={incident.severity} aria-hidden="true" />
                <h3>{incident.title} <span>[{incident.router.toUpperCase()}]</span></h3>
                <IncidentSparkline values={incident.sparkline} />
              </div>
              {incident.investigation && (
                <p className="dash-incident__investigation">
                  {incident.investigation.status === 'running' ? 'Investigation running' : 'Investigation complete'}
                  {' · '}{incident.investigation.evidenceCount} saved
                  {incident.investigation.skippedCount > 0 && ` · ${incident.investigation.skippedCount} skipped`}
                </p>
              )}
              <div className="dash-incident__meta">
                <span>{incident.age}</span>
                <span className="dash-incident__status" data-tone={incident.status === 'resolved' || incident.status === 'closed' ? 'ok' : 'warning'}>
                  {incident.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DashboardDiagnosis({ diagnosis, incident }: {
  diagnosis: DashboardDiagnosisData | null;
  incident: DashboardIncident | undefined;
}) {
  return (
    <section className="dash-panel dash-diagnosis" aria-labelledby="dashboard-diagnosis-title">
      <h2 className="dash-section-title" id="dashboard-diagnosis-title">AI diagnosis</h2>
      {diagnosis && incident ? (
        <>
          <h3 className="dash-diagnosis__reference">Diagnosis for incident #{incident.id}</h3>
          <p className="dash-diagnosis__subject">{incident.title} on {incident.router.toUpperCase()}</p>
          <dl className="dash-diagnosis__detail">
            <div><dt>Insight</dt><dd>{diagnosis.summary}</dd></div>
            <div><dt>Probable cause</dt><dd>{diagnosis.probable_cause}</dd></div>
            <div>
              <dt>Recommendations</dt>
              <dd><ul>{diagnosis.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul></dd>
            </div>
          </dl>
          <dl className="dash-diagnosis__metadata">
            <div><dt>Confidence</dt><dd className="dash-diagnosis__confidence">{diagnosis.confidence}</dd></div>
            <div><dt>Evidence IDs</dt><dd>{diagnosis.evidence_ids.map((id) => `#${id}`).join(', ')}</dd></div>
          </dl>
        </>
      ) : <p className="dash-empty">Waiting for evidence…</p>}
    </section>
  );
}

const evidencePresentation = {
  collected: { Icon: Check, status: 'Collected' },
  fault: { Icon: X, status: 'Fault' },
  pending: { Icon: Circle, status: 'Pending' },
  skipped: { Icon: Minus, status: 'Skipped' },
} satisfies Record<DashboardEvidence['status'], { Icon: typeof Check; status: string }>;

export function DashboardEvidencePanel({ evidence }: { evidence: readonly DashboardEvidence[] }) {
  return (
    <section className="dash-panel dash-evidence" aria-labelledby="dashboard-evidence-title">
      <h2 className="dash-section-title" id="dashboard-evidence-title">Evidence collected</h2>
      <ul className="dash-evidence__list">
        {evidence.map(({ id, label, status }) => {
          const { Icon, status: text } = evidencePresentation[status];
          return (
            <li key={id} className="dash-evidence__item" data-evidence={status}>
              <Icon size={14} aria-hidden="true" />
              <span>{label}</span>
              <span className="dash-evidence__status">{text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
