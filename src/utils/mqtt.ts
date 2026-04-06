import mqtt from 'mqtt';
import { devices } from '../db/deviceStore.ts';

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

  client.on('message', (topic, message) => {
        const payload = JSON.parse(message.toString());

        const match = topic.match(/^devices\/(.+)\/(telemetry|status)$/);
        if (!match) return;

        const deviceId = match[1] ?? '';
        const type = match[2] ?? '';

        const device = devices.get(deviceId);
        if (!device) return;

        device.lastSeen = Date.now();
        device.state = { ...device.state, ...payload };

        console.log(`${type} reçu`, deviceId, payload);

        // push websocket
        broadcast(deviceId, {
            event: type,
            data: payload
        });
  });

  return client;
}