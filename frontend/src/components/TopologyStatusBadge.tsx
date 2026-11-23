import type { NodeStatus } from '../topology';

export default function TopologyStatusBadge({ status }: { status: NodeStatus }) {
  return (
    <span className="topology-status-badge" data-live-status={status}>
      {status.toUpperCase()}
    </span>
  );
}
