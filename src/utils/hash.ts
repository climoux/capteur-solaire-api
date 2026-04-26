import { hash, compare } from 'bcryptjs';

export const hashSecurity = async (string: string) => {
    const saltRounds = 14;
    const hashed = await hash(string, saltRounds);
    return hashed;
}

export const verifyHash = async (storedHash: string, value: string) => await compare(value, storedHash);