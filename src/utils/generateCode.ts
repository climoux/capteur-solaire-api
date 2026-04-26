/**
 * Function to generate a random code of X characters.
 *
 * @returns {string} A random code consisting of X characters.
 */

export const generateCode = (length: number): string => {
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';

    for (let i = 0; i < length; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return code;
}