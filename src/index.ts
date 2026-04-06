import Fastify from 'fastify';
import fastifyExpress from '@fastify/express';
import cors from '@fastify/cors';
import type { FastifyCorsOptions } from '@fastify/cors';
import websocket from '@fastify/websocket';
import crypto from 'crypto';
import 'dotenv/config';

import { devices, type PayloadType } from './db/deviceStore.ts';
import { registerWS, broadcast } from './utils/websocket.ts';
import { initMQTT } from './utils/mqtt.ts';
import { PORT } from './constants.ts';

const fastify = Fastify({ logger: process.env.NODE_ENV === 'production' ? false : true })

// Config
await fastify.register(fastifyExpress)
await fastify.register(websocket);
// Rendre accessible aux modules
fastify.decorate('devices', devices)
// WebSocket
registerWS(fastify);
// MQTT
const mqttClient = initMQTT(broadcast)

// -- CORS protection
const whitelist = [
    process.env.NODE_ENV === 'development' && 'http://localhost:3000', // development only
];

const corsOptions: FastifyCorsOptions = {
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'ww-ip'],
    methods: ['GET', 'PUT','POST', 'DELETE', 'OPTIONS'],
    optionsSuccessStatus: 200,
    origin: async (origin: string | undefined) => {
        return whitelist.indexOf(origin!) !== -1 || !origin;
    }
}
await fastify.register(cors, corsOptions);

// Endpoints
fastify.get('/', async (req, res) => {
    return {};
});

// -- Enregistrer un nouveau capteur
fastify.post('/devices', async (req, res) => {
    const deviceId = Math.random().toString(36).substring(2, 13); // ID de 11 caractères
    const deviceSecret = crypto.randomBytes(32).toString('hex'); // Token de 32 caractères hexadécimaux (64 caractères)

    devices.set(deviceId, {
        deviceId,
        token: deviceSecret,
        lastSeen: null,
        state: {} as PayloadType
    });

    return {
        deviceId,
        deviceSecret
    };
});

// -- Avoir les données d'un capteur spécifique (températures, flux d'air, etc.)
fastify.get('/devices/:id', async (req, res) => {
    const { id } = req.params as { id: string };
    // Authentification du capteur
    const token = req.headers['authorization']?.split(' ')[1]
    if(!token) return res.status(401).send({ error: 'Missing authorization token' })

    const device = devices.get(id)
    if(!device || device.token !== token) return res.status(401).send({ error: 'Unauthorized' })

    return {
        deviceId: id,
        lastSeen: device.lastSeen,
        state: device.state
    }
});

// -- Supprimer un capteur de la base de données
fastify.delete('/devices/:id', async (req, res) => {
    const { id } = req.params as { id: string };
    devices.delete(id);
    return { status: 'deleted' };
});

// -- Envoyer les données d'un capteur à la base de données
fastify.post('/devices/:id/telemetry', async (req, res) => {
    const { id } = req.params as { id: string };
    // Authentification du capteur
    const token = req.headers['authorization']?.split(' ')[1];
    if(!token) return res.status(401).send({ error: 'Missing authorization token' });

    const device = devices.get(id);
    if(!device || device.token !== token) return res.status(401).send({ error: 'Unauthorized' });

    const payload = req.body as PayloadType;
    device.state = { ...device.state, ...payload };
    device.lastSeen = Date.now();

    // Publier MQTT pour que backend et WS reçoivent
    mqttClient.publish(`devices/${id}/telemetry`, JSON.stringify(payload));

    // Push WebSocket direct
    broadcast(id, { event: 'telemetry', data: payload });

    return { status: 'ok' };
});

// -- Définir la température cible à distance
fastify.post('/devices/:id/command/temperature', async (req, res) => {
    const { id } = req.params as { id: string };
    const { targetTemperature } = req.body as { targetTemperature: number };
    if(targetTemperature < 10 || targetTemperature > 30) return res.status(400).send({ error: 'Invalid target temperature. Must be between 10 and 30.' });
    
    mqttClient.publish(`devices/${id}/command`, JSON.stringify({ targetTemperature }), { qos: 1, retain: true });

    return { targetTemperature };
});

// -- Contrôler le ventilateur d'un capteur à distance (off/manual/auto)
const FanMode = ['manual', 'auto'] as const;
type FanMode = typeof FanMode[number];

// La vitesse du ventilateur à 4 valeurs fixes : 0% (off), 33% (low), 66% (medium), 100% (high)
fastify.post('/devices/:id/command/fan', async (req, res) => {
    const { id } = req.params as { id: string };
    const { mode, speed } = req.body as {
        mode: FanMode;  // 'manual', 'auto'
        speed: number;  // 0-100 (pour 'manual' uniquement)
    };
    if(!FanMode.includes(mode)) return res.status(400).send({ error: 'Invalid fan state' });
    if(speed < 0 || speed > 100) return res.status(400).send({ error: 'Invalid fan speed. Must be between 0 and 100.' });

    mqttClient.publish(`devices/${id}/command`, JSON.stringify({ fan: { mode, speed } }), { qos: 1, retain: true });

    return { fan: { mode, speed }};
});

// -- Contrôler la trappe d'un capteur à distance (ouvrir/fermer/auto)
const TrapdoorState = ['open', 'close', 'auto'] as const;
type TrapdoorState = typeof TrapdoorState[number];

fastify.post('/devices/:id/command/trapdoor', async (req, res) => {
    const { id } = req.params as { id: string };
    const { state } = req.body as { state: TrapdoorState }; // 'open', 'close', 'auto'
    if(!TrapdoorState.includes(state)) return res.status(400).send({ error: 'Invalid trapdoor state' });

    mqttClient.publish(`devices/${id}/command`, JSON.stringify({ trapdoor: state }), { qos: 1, retain: true });

    return { trapdoor: state };
});

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server listening at ${address}`);
})