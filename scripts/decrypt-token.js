// Run inside tecnikos_backend container with env vars set
const crypto = require('crypto');

const enc = process.env.ENC_TOKEN;
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

const parts = enc.split(':');
const iv = Buffer.from(parts[0], 'base64');
const authTag = Buffer.from(parts[1], 'base64');
const cipher = Buffer.from(parts[2], 'base64');
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);
let d = decipher.update(cipher, null, 'utf8');
d += decipher.final('utf8');
console.log(d);
