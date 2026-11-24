import { Activity, BrainCircuit, ClipboardList, Layers, ListChecks, Network, Server, ShieldCheck, Zap } from 'lucide-react';
import DashboardPipeline from './DashboardPipeline';
import type { DashboardSample } from './dashboardSample';
import './dashboard.css';

type Router = DashboardSample['routers'][number];

function UtilizationBar({ router, label, metric }: { router: string; label: string; metric: Router['cpu'] }) {
  return (
    <div className="dash-metric" data-tone={metric.tone}>
      <div className="dash-metric__caption"><span>{label}</span><strong>{metric.value}%</strong></div>
      <div
        className="dash-metric__track"
        role="meter"
        aria-label={`${router} ${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={metric.value}
      >
        <span style={{ width: `${metric.value}%` }} />
      </div>
    </div>
  );
}

function RouterCard({ router }: { router: Router }) {
  const historyWidth = 160;
  const historyHeight = 26;
  const points = router.history.map((value, index) => {
    const x = index * historyWidth / Math.max(1, router.history.length - 1);
    const y = historyHeight - 2 - value / 100 * (historyHeight - 4);
    return `${x},${y}`;
  }).join(' ');

  return (
    <article className="dash-router">
      <div className="dash-router__heading">
        <span className="dash-router__icon"><Server aria-hidden="true" /></span>
        <h3>{router.title}</h3>
        <span className="dash-badge" data-tone={router.health.tone}>
          <i className="dash-indicator" aria-hidden="true" />{router.health.label}
        </span>
      </div>
      <p className="dash-router__subtitle">{router.subtitle}</p>
      <div className="dash-router__metrics">
        <UtilizationBar router={router.title} label="CPU" metric={router.cpu} />
        <UtilizationBar router={router.title} label="RAM" metric={router.ram} />
      </div>
      <div className="dash-router__history" data-tone={router.ram.tone}>
        <span>RAM history</span>
        <svg viewBox={`0 0 ${historyWidth} ${historyHeight}`} preserveAspectRatio="none" aria-hidden="true">
          <path className="dash-sparkline__grid" d={`M0 8 H${historyWidth} M0 18 H${historyWidth}`} />
          <polygon className="dash-sparkline__area" points={`0,${historyHeight} ${points} ${historyWidth},${historyHeight}`} />
          <polyline className="dash-sparkline__line" points={points} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </article>
  );
}

function DashboardDiagnosis({ diagnosis }: { diagnosis: DashboardSample['diagnosis'] }) {
  return (
    <section className="dash-panel" aria-labelledby="dashboard-diagnosis-title">
      <div className="dash-panel__heading">
        <h2 id="dashboard-diagnosis-title"><BrainCircuit aria-hidden="true" />AI Diagnosis</h2>
      </div>
      <div className="dash-diagnosis">
        <p className="dash-diagnosis__summary">{diagnosis.summary}</p>
        <dl>
          <div className="dash-diagnosis__wide">
            <dt>Probable cause</dt>
            <dd>{diagnosis.probable_cause}</dd>
          </div>
          <div><dt>Confidence</dt><dd className="dash-diagnosis__confidence">{diagnosis.confidence}</dd></div>
          <div>
            <dt>Evidence IDs</dt>
            <dd className="dash-diagnosis__ids">{diagnosis.evidence_ids.map((id) => <span key={id}>#{id}</span>)}</dd>
          </div>
          <div className="dash-diagnosis__wide">
            <dt>Recommendations</dt>
            <dd><ul>{diagnosis.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul></dd>
          </div>
        </dl>
        <p className="dash-diagnosis__tools"><ShieldCheck aria-hidden="true" /> MCP Tools · read-only</p>
      </div>
    </section>
  );
}

export default function Dashboard({ sample }: { sample: DashboardSample }) {
  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dash-brand">
          <span className="dash-brand__mark"><Network aria-hidden="true" /></span>
          <div>
            <h1>NETOPS SENTINEL</h1>
            <p>Interactive System Architecture</p>
          </div>
        </div>
        <div className="dash-mode">
          <i className="dash-indicator" aria-hidden="true" />
          <span><strong>PROTOTYPE</strong> · Sample data</span>
        </div>
        <button className="dash-simulate" type="button" disabled><Zap aria-hidden="true" />Simulate incident</button>
      </header>

      <main className="dashboard__grid">
        <aside className="dashboard__column" aria-label="Infrastructure and services">
          <section className="dash-panel" aria-labelledby="dashboard-infrastructure-title">
            <div className="dash-panel__heading">
              <h2 id="dashboard-infrastructure-title"><Server aria-hidden="true" />Infrastructure Status</h2>
            </div>
            <div className="dash-router-list">
              {sample.routers.map((router) => <RouterCard key={router.id} router={router} />)}
            </div>
          </section>
          <section className="dash-panel" aria-labelledby="dashboard-services-title">
            <div className="dash-panel__heading">
              <h2 id="dashboard-services-title"><Layers aria-hidden="true" />Services</h2>
            </div>
            <ul className="dash-rows">
              {sample.services.map((service) => (
                <li className="dash-row" key={service.id}>
                  <span>{service.title}</span>
                  <span className="dash-row__status" data-tone={service.health.tone}>
                    <i className="dash-indicator" aria-hidden="true" />{service.health.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <div className="dashboard__center">
          <DashboardPipeline pipeline={sample.pipeline} />
          <section className="dash-panel dash-activity" aria-labelledby="dashboard-activity-title">
            <div className="dash-panel__heading">
              <h2 id="dashboard-activity-title"><Activity aria-hidden="true" />Activity log</h2>
            </div>
            <ol className="dash-activity__entries">
              {sample.activity.map((entry) => <li key={entry.id}>{entry.message}</li>)}
            </ol>
          </section>
        </div>

        <aside className="dashboard__column" aria-label="Incidents and evidence">
          <section className="dash-panel" aria-labelledby="dashboard-incidents-title">
            <div className="dash-panel__heading">
              <h2 id="dashboard-incidents-title"><ClipboardList aria-hidden="true" />Active Incidents</h2>
            </div>
            <ul className="dash-rows">
              {sample.incidents.map((incident) => (
                <li className="dash-incident" key={incident.id}>
                  <div className="dash-incident__heading">
                    <h3>{incident.title}</h3>
                    <span className="dash-badge" data-tone={incident.severity}>{incident.severity}</span>
                  </div>
                  <p className="dash-incident__meta">
                    <span>{incident.router.toUpperCase()} · {incident.age}</span>
                    <span className="dash-incident__status">{incident.status}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <DashboardDiagnosis diagnosis={sample.diagnosis} />
          <section className="dash-panel" aria-labelledby="dashboard-evidence-title">
            <div className="dash-panel__heading">
              <h2 id="dashboard-evidence-title"><ListChecks aria-hidden="true" />Evidence Collected</h2>
            </div>
            <ul className="dash-rows">
              {sample.evidence.map((item) => (
                <li className="dash-row" key={item.id} title={item.collector}>
                  <span>{item.title}</span>
                  <span className="dash-row__status" data-tone={item.health.tone}>{item.health.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </main>

      <footer className="dashboard__footer">
        <span>OCI · R1 + R2 · Docker · Prometheus · AI</span>
        <span><ShieldCheck aria-hidden="true" />Read-only mode · No automatic remediation</span>
      </footer>
    </div>
  );
}
