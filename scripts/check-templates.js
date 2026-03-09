const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

function decrypt(ciphertext) {
  // Same logic as EncryptionService — derives from JWT_SECRET when ENCRYPTION_KEY not set
  const envKey = process.env.ENCRYPTION_KEY;
  let key;
  if (envKey) {
    key = Buffer.from(envKey, 'hex');
  } else {
    const secret = process.env.JWT_SECRET || 'tecnikos-default-secret';
    key = crypto.scryptSync(secret, 'tecnikos-salt', 32);
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

(async () => {
  const prisma = new PrismaClient();
  try {
    const config = await prisma.whatsAppConfig.findFirst();
    if (!config) { console.log('No config'); return; }

    console.log('WABA:', config.metaWabaId);
    const token = decrypt(config.metaAccessToken);
    console.log('Token starts with EAA:', token.startsWith('EAA'));

    const res = await fetch('https://graph.facebook.com/v21.0/' + config.metaWabaId + '/message_templates?limit=20', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const data = await res.json();

    if (data.data) {
      data.data.forEach(t => {
        console.log('\n=== Template:', t.name, '===');
        console.log('Status:', t.status, '| Language:', t.language);
        if (t.components) {
          t.components.forEach(c => {
            console.log('  [' + c.type + ']', c.text || '');
            if (c.example) console.log('  Example:', JSON.stringify(c.example));
          });
        }
      });
    } else {
      console.log('API Error:', JSON.stringify(data));
    }
  } finally {
    await prisma.$disconnect();
  }
})();
