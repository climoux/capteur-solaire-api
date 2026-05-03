const clients = new Map();

import { getDevice } from '../services/device.services.js';

export const registerWS = (fastify: any) => {
    fastify.get('/ws/devices/:deviceId', { websocket: true }, async (conn: any, req: any) => {
        const { deviceId }: { deviceId: string } = req.params;
        const { token }: { token?: string } = req.query;
        
        const device = await getDevice(deviceId);

        if (!device || device.device_secret !== token) {
            conn.socket.close();
            return;
        }

        if (!clients.has(deviceId)) {
            clients.set(deviceId, new Set());
        }

        clients.get(deviceId)?.add(conn.socket);

        conn.socket.send(JSON.stringify({
            event: 'connected',
            deviceId
        }));

        conn.socket.on('close', () => {
            clients.get(deviceId)?.delete(conn.socket);
        });
    });
}

export const broadcast = (deviceId: string, payload: any) => {
    const sockets = clients.get(deviceId);
    if (!sockets) return;

    const msg = JSON.stringify(payload);

    for (const s of sockets) {
        if (s.readyState === WebSocket.OPEN) {
            s.send(msg);
        }
    }
}