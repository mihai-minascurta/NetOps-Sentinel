import { routerIds, type RouterId, type TopologyStatus } from '../topology';

type Props = {
  snapshot: TopologyStatus;
  onChange: (update: (current: TopologyStatus) => TopologyStatus) => void;
};

export default function TopologyDemoControls({ snapshot, onChange }: Props) {
  function toggleStatus(router: RouterId) {
    const now = new Date().toISOString();
    onChange((current) => ({
      ...current,
      generated_at: now,
      nodes: { ...current.nodes, [router]: current.nodes[router] === 'up' ? 'down' : 'up' },
    }));
  }

  function toggleAlert(router: RouterId) {
    const now = new Date().toISOString();
    onChange((current) => {
      const firing = current.active_alerts.some((alert) => alert.node === router && alert.status === 'firing');
      const activeAlerts = current.active_alerts.filter((alert) => alert.node !== router);
      if (!firing) {
        activeAlerts.push({
          fingerprint: `demo-${router}`,
          alertname: 'DemoAlert',
          severity: 'warning',
          node: router,
          status: 'firing',
          starts_at: now,
        });
      }
      return { ...current, generated_at: now, active_alerts: activeAlerts };
    });
  }

  return (
    <details className="topology-demo">
      <summary>Demo controls</summary>
      {routerIds.map((router) => {
        const name = router.toUpperCase();
        const firing = snapshot.active_alerts.some((alert) => alert.node === router && alert.status === 'firing');
        return (
          <div key={router} className="topology-demo__row" role="group" aria-label={name}>
            <button type="button" onClick={() => toggleStatus(router)} aria-label={`Toggle ${name} status`}>
              {name} {snapshot.nodes[router].toUpperCase()}
            </button>
            <button type="button" onClick={() => toggleAlert(router)} aria-pressed={firing}>
              {name} alert
            </button>
          </div>
        );
      })}
    </details>
  );
}
