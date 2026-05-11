import { WebSocket } from 'ws';

import { getDevice } from '../services/device.services.js';

import { verifyHash } from './hash.js';

const clients = new Map<string, Set<WebSocket>>();

export const registerWS = (fastify: any) => {
    fastify.get('/ws/devices/:deviceId', { websocket: true }, async (conn: any, req: any) => {
        const { deviceId }: { deviceId: string } = req.params;
        const { token }: { token?: string } = req.query;

        const socket: WebSocket = conn.socket;
        if (!socket) return;

        const device = await getDevice(deviceId);
        const verify = (device?.device_secret && token) ? await verifyHash(device.device_secret, token) : false;

        if (!device) {
            console.log(`[WS] Connection rejected: Device ${deviceId} not found in database.`);
            socket.close();
            return;
        }

        if (!verify) {
            console.log(`[WS] Connection rejected: Invalid token for device ${deviceId}.`);
            socket.close();
            return;
        }

        if (!clients.has(deviceId)) {
            clients.set(deviceId, new Set());
        }

        clients.get(deviceId)?.add(socket);

        console.log(clients)

        socket.send(JSON.stringify({
            event: 'connected',
            deviceId
        }));

        socket.on('close', () => {
            clients.get(deviceId)?.delete(socket);
            if (clients.get(deviceId)?.size === 0) {
                clients.delete(deviceId);
            }
        });

        socket.on('error', (err) => {
            console.error(`WebSocket error for device ${deviceId}:`, err);
            clients.get(deviceId)?.delete(socket);
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