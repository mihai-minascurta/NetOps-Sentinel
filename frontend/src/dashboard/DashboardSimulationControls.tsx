import { useEffect, useRef } from 'react';
import { Play, RotateCcw, Shuffle, SlidersHorizontal, X } from 'lucide-react';
import { isRouterId, routerIds } from '../topology';
import {
  simulationFaultIds, simulationFaults, type FaultId, type SimulationAction, type SimulationState,
} from '../topologySimulation';

function faultLabel(id: FaultId) {
  const { label, evaluation } = simulationFaults[id];
  return evaluation === null ? `${label} (synthetic)` : label;
}

type Props = {
  id: string;
  state: SimulationState;
  progress: string | null;
  onAction: (action: SimulationAction) => void;
  onClose: () => void;
};

export default function DashboardSimulationControls({ id, state, progress, onAction, onClose }: Props) {
  const panel = useRef<HTMLElement>(null);
  const stopButton = useRef<HTMLButtonElement>(null);
  const running = state.phase === 'running';
  const setup = state.phase === 'armed' ? state.setup : null;
  const mode = running ? state.mode : setup?.mode;
  const choice = running ? state.scenario : setup?.mode === 'custom' ? setup : null;

  useEffect(() => {
    panel.current?.focus();
  }, []);

  return (
    <section ref={panel} id={id} className="dash-panel dash-simulation" tabIndex={-1} aria-labelledby={`${id}-title`}>
      <div className="dash-simulation__heading">
        <h2 id={`${id}-title`}>Incident simulator</h2>
        <button className="dash-simulation__close" type="button" aria-label="Close simulation controls" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="dash-simulation__modes" role="group" aria-label="Simulation mode">
        <button
          type="button"
          aria-pressed={mode === 'random'}
          disabled={running}
          onClick={() => onAction({ type: 'configure', setup: { mode: 'random' } })}
        >
          <Shuffle size={18} aria-hidden="true" />
          Random
        </button>
        <button
          type="button"
          aria-pressed={mode === 'custom'}
          disabled={running}
          onClick={() => {
            if (mode !== 'custom') {
              onAction({ type: 'configure', setup: { mode: 'custom', router: 'r1', fault: 'prometheus_up' } });
            }
          }}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          Custom
        </button>
      </div>

      {mode === 'custom' && choice && (
        <div className="dash-simulation__settings">
          <label className="dash-simulation__field">
            <span>Router</span>
            <select
              value={choice.router}
              disabled={running}
              onChange={(event) => {
                const router = event.currentTarget.value;
                if (isRouterId(router)) onAction({ type: 'configure', setup: { mode: 'custom', router, fault: choice.fault } });
              }}
            >
              {routerIds.map((router) => <option key={router} value={router}>{router.toUpperCase()}</option>)}
            </select>
          </label>
          <label className="dash-simulation__field">
            <span>Fault</span>
            <select
              value={choice.fault}
              disabled={running}
              onChange={(event) => {
                const fault = simulationFaultIds.find((id) => id === event.currentTarget.value);
                if (fault) onAction({ type: 'configure', setup: { mode: 'custom', router: choice.router, fault } });
              }}
            >
              {simulationFaultIds.map((id) => <option key={id} value={id}>{faultLabel(id)}</option>)}
            </select>
          </label>
        </div>
      )}

      <output className="dash-simulation__choice">
        {running && mode === 'random' && `${state.scenario.router.toUpperCase()} · ${faultLabel(state.scenario.fault)}`}
      </output>
      <output className="dash-simulation__progress">{progress}</output>

      <div className="dash-simulation__actions">
        <button
          className="dash-simulation__start"
          type="button"
          disabled={!setup}
          onClick={() => {
            onAction({ type: 'start', at: new Date().toISOString() });
            stopButton.current?.focus();
          }}
        >
          <Play size={14} aria-hidden="true" />
          Start
        </button>
        <button ref={stopButton} type="button" onClick={() => onAction({ type: 'reset' })}>
          <RotateCcw size={14} aria-hidden="true" />
          Stop / Reset
        </button>
      </div>
    </section>
  );
}
