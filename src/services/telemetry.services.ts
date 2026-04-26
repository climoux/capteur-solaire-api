import { prisma } from '../db/prisma.ts'

export async function upsertTelemetry(
    deviceId: string,
    temperature: { in: number; out: number; target: number },
    airflow: number
) {
    return prisma.telemetry.upsert({
        where: {
            deviceId
        },
        update: {
            temperature,
            airflow,
        },
        create: {
            deviceId,
            temperature,
            airflow,
        }
    })
}