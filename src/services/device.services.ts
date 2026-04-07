import { prisma } from '../db/prisma.ts'

export type PayloadType = {
    temperature?: {
        in: number;
        out: number;
        target: number;
    };
    airFlow?: number;
};

export const getDevice = async (deviceId: string) => {
    return prisma.devices.findUnique({
        where: {
            deviceId
        },
        include: {
          deviceState: true,
        },
    })
}

export const deleteDevice = async (deviceId: string) => {
    return prisma.devices.delete({
        where: {
            deviceId
        },
    })
}

export const insertDevice = async (deviceId: string, deviceSecret: string) => {
    return prisma.devices.create({
        data: {
            deviceId,
            deviceSecret
        },
    })
}

export const updateDevice = async (deviceId: string, ...data: any) => {
    return prisma.devices.update({
        where: {
            deviceId
        },
        data: {
            ...data
        },
    })
}