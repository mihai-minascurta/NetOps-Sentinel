import { useEffect, useRef, type CSSProperties } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { entranceDelayByDevice, simulationQueryRoute, type TopologyEdgeType } from '../topology';

function MovingPulse({ path, startsAt, durationMs, reverse }: {
  path: string; startsAt: number; durationMs: number; reverse?: boolean;
}) {
  const motion = useRef<SVGAnimateMotionElement>(null);
  const visibility = useRef<SVGSetElement>(null);
  const scheduledStart = useRef<number | null>(null);

  useEffect(() => {
    if (scheduledStart.current === startsAt) return;

    const delay = (startsAt - performance.now()) / 1000;
    if (delay <= -durationMs / 1000) return;

    scheduledStart.current = startsAt;
    motion.current?.beginElementAt(delay);
    visibility.current?.beginElementAt(delay);
  }, [startsAt, durationMs]);

  const duration = `${durationMs}ms`;
  return (
    <g className="topology-pulse" visibility="hidden" aria-hidden="true">
      <set ref={visibility} attributeName="visibility" to="visible" begin="indefinite" dur={duration} />
      <animateMotion
        ref={motion}
        path={path}
        begin="indefinite"
        dur={duration}
        calcMode={reverse ? 'linear' : undefined}
        keyPoints={reverse ? '1;0' : undefined}
        keyTimes={reverse ? '0;1' : undefined}
      />
      <circle r="5" />
    </g>
  );
}

export default function TopologyEdge({
  id,
  source,
  target,
  data,
  label,
  markerStart,
  markerEnd,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
}: EdgeProps<TopologyEdgeType>) {
  const [stepPath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    offset: 12,
  });
  const { bottomY, leftX, returnY } = simulationQueryRoute;
  const path = data.kind === 'query'
    ? `M ${sourceX} ${sourceY} V ${bottomY} H ${leftX} V ${returnY} H ${targetX} V ${targetY}`
    : stepPath;
  const routeClassName = data.routeState && `is-${data.routeState}`;
  const simulationClassName = data.simulationState && `is-${data.simulationState}`;
  const dotted = data.kind !== 'flow';
  const dashed = dotted || data.readOnly;
  const labelPosition = data.labelAnchor ?? (
    data.kind === 'data'
      ? { x: labelX + (data.labelSide === 'left' ? -10 : 10), y: labelY }
      : { x: labelX, y: labelY - 16 }
  );
  const targetEntrance = entranceDelayByDevice.get(target) ?? 0;
  const sourceEntrance = dotted ? (entranceDelayByDevice.get(source) ?? 0) : 0;
  const entranceDelay = Math.max(0, Math.max(targetEntrance, sourceEntrance) - 30);
  const entranceStyle = { '--entrance-delay': `${entranceDelay}ms` } as CSSProperties;

  return (
    <>
      {data.activity?.highlight && <path className="topology-pulse-static" d={path} aria-hidden="true" />}
      <BaseEdge
        id={id}
        path={path}
        markerStart={markerStart}
        markerEnd={markerEnd}
        pathLength={dashed ? undefined : 1}
        style={entranceStyle}
        className={[
          'topology-edge__path', routeClassName, simulationClassName, dashed && 'is-dashed', dotted && 'is-data',
        ].filter(Boolean).join(' ')}
      />
      {data.activity?.pulses?.map((pulse) => (
        <MovingPulse
          key={pulse.id}
          path={path}
          startsAt={pulse.startsAt}
          durationMs={pulse.durationMs}
          reverse={pulse.reverse}
        />
      ))}
      {label && (
        <EdgeLabelRenderer>
          <span
            data-edge-id={id}
            className={[
              'topology-edge__label',
              data.labelSide && `topology-edge__label--${data.labelSide}`,
              label === 'scrape' && 'topology-edge__label--scrape',
              routeClassName,
              simulationClassName,
            ].filter(Boolean).join(' ')}
            style={{ ...entranceStyle, left: labelPosition.x, top: labelPosition.y }}
          >
            {data.labelLines ? data.labelLines.map((line) => <span key={line}>{line}</span>) : label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
