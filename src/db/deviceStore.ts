export type PayloadType = {
    temperature?: {
        in: number;
        out: number;
        target: number;
    };
    airFlow?: number;
};

export const devices = new Map(); // Remplacer par BDD PostgreSQL

// Exemple device (capteur)
devices.set('abc123', {
    deviceId: 'abc123',
    token: 'supersecret',
    lastSeen: null,
    state: {} as PayloadType
})