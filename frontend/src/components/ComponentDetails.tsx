import type { Ref } from 'react';
import { X } from 'lucide-react';
import { componentMetadata, componentPorts, getComponentConnections, type DeviceNodeType } from '../topology';

type ComponentDetailsProps = {
  device: DeviceNodeType;
  panelRef: Ref<HTMLElement>;
  onClose: () => void;
};

export default function ComponentDetails({ device, panelRef, onClose }: ComponentDetailsProps) {
  const { title, subtitle, description } = device.data;
  const { role, technology } = componentMetadata[device.id];
  const port = componentPorts[device.id];
  const { inputs, outputs } = getComponentConnections(device.id);

  return (
    <aside ref={panelRef} className="details-panel" aria-labelledby="component-details-title">
      <div className="details-top">
        <span>Component details</span>
        <button type="button" onClick={onClose} aria-label="Close details">
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      <h2 id="component-details-title">{title}</h2>
      <p className="details-subtitle">{subtitle}</p>

      <dl className="details-facts">
        <div>
          <dt>Role in the system</dt>
          <dd>{role}</dd>
        </div>
        {technology !== title && technology !== subtitle && (
          <div>
            <dt>Technology</dt>
            <dd>{technology}</dd>
          </div>
        )}
        {port !== undefined && (
          <div>
            <dt>Port</dt>
            <dd><code>{port}</code></dd>
          </div>
        )}
      </dl>

      <section className="details-section">
        <h3>Connected components</h3>
        <dl className="details-connections">
          {([['Inputs', inputs], ['Outputs', outputs]] as const).map(([direction, connections]) => (
            <div key={direction}>
              <dt>{direction}</dt>
              <dd>
                {connections.length > 0 ? (
                  <ul>
                    {connections.map(({ id, title, label }) => (
                      <li key={id}>
                        <span>{title}</span>
                        {label && <code>{label}</code>}
                      </li>
                    ))}
                  </ul>
                ) : '—'}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="details-section">
        <h3>How it works</h3>
        <p>{description}</p>
      </section>

      <p className="details-note">
        Architecture reference
      </p>
    </aside>
  );
}
