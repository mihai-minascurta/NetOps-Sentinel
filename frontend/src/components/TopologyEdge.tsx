import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { TopologyEdgeType } from '../topology';

export default function TopologyEdge({
  id,
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

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={data?.readOnly ? 'topology-edge__path is-read-only' : 'topology-edge__path'}
      />
      {data?.active && <path d={path} className="topology-edge__motion" aria-hidden="true" />}
      {label && (
        <EdgeLabelRenderer>
          <span
            className={[
              'topology-edge__label',
              label === 'scrape' && 'topology-edge__label--scrape',
              data?.dimmed && 'topology-edge__label--dimmed',
            ].filter(Boolean).join(' ')}
            style={{ left: labelX, top: labelY }}
          >
            {label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
