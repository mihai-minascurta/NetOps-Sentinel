import type { CSSProperties } from 'react';
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

import { entranceDelayByDevice, type DeviceKind, type DeviceNodeType } from '../topology';

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

const categories: Record<DeviceKind, string> = {
  router: 'Infrastructure',
  monitoring: 'Monitoring',
  alert: 'Monitoring',
  backend: 'Application',
  investigation: 'Application',
  evidence: 'Application',
  ai: 'AI',
  database: 'Storage',
  mcp: 'AI',
};

export default function DeviceNode({
  id,
  data,
  selected,
}: NodeProps<DeviceNodeType>) {
  const Icon = icons[data.kind];
  const category = categories[data.kind];
  const style = { '--entrance-delay': `${entranceDelayByDevice.get(id) ?? 0}ms` } as CSSProperties;
  const className = [
    'net-node',
    id === 'backend' && 'net-node--key',
    selected && 'is-selected',
  ].filter(Boolean).join(' ');

  return (
    <>
      <Handle type="target" id="in-left" position={Position.Left} />
      <Handle type="target" id="in-top" position={Position.Top} />
      <Handle type="target" id="in-bottom" position={Position.Bottom} />

      <div className={className} style={style}>
        <span className="net-node__category">{category}</span>
        <div className="net-node__main">
          <div className="net-node__icon">
            <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <strong className="net-node__title">{data.title}</strong>
        </div>
        <span className="net-node__subtitle">{data.subtitle}</span>
      </div>

      <Handle type="source" id="out-right" position={Position.Right} />
      <Handle type="source" id="out-top" position={Position.Top} />
      <Handle type="source" id="out-bottom" position={Position.Bottom} />
    </>
  );
}
