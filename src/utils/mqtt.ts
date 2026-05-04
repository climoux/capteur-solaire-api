import mqtt from 'mqtt';
import crypto from "crypto";
import 'dotenv/config';

import { insertDevice, getDevice, updateDevice } from '../services/device.services.js';
import { generateCode } from './generateCode.js';

type BroadcastFunction = (deviceId: string, data: { event: string; data: any }) => void;
let broadcast: BroadcastFunction;

export const initMQTT = (setBroadcast: BroadcastFunction) => {
    broadcast = setBroadcast;

    const client = mqtt.connect('mqtt://localhost:1883', {
        username: process.env.MQTT_USERNAME ?? 'backend',
        password: process.env.MQTT_PASSWORD ?? 'backend_secret'
    });

    client.on('connect', () => {
        console.log('MQTT connecté');

        client.subscribe('devices/register');
        client.subscribe('devices/+/telemetry');
        client.subscribe('devices/+/status');
    });

    client.on('message', async (topic, message) => {
        const msg = message.toString().trim();

        // REGISTER
        if (topic === 'devices/register') {
            // Format attendu : REG|clientId
            const parts = msg.split('|');
            if (parts.length !== 2 || parts[0] !== 'REG') {
                console.error('Invalid register format');
                return;
            }

            const clientId = parts[1];
            if (!clientId) return;

            const deviceId = crypto.randomUUID();
            const pairingCode = generateCode(4);

            const created = await insertDevice(deviceId, pairingCode);
            const response = ["OK", created.device?.device_id || "", created.pairing?.code || ""].join('|');

            client.publish(`devices/${clientId}/register/response`, response, { qos: 1 });

            return;
        }

        // TELEMETRY / STATUS 
        const match = topic.match(/^devices\/(.+)\/(telemetry|status)$/);
        if (!match) return;

        const deviceId = match[1] ?? '';
        const type = match[2] ?? '';

        const device = await getDevice(deviceId);
        if (!device) return;

        /** Format attendu :
        /* TEMP|23.5|21.0
        /* FAN|1
        **/
        const parts = msg.split('|') as any[];

        let data: any = {};

        switch (parts[0]) {
            case 'TEMP':
                data = {
                    temp1: parseFloat(parts[1]),
                    temp2: parseFloat(parts[2])
                };
                break;

            case 'FAN':
                data = {
                    fan: parts[1] === '1'
                };
                break;

            case 'STATE':
                data = {
                    state: parts[1]
                };
                break;

            default:
                console.warn('Unknown message:', msg);
                return;
        }

        await updateDevice(deviceId, {
            lastSeen: new Date(),
            deviceState: {
                update: data
            }
        });

        console.log(`${type} reçu`, deviceId, data);

        broadcast(deviceId, {
            event: type,
            data
        });
    });

    return client;
};
