import Fastify from 'fastify';
import fastifyExpress from '@fastify/express';
import cors from '@fastify/cors';
import type { FastifyCorsOptions } from '@fastify/cors';
import websocket from '@fastify/websocket';
import jwt from '@fastify/jwt';
import crypto from 'crypto';
import 'dotenv/config';

import { registerWS, broadcast } from './utils/websocket.ts';
import { initMQTT } from './utils/mqtt.ts';
import { hashSecurity, verifyHash } from './utils/hash.ts';

import { PORT } from './constants.ts';

import { getDevice, deleteDevice, type PayloadType, updateDevice } from './services/device.services.ts';
import { upsertTelemetry } from './services/telemetry.services.ts';

import { prisma } from './db/prisma.ts';

const fastify = Fastify({ logger: process.env.NODE_ENV === 'production' ? false : true });

// Config
await fastify.register(fastifyExpress);
await fastify.register(websocket);
// WebSocket
registerWS(fastify);
// MQTT
const mqttClient = initMQTT(broadcast)

// -- CORS protection
const whitelist = [
    process.env.NODE_ENV === 'development' && 'http://localhost:3000', // development only
].filter(Boolean);

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

// -- JWT
fastify.register(jwt, { secret: process.env.JWT_SECRET || 'super-secret-key' });

fastify.decorate('authenticate', async (req: any, res: any) => {
    try {
        await req.jwtVerify()
    }catch (err){
        res.status(401).send({ error: 'Unauthorized' })
    }
});

// Endpoints
fastify.get('/', async (req, res) => {
    return {};
});

// -- Ajouter le renouvellement du code d'appareillage (pairing code) pour se connecter à un capteur
// Cet endpoint est uniquement appelé par le capteur lui même pour créer un pairing code temporaire
/*fastify.post('/devices/:id/pairing-code', async (req, res) => {
    const { id } = req.params as { id: string };

    await updateDevice(id, {
        pairing_code: generateCode(4), // Code à 4 caractères (majuscules et chiffres)
        pairing_expires_at: new Date(Date.now() + 15 * 60 * 1000) // Expire dans 15 minutes
    })

    return { status: 'ok' };
});*/

// -- Se connecter a un capteur via le pairing code
// Cet endpoint est uniquement appelé par l'application
fastify.post('/devices/pair', async (req, res) => {
    const { pairingCode } = req.body as { pairingCode: string; };
    if (!pairingCode) return res.status(400).send({ error: 'pairingCode is required' });

    const codeEntry = await prisma.devicePairing.findUnique({
        where: { code: pairingCode },
        include: { device: true },
    });
    if (!codeEntry) return res.status(400).send({ code: 400, error: 'Invalid pairing code', errorCode: "INVALID" });

    await prisma.devicePairing.update({
        where: { id: codeEntry.id },
        data: { used: true },
    });

    // Generate device secret (auth token)
    const deviceSecret = crypto.randomBytes(32).toString('hex'); // Token de 32 caractères hexadécimaux (64 caractères)
    const hashSecret = await hashSecurity(deviceSecret);

    await prisma.$transaction([
        prisma.device.update({
            where: { device_id: codeEntry.device_id },
            data: { device_secret: hashSecret }
        }),
        prisma.devicePairing.update({
            where: { id: codeEntry.id },
            data: { used: true },
        })
    ]);

    return { status: 'paired', deviceId: codeEntry.device_id, secret: deviceSecret };
});

// -- Avoir les données d'un capteur spécifique (températures, flux d'air, etc.)
fastify.get('/devices/:id', async (req, res) => {
    const { id } = req.params as { id: string };
    // Authentification du capteur
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.split(' ')[1] : null;
    if(!token) return res.status(401).send({ error: 'Missing authorization token' });
    
    const device = await getDevice(id);
    const verify = device?.device_secret ? await verifyHash(device.device_secret, token) : false;
    if(!device || !verify) return res.status(401).send({ error: 'Unauthorized' });

    return {
        deviceId: id,
        lastSeen: device.last_seen,
        state: device.deviceState
    };
});

// -- Supprimer un capteur de la base de données
fastify.delete('/devices/:id', async (req, res) => {
    const { id } = req.params as { id: string };
    await deleteDevice(id);
    return { status: 'deleted' };
});

// -- Envoyer les données d'un capteur à la base de données
fastify.post('/devices/:id/telemetry', async (req, res) => {
    const { id } = req.params as { id: string };
    // Authentification du capteur
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.split(' ')[1] : null;
    if(!token) return res.status(401).send({ error: 'Missing authorization token' });

    const device = await getDevice(id);
    const verify = device?.device_secret ? await verifyHash(device.device_secret, token) : false;
    if(!device || !verify) return res.status(401).send({ error: 'Unauthorized' });

    const payload = req.body as PayloadType;
    if(payload.temperature && payload.airflow){
        await updateDevice(id, {
            deviceState: {
                update: {
                    ...device.deviceState,
                    ...payload
                }
            },
            last_seen: new Date()
        });
        await upsertTelemetry(id, payload.temperature, payload.airflow);

        // Publier MQTT pour que backend et WS reçoivent
        mqttClient.publish(`devices/${id}/telemetry`, JSON.stringify(payload));

        // Push WebSocket direct
        broadcast(id, { event: 'telemetry', data: payload });
    }

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
