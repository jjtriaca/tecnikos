const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

function decrypt(ciphertext) {
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

    const token = decrypt(config.metaAccessToken);
    const phoneNumberId = config.metaPhoneNumberId;

    // Send directly via template notificacao_teknikos with the welcome message
    const welcomeMsg = 'Olá Juliano, seja bem-vindo(a) à equipe da SLS Obras LTDA! Você foi cadastrado(a) como técnico(a) em nosso sistema. Por favor, responda esta mensagem confirmando sua participação.';

    console.log('Sending template to 5566999861230...');
    console.log('PhoneNumberId:', phoneNumberId);

    const res = await fetch('https://graph.facebook.com/v21.0/' + phoneNumberId + '/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: '5566999861230',
        type: 'template',
        template: {
          name: 'notificacao_tecnikos',
          language: { code: 'pt_BR' },
          components: [{
            type: 'body',
            parameters: [{ type: 'text', text: welcomeMsg }],
          }],
        },
      }),
    });

    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } finally {
    await prisma.$disconnect();
  }
})();
