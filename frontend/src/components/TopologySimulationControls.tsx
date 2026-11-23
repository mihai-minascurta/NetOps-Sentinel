import { useRef } from 'react';
import { isRouterId, routerIds } from '../topology';
import { simulationFaultIds, simulationFaults, type SimulationAction, type SimulationState } from '../topologySimulation';
import type { SimulationSpeed } from '../topologySimulationTimeline';

type Props = {
  id: string;
  state: SimulationState;
  speed: SimulationSpeed;
  stepLabel?: string;
  onAction: (action: SimulationAction) => void;
  onSpeedChange: (speed: SimulationSpeed) => void;
  onClose: () => void;
};

export default function TopologySimulationControls({ id, state, speed, stepLabel, onAction, onSpeedChange, onClose }: Props) {
  const stopButton = useRef<HTMLButtonElement>(null);
  const running = state.phase === 'running';
  const setup = state.phase === 'armed' ? state.setup : null;
  const mode = running ? state.mode : setup?.mode;
  const choice = running ? state.scenario : setup?.mode === 'custom' ? setup : null;
  const summary = running
    ? `${state.scenario.router.toUpperCase()} · ${simulationFaults[state.scenario.fault].label} · ${stepLabel ?? 'Starting'}`
    : setup ? 'Ready · R1 UP · R2 UP' : 'R1 UP · R2 UP · Choose a mode';

  return (
    <section
      id={id}
      className="topology-simulation"
      aria-label="Simulation controls"
      data-topology-simulation
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;

        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="topology-simulation__controls">
        <div className="topology-simulation__group" role="radiogroup" aria-labelledby={`${id}-mode`}>
          <span id={`${id}-mode`}>Mode</span>
          <label>
            <input
              type="radio"
              name="simulation-mode"
              checked={mode === 'random'}
              disabled={running}
              onChange={() => onAction({ type: 'configure', setup: { mode: 'random' } })}
            />
            Random
          </label>
          <label>
            <input
              type="radio"
              name="simulation-mode"
              checked={mode === 'custom'}
              disabled={running}
              onChange={() => onAction({
                type: 'configure',
                setup: { mode: 'custom', router: 'r1', fault: 'prometheus_up' },
              })}
            />
            Custom
          </label>
        </div>

        {mode === 'custom' && choice && (
          <div className="topology-simulation__group">
            <label>
              Router
              <select
                value={choice.router}
                disabled={running}
                onChange={(event) => {
                  const router = event.currentTarget.value;
                  if (isRouterId(router)) onAction({
                    type: 'configure', setup: { mode: 'custom', router, fault: choice.fault },
                  });
                }}
              >
                {routerIds.map((router) => <option key={router} value={router}>{router.toUpperCase()}</option>)}
              </select>
            </label>
            <label>
              Fault
              <select
                value={choice.fault}
                disabled={running}
                onChange={(event) => {
                  const fault = simulationFaultIds.find((id) => id === event.currentTarget.value);
                  if (fault) onAction({
                    type: 'configure', setup: { mode: 'custom', router: choice.router, fault },
                  });
                }}
              >
                {simulationFaultIds.map((fault) => <option key={fault} value={fault}>{simulationFaults[fault].label}</option>)}
              </select>
            </label>
          </div>
        )}

        <div className="topology-simulation__group" role="radiogroup" aria-label="Simulation speed">
          <span aria-hidden="true">Speed</span>
          {(['normal', 'fast'] as const).map((option) => (
            <label key={option}>
              <input
                type="radio"
                name="simulation-speed"
                checked={speed === option}
                disabled={running}
                onChange={() => onSpeedChange(option)}
              />
              {option === 'normal' ? 'Normal' : 'Fast'}
            </label>
          ))}
        </div>

        <div className="topology-simulation__group">
          <button
            type="button"
            disabled={!setup}
            onClick={() => {
              onAction({ type: 'start', at: new Date().toISOString() });
              stopButton.current?.focus();
            }}
          >
            Start
          </button>
          <button
            ref={stopButton}
            type="button"
            onClick={() => onAction({ type: 'reset' })}
          >
            Stop / Reset
          </button>
        </div>
        <span className="topology-simulation__summary" role="status">{summary}</span>
      </div>
    </section>
  );
}
