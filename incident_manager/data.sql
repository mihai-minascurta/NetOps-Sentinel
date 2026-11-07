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