import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import NetOpsWordmark from '../components/NetOpsWordmark';
import { transitionSimulation, type SimulationAction, type SimulationState } from '../topologySimulation';
import { getSimulationTimeline } from '../topologySimulationTimeline';
import { useTopologyPulses } from '../useTopologyPulses';
import DashboardPipeline from './DashboardPipeline';
import DashboardSimulationControls from './DashboardSimulationControls';
import type { DashboardRouter, DashboardSample } from './dashboardSample';
import { getDashboardRouters, getDashboardSimulationPanels } from './dashboardSimulation';
import './dashboard.css';

function UtilizationBar({ router, label, metric }: { router: string; label: string; metric: DashboardRouter['cpu'] }) {
  const { value } = metric;
  return (
    <div className="dash-metric" data-tone={metric.tone}>
      <div className="dash-metric__caption">
        <span>{label}</span>
        <strong>{value === null ? <span title="Unavailable">—</span> : `${value}%`}</strong>
      </div>
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

function RouterCard({ router, simulationActive }: { router: DashboardRouter; simulationActive: boolean }) {
  const { health, fault } = router;
  return (
    <article className="dash-router" data-simulation-tone={simulationActive ? fault?.severity ?? health.tone : undefined}>
      <div className="dash-router__heading">
        <h3>{router.title}</h3>
        <div className="dash-router__badges">
          <span className="dash-router__status" data-tone={health.tone}>
            <i className="dash-indicator" aria-hidden="true" />{simulationActive ? health.label.toUpperCase() : health.label}
          </span>
          {fault && <span className="dash-router__status" data-tone={fault.severity}>{fault.badge}</span>}
        </div>
      </div>
      <div className="dash-router__metrics">
        <UtilizationBar router={router.title} label="CPU" metric={router.cpu} />
        <UtilizationBar router={router.title} label="RAM" metric={router.ram} />
      </div>
    </article>
  );
}

function DashboardActivity({ entries, simulationActive }: { entries: DashboardSample['activity']; simulationActive: boolean }) {
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
    <section className="dash-panel dash-activity" aria-labelledby="dashboard-activity-title">
      <h2 id="dashboard-activity-title">Activity log</h2>
      <ol
        ref={log}
        className="dash-activity__entries"
        aria-live={simulationActive ? 'polite' : undefined}
        aria-relevant="additions"
        tabIndex={entries.length > 0 ? 0 : undefined}
        onScroll={({ currentTarget }) => {
          if (!simulationActive) return;
          followsLatest.current = currentTarget.scrollHeight - currentTarget.clientHeight - currentTarget.scrollTop < 3;
        }}
      >
        {entries.length > 0 ? entries.map((entry) => <li key={entry.id}>{entry.message}</li>) : (
          <li className="dash-empty">No activity yet.</li>
        )}
      </ol>
    </section>
  );
}

function DashboardDiagnosis({ diagnosis, simulationActive }: {
  diagnosis: DashboardSample['diagnosis'] | null;
  simulationActive: boolean;
}) {
  return (
    <section className="dash-panel dash-diagnosis" aria-labelledby="dashboard-diagnosis-title">
      <h2 id="dashboard-diagnosis-title">AI diagnosis</h2>
      {diagnosis ? (
        <>
          <p className="dash-diagnosis__summary">{diagnosis.summary}</p>
          <dl>
            <div className="dash-diagnosis__wide">
              <dt>Probable cause</dt>
              <dd>{diagnosis.probable_cause}</dd>
            </div>
            <div><dt>Confidence</dt><dd className="dash-diagnosis__confidence">{diagnosis.confidence}</dd></div>
            <div><dt>Evidence IDs</dt><dd className="dash-diagnosis__ids">{diagnosis.evidence_ids.map((id) => `#${id}`).join(', ')}</dd></div>
            <div className="dash-diagnosis__wide">
              <dt>Recommendations</dt>
              <dd><ul>{diagnosis.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul></dd>
            </div>
          </dl>
          <p className="dash-diagnosis__tools">{simulationActive && 'Simulated result · '}MCP Tools · read-only</p>
        </>
      ) : <p className="dash-empty">No diagnosis yet.</p>}
    </section>
  );
}

export default function Dashboard({ sample }: { sample: DashboardSample }) {
  const simulationPanelId = useId();
  const simulationToggle = useRef<HTMLButtonElement>(null);
  const [simulation, setSimulation] = useState<SimulationState>({ phase: 'idle' });
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [pulseSession, setPulseSession] = useState(0);
  const simulationActive = simulation.phase !== 'idle';
  const routers = getDashboardRouters(sample.routers, simulation);
  const scenario = simulation.phase === 'running' ? simulation.scenario : null;
  const timeline = useMemo(() => scenario ? getSimulationTimeline(scenario.router, scenario.fault) : null, [scenario]);
  const { edgeActivities, simulationFrame } = useTopologyPulses(null, true, pulseSession, timeline);
  const { activity, incidents, diagnosis } = getDashboardSimulationPanels(sample, simulation, simulationFrame);

  function closeSimulation() {
    setSimulationOpen(false);
    simulationToggle.current?.focus();
  }

  function handleSimulationAction(action: SimulationAction) {
    const next = transitionSimulation(simulation, action);
    if (next.phase === 'running' && simulation.phase !== 'running') setPulseSession((session) => session + 1);
    setSimulation(next);
    if (action.type === 'reset') closeSimulation();
  }

  function toggleSimulation() {
    if (simulationOpen) {
      closeSimulation();
      return;
    }

    handleSimulationAction({ type: 'arm', at: new Date().toISOString() });
    setSimulationOpen(true);
  }

  return (
    <div
      className="dashboard"
      onKeyDown={(event) => {
        if (!simulationOpen || event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        closeSimulation();
      }}
    >
      <header className="dashboard__header">
        <div className="dash-brand">
          <h1 aria-label="NetOps Sentinel"><NetOpsWordmark className="dash-brand__wordmark" /></h1>
          <p>Interactive System Architecture</p>
        </div>
        <div className="dash-header-actions">
          <span role="status">{simulationActive ? 'Simulation' : 'Sample data'}</span>
          <button
            ref={simulationToggle}
            className="dash-simulate"
            type="button"
            aria-expanded={simulationOpen}
            aria-controls={simulationOpen ? simulationPanelId : undefined}
            onClick={toggleSimulation}
          >
            Simulate incident
          </button>
        </div>
      </header>

      <main className="dashboard__grid">
        <aside className="dashboard__left" aria-label="Infrastructure and activity">
          <section className="dash-infrastructure" aria-labelledby="dashboard-infrastructure-title">
            <h2 id="dashboard-infrastructure-title">Infrastructure</h2>
            <div className="dash-router-list">
              {routers.map((router) => <RouterCard key={router.id} router={router} simulationActive={simulationActive} />)}
            </div>
          </section>
          <DashboardActivity entries={activity} simulationActive={simulationActive} />
        </aside>

        <DashboardPipeline
          pipeline={sample.pipeline}
          routers={routers}
          simulationActive={simulationActive}
          simulationFrame={simulationFrame}
          edgeActivities={edgeActivities}
        />

        <aside className="dashboard__right" aria-label="Simulation, incidents and diagnosis">
          {simulationOpen && (
            <DashboardSimulationControls
              id={simulationPanelId}
              state={simulation}
              progress={simulationFrame ? simulationFrame.current?.label ?? 'Simulation complete' : null}
              onAction={handleSimulationAction}
              onClose={closeSimulation}
            />
          )}
          <section className="dash-panel dash-incidents" aria-labelledby="dashboard-incidents-title">
            <h2 id="dashboard-incidents-title">Incidents</h2>
            {incidents.length === 0 ? <p className="dash-empty">No incidents yet.</p> : (
              <ul className="dash-incidents__list">
                {incidents.map((incident) => (
                  <li className="dash-incident" key={incident.id}>
                    <div className="dash-incident__heading">
                      <h3>{incident.title}</h3>
                      <span className="dash-incident__severity" data-tone={incident.severity}>{incident.severity}</span>
                    </div>
                    <p className="dash-incident__meta">
                      <span>{incident.router.toUpperCase()} · <span className="dash-incident__age">{incident.age}</span></span>
                      <span>{incident.status}</span>
                    </p>
                    {incident.investigation && (
                      <p className="dash-incident__investigation">
                        {incident.investigation.status === 'running' ? 'Investigation running' : 'Investigation complete'}
                        {' · '}{incident.investigation.evidenceCount} saved
                        {incident.investigation.skippedCount > 0 && ` · ${incident.investigation.skippedCount} skipped`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <DashboardDiagnosis diagnosis={diagnosis} simulationActive={simulationActive} />
        </aside>
      </main>

      <footer className="dashboard__footer">
        <span>OCI · R1 + R2 · Docker · Prometheus · AI</span>
        <span>Read-only mode · No automatic remediation</span>
      </footer>
    </div>
  );
}
