import { useRef } from 'react';
import { useInternalNodes, useViewportStore } from '@xyflow/react';
import { isRouterId, routerIds } from '../topology';
import { simulationFaultIds, simulationFaults, type SimulationAction, type SimulationState } from '../topologySimulation';

type Props = {
  id: string;
  state: SimulationState;
  onAction: (action: SimulationAction) => void;
  onClose: () => void;
};

const edgeInset = 12;
const routerClearance = 8;

export default function TopologySimulationControls({ id, state, onAction, onClose }: Props) {
  const stopButton = useRef<HTMLButtonElement>(null);
  const routers = useInternalNodes(routerIds);
  const { transform: [x, , zoom], width } = useViewportStore();
  const running = state.phase === 'running';
  const setup = state.phase === 'armed' ? state.setup : null;
  const mode = running ? state.mode : setup?.mode;
  const choice = running ? state.scenario : setup?.mode === 'custom' ? setup : null;

  const routerRight = Math.max(0, ...routers.map(({ internals, measured }) =>
    x + (internals.positionAbsolute.x + (measured.width ?? 0)) * zoom,
  ));
  const maxInlineSize = width - edgeInset - Math.max(edgeInset, routerRight + routerClearance);
  if (maxInlineSize <= 0) return null;

  return (
    <section
      id={id}
      className="topology-simulation"
      style={{ insetInlineEnd: edgeInset, maxInlineSize }}
      aria-label="Simulation controls"
      data-topology-simulation
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;

        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="topology-simulation__group" role="group" aria-labelledby={`${id}-mode`}>
        <span id={`${id}-mode`}>Mode</span>
        <div className="topology-simulation__segments">
          <button
            type="button"
            aria-pressed={mode === 'random'}
            disabled={running}
            onClick={() => {
              if (mode !== 'random') onAction({ type: 'configure', setup: { mode: 'random' } });
            }}
          >
            Random
          </button>
          <button
            type="button"
            aria-pressed={mode === 'custom'}
            disabled={running}
            onClick={() => {
              if (mode !== 'custom') onAction({
                type: 'configure',
                setup: { mode: 'custom', router: 'r1', fault: 'prometheus_up' },
              });
            }}
          >
            Custom
          </button>
        </div>
      </div>

      {mode === 'custom' && choice && (
        <>
          <label className="topology-simulation__field">
            <span>Router</span>
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
          <label className="topology-simulation__field">
            <span>Fault</span>
            <select
              value={choice.fault}
              title={simulationFaults[choice.fault].label}
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
        </>
      )}

      <div className="topology-simulation__group">
        <button
          className="topology-simulation__start"
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
      {mode === 'random' && (
        <output className="topology-simulation__choice" aria-live="polite">
          {running && `${state.scenario.router.toUpperCase()} · ${simulationFaults[state.scenario.fault].label}`}
        </output>
      )}
    </section>
  );
}
