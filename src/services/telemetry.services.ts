import { prisma } from '../db/prisma.ts'

export async function insertTelemetry(
    deviceId: string,
    temperature: number,
    airflow: number
) {
    return prisma.telemetry.create({
        data: {
            deviceId,
            temperature,
            airflow,
        },
    })
}