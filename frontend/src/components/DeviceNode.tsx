
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

const categories: Record<DeviceKind, { label: string; key: string }> = {
  router: { label: 'Infrastructure', key: 'infrastructure' },
  monitoring: { label: 'Monitoring', key: 'monitoring' },
  alert: { label: 'Monitoring', key: 'monitoring' },
  backend: { label: 'Application', key: 'application' },
  investigation: { label: 'Application', key: 'application' },
  evidence: { label: 'Application', key: 'application' },
  ai: { label: 'AI', key: 'ai' },
  database: { label: 'Storage', key: 'storage' },
  mcp: { label: 'AI', key: 'ai' },
};

export default function DeviceNode({
  data,
  selected,
}: NodeProps<DeviceNodeType>) {
  const Icon = icons[data.kind];
  const category = categories[data.kind];

  return (
    <>
      <Handle type="target" id="in-left" position={Position.Left} />
      <Handle type="target" id="in-top" position={Position.Top} />
      <Handle type="target" id="in-bottom" position={Position.Bottom} />

      <div className={`net-node net-node--${category.key} ${selected ? 'is-selected' : ''}`}>
        <span className="net-node__category">{category.label}</span>
        <div className="net-node__main">
          <div className="net-node__icon">
            <Icon size={20} strokeWidth={1.5} />
          </div>

          <div className="net-node__content">
            <strong>{data.title}</strong>
            <span>{data.subtitle}</span>
          </div>
        </div>
      </div>

      <Handle type="source" id="out-right" position={Position.Right} />
      <Handle type="source" id="out-top" position={Position.Top} />
      <Handle type="source" id="out-bottom" position={Position.Bottom} />
    </>
  );
}
