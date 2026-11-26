import { useId, useMemo, useRef, useState } from 'react';
import { Radar } from 'lucide-react';
import { transitionSimulation, type SimulationAction, type SimulationState } from '../topologySimulation';
import { getSimulationTimeline } from '../topologySimulationTimeline';
import { useTopologyPulses } from '../useTopologyPulses';
import { DashboardDiagnosis, DashboardEvidencePanel, DashboardIncidents, DashboardInfrastructure } from './DashboardPanels';
import DashboardPipeline from './DashboardPipeline';
import DashboardSimulationControls from './DashboardSimulationControls';
import type { DashboardSample } from './dashboardSample';
import { getDashboardRouters, getDashboardSimulationPanels } from './dashboardSimulation';
import './dashboard.css';

function SimulationClock({ step, elapsedMs, durationMs }: { step: string; elapsedMs: number; durationMs: number }) {
  const seconds = Math.floor(elapsedMs / 1000);
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const remainder = String(seconds % 60).padStart(2, '0');
  const progress = durationMs > 0 ? 100 * elapsedMs / durationMs : 0;

  return (
    <div className="dash-clock">
      <span className="dash-clock__title">Simulation</span>
      <div className="dash-clock__reading">
        <span className="dash-clock__step" role="status">{step}</span>
        <time dateTime={`PT${seconds}S`}>{minutes}:{remainder}</time>
      </div>
      <progress className="dash-clock__progress" max={100} value={progress} aria-label="Simulation progress" />
    </div>
  );
}

export default function Dashboard({ sample }: { sample: DashboardSample }) {
  const simulationPanelId = useId();
  const simulationToggle = useRef<HTMLButtonElement>(null);
  const [simulation, setSimulation] = useState<SimulationState>({ phase: 'idle' });
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [pulseSession, setPulseSession] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const simulationActive = simulation.phase !== 'idle';
  const routers = getDashboardRouters(sample.routers, simulation);
  const scenario = simulation.phase === 'running' ? simulation.scenario : null;
  const timeline = useMemo(() => scenario ? getSimulationTimeline(scenario.router, scenario.fault) : null, [scenario]);
  const { edgeActivities, simulationFrame } = useTopologyPulses(null, true, pulseSession, timeline, { trackElapsed: true });
  const { activity, incidents, diagnosis, diagnosisIncidentNumber, evidence } = getDashboardSimulationPanels(sample, simulation, simulationFrame);
  const diagnosisIncident = incidents.find(({ id }) => id === diagnosisIncidentNumber);

  function closeSimulation() {
    setSimulationOpen(false);
    simulationToggle.current?.focus({ preventScroll: true });
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

  function toggleSelection(id: string) {
    setSelectedId((selected) => selected === id ? null : id);
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
        <div className="dash-header-brand">
          <div className="dash-brand">
            <span className="dash-brand__logo" aria-hidden="true"><Radar size={21} /></span>
            <div>
              <h1>NetOps Sentinel</h1>
              <p>Interactive System Architecture</p>
            </div>
          </div>
          <span className="dash-header-mode" role="status">
            {simulationFrame?.current ? '[ SIMULATION ACTIVE ]' : '[ SAMPLE DATA ]'}
          </span>
        </div>

        <SimulationClock
          step={simulationFrame ? simulationFrame.current?.label ?? 'Complete' : 'Idle'}
          elapsedMs={simulationFrame?.elapsedMs ?? 0}
          durationMs={timeline?.durationMs ?? 0}
        />

        <div className="dash-header-actions">
          <button
            ref={simulationToggle}
            className="dash-simulate"
            type="button"
            aria-expanded={simulationOpen}
            aria-controls={simulationPanelId}
            onClick={toggleSimulation}
          >
            Simulate incident
          </button>
        </div>
      </header>

      <main className="dashboard__grid">
        <DashboardInfrastructure
          routers={routers}
          activity={activity}
          simulationActive={simulationActive}
          selectedId={selectedId}
          onSelect={toggleSelection}
        />

        <DashboardPipeline
          pipeline={sample.pipeline}
          routers={routers}
          simulationActive={simulationActive}
          simulationFrame={simulationFrame}
          edgeActivities={edgeActivities}
          selectedId={selectedId}
          onSelect={toggleSelection}
        />

        <aside className="dashboard__right" aria-label="Simulator, incidents, diagnosis and evidence">
          <div>
            <div className="dash-simulation-reveal" data-open={simulationOpen} inert={!simulationOpen}>
              <div className="dash-simulation-reveal__body">
                <DashboardSimulationControls
                  id={simulationPanelId}
                  open={simulationOpen}
                  state={simulation}
                  onAction={handleSimulationAction}
                  onClose={closeSimulation}
                />
              </div>
            </div>
            <DashboardIncidents incidents={incidents} />
          </div>
          <DashboardDiagnosis diagnosis={diagnosis} incident={diagnosisIncident} />
          <DashboardEvidencePanel evidence={evidence} />
        </aside>
      </main>

      <footer className="dashboard__footer">
        <span>OCI · R1 + R2 · Docker · Prometheus · AI</span>
        <span>Read-only environment · No automatic remediation</span>
      </footer>
    </div>
  );
}
