import { useEffect, useRef, type CSSProperties } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { entranceDelayByDevice, pulseSegmentMs, type TopologyEdgeType } from '../topology';

function MovingPulse({ path, startsAt }: { path: string; startsAt: number }) {
  const motion = useRef<SVGAnimateMotionElement>(null);
  const visibility = useRef<SVGSetElement>(null);

  useEffect(() => {
    const delay = (startsAt - performance.now()) / 1000;
    if (delay <= -pulseSegmentMs / 1000) return;

    motion.current?.beginElementAt(delay);
    visibility.current?.beginElementAt(delay);
  }, [startsAt]);

  const duration = `${pulseSegmentMs}ms`;
  return (
    <g className="topology-pulse" visibility="hidden" aria-hidden="true">
      <set ref={visibility} attributeName="visibility" to="visible" begin="indefinite" dur={duration} />
      <animateMotion ref={motion} path={path} begin="indefinite" dur={duration} />
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
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    offset: 12,
  });
  const routeClassName = data.routeState && `is-${data.routeState}`;
  const dataEdge = data.kind === 'data';
  const dashed = dataEdge || data.readOnly;
  const labelPosition = data.labelAnchor ?? (
    dataEdge ? { x: labelX + (data.labelSide === 'left' ? -10 : 10), y: labelY } : { x: labelX, y: labelY - 16 }
  );
  const targetEntrance = entranceDelayByDevice.get(target) ?? 0;
  const sourceEntrance = dataEdge ? (entranceDelayByDevice.get(source) ?? 0) : 0;
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
        className={['topology-edge__path', routeClassName, dashed && 'is-dashed', dataEdge && 'is-data'].filter(Boolean).join(' ')}
      />
      {data.activity?.pulses?.map((pulse) => (
        <MovingPulse key={pulse.id} path={path} startsAt={pulse.startsAt} />
      ))}
      {label && (
        <EdgeLabelRenderer>
          <span
            data-edge-id={id}
            className={[
              'topology-edge__label',
              dataEdge && `topology-edge__label--${data.labelSide}`,
              label === 'scrape' && 'topology-edge__label--scrape',
              routeClassName,
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
