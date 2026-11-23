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
  Mail,
  Webhook,
  ListChecks,
  ClipboardList,
  Search,
  FileText,
  BrainCircuit,
  Database,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import { entranceDelayByDevice, getAdditionalDeviceHandles, type DeviceKind, type DeviceNodeType } from '../topology';
import TopologyStatusBadge from './TopologyStatusBadge';

const icons: Record<DeviceKind, LucideIcon> = {
  router: Server,
  monitoring: Activity,
  alert: Bell,
  notification: Mail,
  backend: Webhook,
  alerts: ListChecks,
  incident: ClipboardList,
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
  notification: 'Notification',
  backend: 'Application',
  alerts: 'Application',
  incident: 'Application',
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
  const router = data.kind === 'router';
  const hub = data.kind === 'database';
  const icon = <span className="net-node__icon"><Icon size={18} strokeWidth={1.5} aria-hidden="true" /></span>;
  const style = { '--entrance-delay': `${entranceDelayByDevice.get(id) ?? 0}ms` } as CSSProperties;
  const className = [
    'net-node',
    id === 'backend' && 'net-node--key',
    hub && 'net-node--hub',
    selected && 'is-selected',
  ].filter(Boolean).join(' ');

  return (
    <>
      <Handle type="target" id="in-left" position={Position.Left} />
      <Handle type="target" id="in-right" position={Position.Right} />
      <Handle type="target" id="in-top" position={Position.Top} />
      <Handle type="target" id="in-bottom" position={Position.Bottom} />

      <div
        className={className}
        style={style}
        data-live-status={data.liveStatus}
        data-simulation-status={data.simulationStatus}
        data-simulation-current={data.simulationCurrent || undefined}
      >
        <div className="net-node__meta">
          {!router && icon}
          <span className="net-node__category">{category}</span>
          {data.liveStatus && <TopologyStatusBadge status={data.liveStatus} faultLabel={data.simulatedFault?.badge} />}
        </div>
        <div className="net-node__main">
          {router && icon}
          <strong className="net-node__title">{data.title}</strong>
        </div>
        <span className="net-node__subtitle">{data.subtitle}</span>
        {id === 'prometheus' && data.simulationStatus === 'visited' && <TopologyStatusBadge status="received" />}
      </div>

      <Handle type="source" id="out-right" position={Position.Right} />
      <Handle type="source" id="out-left" position={Position.Left} />
      <Handle type="source" id="out-top" position={Position.Top} />
      <Handle type="source" id="out-bottom" position={Position.Bottom} />
      {getAdditionalDeviceHandles(id, import.meta.env.DEV).map(({ id, type, position, offset }) => (
        <Handle key={id} id={id} type={type} position={position} style={{ left: offset }} />
      ))}
    </>
  );
}
