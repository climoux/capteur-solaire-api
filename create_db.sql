CREATE TYPE fan_mode AS ENUM ('manual', 'auto');
CREATE TYPE event_type AS ENUM ('connect', 'disconnect', 'error', 'telemetry');
CREATE TYPE command_type AS ENUM ('temperature', 'fan', 'trapdoor');
CREATE TYPE command_status AS ENUM ('pending', 'sent', 'ack');

CREATE TABLE devices (
    device_id VARCHAR(20) PRIMARY KEY UNIQUE, -- identifiant unique du capteur
    device_secret TEXT NOT NULL UNIQUE,       -- token de sécurité
    last_seen TIMESTAMPTZ DEFAULT NULL,       -- dernière connexion/télémétrie
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE device_pairing (
    id SERIAL PRIMARY KEY UNIQUE,
    device_id VARCHAR(20) UNIQUE REFERENCES devices(device_id) ON DELETE CASCADE,
    code VARCHAR(4) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_device_pairing_code ON device_pairing(code);
CREATE INDEX idx_device_pairing_used ON device_pairing(used);

CREATE TABLE telemetry (
    device_id VARCHAR(20) UNIQUE REFERENCES devices(device_id) ON DELETE CASCADE,
    temperature JSONB NOT NULL,     -- { "in": 0, "out": 0, "target": 0 }
    airflow FLOAT NOT NULL,  -- flux d'air %
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (device_id, timestamp)
);
-- Index pour requêtes historiques rapides
CREATE INDEX idx_telemetry_device_time ON telemetry(device_id, timestamp DESC);

CREATE TABLE commands (
    id SERIAL PRIMARY KEY UNIQUE,
    device_id VARCHAR(20) UNIQUE REFERENCES devices(device_id) ON DELETE CASCADE,
    command_type command_type NOT NULL,         -- 'temperature', 'fan', 'trapdoor'
    payload JSONB NOT NULL,                     -- { targetTemperature: 22 } ou { mode: "auto", speed: 33 } ou { trapdoor: "open" }
    status command_status DEFAULT 'pending',    -- 'pending', 'sent', 'ack'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ DEFAULT NULL,
    ack_at TIMESTAMPTZ DEFAULT NULL             -- Acknowledgment : quand le capteur confirme l'exécution
);
-- Index pour retrouver commandes non exécutées
CREATE INDEX idx_commands_device_status ON commands(device_id, status);

CREATE TABLE device_state (
    device_id VARCHAR(20) PRIMARY KEY UNIQUE REFERENCES devices(device_id) ON DELETE CASCADE,
    temperature JSONB DEFAULT '{"in": 0, "out": 0, "target": 0}',
    airflow FLOAT,
    fan_mode fan_mode DEFAULT 'auto',
    fan_speed INT,
    trapdoor_state VARCHAR(10),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_device_state_id ON device_state(device_id);

CREATE TABLE device_logs (
    id SERIAL PRIMARY KEY UNIQUE,
    device_id VARCHAR(20) UNIQUE REFERENCES devices(device_id) ON DELETE CASCADE,
    event_type event_type DEFAULT NULL, -- 'connect', 'disconnect', 'error', 'telemetry'
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_device_logs_device_time ON device_logs(device_id, created_at DESC);
