import mqtt from 'mqtt';

import { getDevice, updateDevice } from '../services/device.services.ts';

type BroadcastFunction = (deviceId: string, data: { event: string; data: any }) => void;
let broadcast: BroadcastFunction;

export const initMQTT = (setBroadcast: BroadcastFunction) => {
    broadcast = setBroadcast;

    const client = mqtt.connect('mqtt://localhost:1883', {
        username: 'backend',
        password: 'backend_secret'
    });

    client.on('connect', () => {
        console.log('MQTT connecté');

        client.subscribe('devices/+/telemetry');
        client.subscribe('devices/+/status');
    });

  client.on('message', async (topic, message) => {
        const payload = JSON.parse(message.toString());

        const match = topic.match(/^devices\/(.+)\/(telemetry|status)$/);
        if (!match) return;

        const deviceId = match[1] ?? '';
        const type = match[2] ?? '';

        const device = await getDevice(deviceId);
        if (!device) return;

        await updateDevice(deviceId, {
            lastSeen: new Date(),
            deviceState: {
                update: {
                    ...payload,
                }
            }
        });

        device.lastSeen = Date.now();
        device.deviceState = { ...device.deviceState, ...payload };

        console.log(`${type} reçu`, deviceId, payload);

        // push websocket
        broadcast(deviceId, {
            event: type,
            data: payload
        });
  });

  return client;
}
