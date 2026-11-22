import type { CSSProperties } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { entranceDelayByDevice, type TopologyEdgeType } from '../topology';

export default function TopologyEdge({
  id,
  target,
  data,
  label,
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
  });
  const vertical = Math.abs(targetY - sourceY) > Math.abs(targetX - sourceX);
  const entranceDelay = Math.max(0, (entranceDelayByDevice.get(target) ?? 0) - 30);
  const entranceStyle = { '--entrance-delay': `${entranceDelay}ms` } as CSSProperties;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        pathLength={data?.readOnly ? undefined : 1}
        style={entranceStyle}
        className={data?.readOnly ? 'topology-edge__path is-read-only' : 'topology-edge__path'}
      />
      {label && (
        <EdgeLabelRenderer>
          <span
            className={[
              'topology-edge__label',
              vertical && 'topology-edge__label--vertical',
              label === 'scrape' && 'topology-edge__label--scrape',
              data?.active && 'topology-edge__label--active',
              data?.dimmed && 'topology-edge__label--dimmed',
            ].filter(Boolean).join(' ')}
            style={{ ...entranceStyle, left: vertical ? labelX + 12 : labelX, top: vertical ? labelY : labelY - 16 }}
          >
            {label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
