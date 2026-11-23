import type { NodeStatus } from '../topology';

export default function TopologyStatusBadge({ status, faultLabel }: { status: NodeStatus | 'received'; faultLabel?: string }) {
  return (
    <span
      className={faultLabel ? 'topology-status-badge topology-status-badge--fault' : 'topology-status-badge'}
      data-live-status={status}
    >
      <span>{faultLabel ?? status.toUpperCase()}</span>
    </span>
  );
}
