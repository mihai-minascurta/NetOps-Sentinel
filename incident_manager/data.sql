PRAGMA foreign_keys = ON;

CREATE TABLE incidents (
    id INTEGER PRIMARY KEY,
    status TEXT NOT NULL CHECK (
        status IN (
            'open',
            'investigating',
            'resolved',
            'closed'
        )
    ),
    severity TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    root_cause TEXT
);

CREATE TABLE alerts (
    id INTEGER PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    alertname TEXT NOT NULL,
    router TEXT,
    state TEXT NOT NULL CHECK (
        state IN ('firing', 'resolved')
    ),
    started_at TEXT NOT NULL,
    ended_at TEXT
);

CREATE TABLE incident_alerts (
    incident_id INTEGER NOT NULL,
    alert_id INTEGER NOT NULL,
    PRIMARY KEY (incident_id, alert_id),
    FOREIGN KEY (incident_id) REFERENCES incidents (id),
    FOREIGN KEY (alert_id) REFERENCES alerts (id)
);

INSERT INTO incidents (status, severity, opened_at, closed_at, root_cause)
VALUES ('open', 'critical', '2026-11-07T20:00:00Z', NULL, NULL); --already inserted

INSERT INTO alerts (fingerprint, alertname, router, state, started_at, ended_at)
VALUES ('r1-node-down-001', 'NodeExporterDown', 'R1', 'firing', '2026-11-07T20:00:00Z', NULL); --already inserted

INSERT INTO incident_alerts (incident_id, alert_id)
VALUES (1, 1); --already inserted

SELECT incident_id , alert_id  FROM incident_alerts;

SELECT incidents.id , incidents.status , alerts.alertname , alerts.router
FROM incidents
JOIN incident_alerts
    ON incidents.id = incident_alerts.incident_id
JOIN alerts
    ON incident_alerts.alert_id = alerts.id
WHERE incident_alerts.incident_id = 1;

UPDATE incidents
SET status = 'investigating'
WHERE id = 1;

UPDATE incidents
SET root_cause = 'Node Exporter service stopped on R1'
WHERE id = 1;

UPDATE incidents
SET status = 'closed' , closed_at = datetime('now')
WHERE id = 1;

#################### TWO MORE DB TABLES , investigations and evidences

CREATE TABLE investigations (
    id          INTEGER NOT NULL PRIMARY KEY,
    incident_id INTEGER NOT NULL,
    status      TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE TABLE evidences (
    id               INTEGER PRIMARY KEY,
    investigation_id INTEGER NOT NULL,
    check_type       TEXT NOT NULL,
    status           TEXT NOT NULL CHECK(status IN ('success', 'failed', 'error')),
    result           TEXT NOT NULL,
    collected_at     TEXT NOT NULL,
    FOREIGN KEY (investigation_id) REFERENCES investigations(id)
);

SELECT a.router
FROM incidents AS i
JOIN incident_alerts AS ia
    ON i.id = ia.incident_id
JOIN alerts AS a
    ON a.id = ia.alert_id

ALTER TABLE investigations
ADD COLUMN ai_diagnosis TEXT;
