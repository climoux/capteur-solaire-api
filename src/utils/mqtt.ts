import mqtt from 'mqtt';
import crypto from "crypto";

import { insertDevice } from '../services/device.services.ts';
import { getDevice, updateDevice } from '../services/device.services.ts';

import { generateCode } from './generateCode.ts';

type BroadcastFunction = (deviceId: string, data: { event: string; data: any }) => void;
let broadcast: BroadcastFunction;

export const initMQTT = (setBroadcast: BroadcastFunction) => {
    broadcast = setBroadcast;

    const client = mqtt.connect('mqtt://172.16.4.51:1883', {
        username: 'backend',
        password: 'backend_secret'
    });

    client.on('connect', () => {
        console.log('MQTT connecté');

        client.subscribe('devices/register');
        client.subscribe('devices/+/telemetry');
        client.subscribe('devices/+/status');
    });

  client.on('message', async (topic, message) => {
        let payload: any;
        try {
            payload = JSON.parse(message.toString());
        } catch (err) {
            return;
        }
        if (typeof payload !== 'object') return;

        if (topic === 'devices/register') {
            const { clientId } = payload;
            if (!clientId || typeof clientId !== 'string') {
                console.error('Invalid clientId');
                return;
            }

            const deviceId = crypto.randomUUID();
            const pairingCode = generateCode(4);
    
            const created = await insertDevice(deviceId, pairingCode);
        
            client.publish(
                `devices/${clientId}/register/response`,
                JSON.stringify({
                    deviceId: created.device_id,
                    pairingCode: created.pairing ? created.pairing.code : undefined
                }),
                { qos: 1 }
            );
    
            return;
        }

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

        console.log(`${type} reçu`, deviceId, payload);

        // push websocket
        broadcast(deviceId, {
            event: type,
            data: payload
        });
  });

  return client;
}
