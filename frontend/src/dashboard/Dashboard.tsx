import NetOpsWordmark from '../components/NetOpsWordmark';
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
  return (
    <article className="dash-router">
      <div className="dash-router__heading">
        <h3>{router.title}</h3>
        <span className="dash-router__status" data-tone={router.health.tone}>
          <i className="dash-indicator" aria-hidden="true" />{router.health.label}
        </span>
      </div>
      <div className="dash-router__metrics">
        <UtilizationBar router={router.title} label="CPU" metric={router.cpu} />
        <UtilizationBar router={router.title} label="RAM" metric={router.ram} />
      </div>
    </article>
  );
}

function DashboardDiagnosis({ diagnosis }: { diagnosis: DashboardSample['diagnosis'] }) {
  return (
    <section className="dash-panel dash-diagnosis" aria-labelledby="dashboard-diagnosis-title">
      <h2 id="dashboard-diagnosis-title">AI diagnosis</h2>
      <p className="dash-diagnosis__summary">{diagnosis.summary}</p>
      <dl>
        <div className="dash-diagnosis__wide">
          <dt>Probable cause</dt>
          <dd>{diagnosis.probable_cause}</dd>
        </div>
        <div><dt>Confidence</dt><dd className="dash-diagnosis__confidence">{diagnosis.confidence}</dd></div>
        <div><dt>Evidence IDs</dt><dd className="dash-diagnosis__ids">{diagnosis.evidence_ids.map((id) => `#${id}`).join(', ')}</dd></div>
        <div className="dash-diagnosis__wide">
          <dt>Recommendations</dt>
          <dd><ul>{diagnosis.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}</ul></dd>
        </div>
      </dl>
      <p className="dash-diagnosis__tools">MCP Tools · read-only</p>
    </section>
  );
}

export default function Dashboard({ sample }: { sample: DashboardSample }) {
  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div className="dash-brand">
          <h1 aria-label="NetOps Sentinel"><NetOpsWordmark className="dash-brand__wordmark" /></h1>
          <p>Interactive System Architecture</p>
        </div>
        <div className="dash-header-actions">
          <span>Sample data</span>
          <button className="dash-simulate" type="button" disabled>Simulate incident</button>
        </div>
      </header>

      <main className="dashboard__grid">
        <aside className="dashboard__left" aria-label="Infrastructure and activity">
          <section className="dash-infrastructure" aria-labelledby="dashboard-infrastructure-title">
            <h2 id="dashboard-infrastructure-title">Infrastructure</h2>
            <div className="dash-router-list">
              {sample.routers.map((router) => <RouterCard key={router.id} router={router} />)}
            </div>
          </section>
          <section className="dash-panel dash-activity" aria-labelledby="dashboard-activity-title">
            <h2 id="dashboard-activity-title">Activity log</h2>
            <ol className="dash-activity__entries">
              {sample.activity.map((entry) => <li key={entry.id}>{entry.message}</li>)}
            </ol>
          </section>
        </aside>

        <DashboardPipeline pipeline={sample.pipeline} />

        <aside className="dashboard__right" aria-label="Incidents and diagnosis">
          <section className="dash-panel dash-incidents" aria-labelledby="dashboard-incidents-title">
            <h2 id="dashboard-incidents-title">Incidents</h2>
            <ul className="dash-incidents__list">
              {sample.incidents.map((incident) => (
                <li className="dash-incident" key={incident.id}>
                  <div className="dash-incident__heading">
                    <h3>{incident.title}</h3>
                    <span className="dash-incident__severity" data-tone={incident.severity}>{incident.severity}</span>
                  </div>
                  <p className="dash-incident__meta">
                    <span>{incident.router.toUpperCase()} · <span className="dash-incident__age">{incident.age}</span></span>
                    <span>{incident.status}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <DashboardDiagnosis diagnosis={sample.diagnosis} />
        </aside>
      </main>

      <footer className="dashboard__footer">
        <span>OCI · R1 + R2 · Docker · Prometheus · AI</span>
        <span>Read-only mode · No automatic remediation</span>
      </footer>
    </div>
  );
}
