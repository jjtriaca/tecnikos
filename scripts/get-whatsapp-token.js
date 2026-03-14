const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

function decrypt(enc) {
  const parts = enc.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const cipher = Buffer.from(parts[2], 'hex');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let d = decipher.update(cipher, null, 'utf8');
  d += decipher.final('utf8');
  return d;
}

prisma.whatsAppConfig.findFirst({ where: { isConnected: true } }).then(cfg => {
  if (!cfg) return prisma.whatsAppConfig.findFirst().then(c => { return c; });
  return cfg;
}).then(cfg => {
  if (!cfg) { console.log('NO CONFIG'); return; }
  const token = decrypt(cfg.metaAccessToken);
  const wabaId = cfg.metaWabaId;
  console.log(JSON.stringify({ wabaId, token, phoneNumberId: cfg.metaPhoneNumberId }));
  return prisma.$disconnect();
});
