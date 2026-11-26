import { useEffect, useRef, type ReactNode } from 'react';

type Props = {
  className: string;
  path: string;
  startsAt: number;
  durationMs: number;
  reverse?: boolean;
  children?: ReactNode;
};

export default function MovingPulse({ className, path, startsAt, durationMs, reverse, children }: Props) {
  const motion = useRef<SVGAnimateMotionElement>(null);
  const visibility = useRef<SVGSetElement>(null);
  const scheduledStart = useRef<number | null>(null);

  useEffect(() => {
    if (scheduledStart.current === startsAt) return;

    const delay = (startsAt - performance.now()) / 1000;
    if (delay <= -durationMs / 1000) return;

    scheduledStart.current = startsAt;
    motion.current?.beginElementAt(delay);
    visibility.current?.beginElementAt(delay);
  }, [startsAt, durationMs]);

  const duration = `${durationMs}ms`;
  return (
    <g className={className} visibility="hidden" aria-hidden="true">
      <set ref={visibility} attributeName="visibility" to="visible" begin="indefinite" dur={duration} />
      <animateMotion
        ref={motion}
        path={path}
        begin="indefinite"
        dur={duration}
        rotate={reverse ? 'auto-reverse' : 'auto'}
        calcMode={reverse ? 'linear' : undefined}
        keyPoints={reverse ? '1;0' : undefined}
        keyTimes={reverse ? '0;1' : undefined}
      />
      {children ?? <circle r="5" />}
    </g>
  );
}
