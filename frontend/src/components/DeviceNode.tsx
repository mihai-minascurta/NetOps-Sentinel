
import {
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react';

import {
  Server,
  Activity,
  Bell,
  Workflow,
  Search,
  FileText,
  BrainCircuit,
  Database,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import type { DeviceKind, DeviceNodeType } from '../topology';

const icons: Record<DeviceKind, LucideIcon> = {
  router: Server,
  monitoring: Activity,
  alert: Bell,
  backend: Workflow,
  investigation: Search,
  evidence: FileText,
  ai: BrainCircuit,
  database: Database,
  mcp: Wrench,
};

export default function DeviceNode({
  data,
  selected,
}: NodeProps<DeviceNodeType>) {
  const Icon = icons[data.kind];

  return (
    <>
      <Handle type="target" id="in-left" position={Position.Left} />
      <Handle type="target" id="in-top" position={Position.Top} />
      <Handle type="target" id="in-bottom" position={Position.Bottom} />

      <div className={`net-node net-node--${data.kind} ${selected ? 'is-selected' : ''}`}>
        <div className="net-node__icon">
          <Icon size={23} strokeWidth={1.8} />
        </div>

        <div className="net-node__content">
          <strong>{data.title}</strong>
          <span>{data.subtitle}</span>
        </div>
      </div>

      <Handle type="source" id="out-right" position={Position.Right} />
      <Handle type="source" id="out-top" position={Position.Top} />
      <Handle type="source" id="out-bottom" position={Position.Bottom} />
    </>
  );
}
