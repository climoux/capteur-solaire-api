import { prisma } from '../db/prisma.ts'

export type PayloadType = {
    temperature?: {
        in: number;
        out: number;
        target: number;
    };
    airflow?: number;
};

export const getDevice = async (id: string) => {
    return prisma.device.findUnique({
        where: {
            device_id: id
        },
        include: {
          deviceState: true,
        },
    });
}

export const deleteDevice = async (id: string) => {
    return prisma.device.delete({
        where: {
            device_id: id
        },
    });
}

export const insertDevice = async (id: string, pairingCode: string) => {
    const exists = await prisma.device.findFirst({
        where: { device_id: id }
    });
    if(exists) return { ...exists };

    const device = await prisma.device.create({
        data: { device_id: id }
    });
    const pairing = await prisma.devicePairing.create({
        data: {
            device_id: id,
            code: pairingCode,
            expires_at: new Date(Date.now() + 15 * 60 * 1000) // Expire dans 5 minutes
        }
    })

    return { ...device, pairing };
}

export const updateDevice = async (id: string, data: any) => {
    return prisma.device.update({
        where: {
            device_id: id
        },
        data
    });
}
