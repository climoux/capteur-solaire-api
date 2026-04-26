import crypto from "crypto";

// Generate a token
const generateToken = () => crypto.randomBytes(64).toString('hex');

export default generateToken;