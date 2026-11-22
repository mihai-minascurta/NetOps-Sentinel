import { Panel, useViewport } from '@xyflow/react';
import { Maximize, Minus, Plus } from 'lucide-react';

type CanvasControlsProps = {
  defaultZoom: number | null;
  minimumZoom: number | undefined;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
};

export default function CanvasControls({
  defaultZoom,
  minimumZoom,
  onZoomIn,
  onZoomOut,
  onFit,
}: CanvasControlsProps) {
  const { zoom } = useViewport();
  const buttons = [
    { label: 'Zoom in', Icon: Plus, disabled: defaultZoom === null || zoom >= defaultZoom, onClick: onZoomIn },
    { label: 'Zoom out', Icon: Minus, disabled: minimumZoom === undefined || zoom <= minimumZoom, onClick: onZoomOut },
    { label: 'Fit view', Icon: Maximize, disabled: defaultZoom === null, onClick: onFit },
  ];

  return (
    <Panel position="bottom-left" className="react-flow__controls" role="group" aria-label="Canvas controls">
      {buttons.map(({ label, Icon, disabled, onClick }) => (
        <button
          key={label}
          type="button"
          className="react-flow__controls-button"
          aria-label={label}
          title={label}
          disabled={disabled}
          aria-disabled={disabled}
          onClick={onClick}
        >
          <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      ))}
    </Panel>
  );
}
