import { prisma } from '../db/prisma.js'

export async function upsertTelemetry(
    device_id: string,
    temperature: { in: number; out: number; target: number },
    airflow: number
) {
    return prisma.telemetry.upsert({
        where: {
            device_id
        },
        update: {
            temperature,
            airflow,
        },
        create: {
            device_id,
            temperature,
            airflow,
        }
    })
}