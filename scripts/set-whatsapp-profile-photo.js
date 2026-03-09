const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');

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
    // Get company with logo
    const company = await prisma.company.findFirst({
      select: { id: true, name: true, logoUrl: true }
    });
    if (!company) { console.log('No company'); return; }
    console.log('Company:', company.name);
    console.log('Logo URL:', company.logoUrl);

    if (!company.logoUrl) {
      console.log('No logo configured for company');
      return;
    }

    // Resolve logo path
    const logoPath = '/app' + company.logoUrl; // logoUrl is like /uploads/{companyId}/logo-xxx.jpg
    if (!fs.existsSync(logoPath)) {
      console.log('Logo file not found:', logoPath);
      return;
    }

    const imgBuffer = fs.readFileSync(logoPath);
    const fileSize = imgBuffer.length;
    const isJpg = company.logoUrl.endsWith('.jpg') || company.logoUrl.endsWith('.jpeg');
    const fileType = isJpg ? 'image/jpeg' : 'image/png';
    const fileName = company.logoUrl.split('/').pop();
    console.log('File:', fileName, '| Size:', fileSize, '| Type:', fileType);

    // Get WhatsApp config
    const config = await prisma.whatsAppConfig.findFirst({
      where: { companyId: company.id }
    });
    if (!config || !config.metaAccessToken) {
      console.log('No WhatsApp config');
      return;
    }

    const token = decrypt(config.metaAccessToken);
    const phoneNumberId = config.metaPhoneNumberId;
    const appId = '950743807617295';

    // Step 1: Create upload session
    console.log('\n1. Creating upload session...');
    const sessionRes = await fetch(`https://graph.facebook.com/v21.0/${appId}/uploads`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_length: fileSize,
        file_type: fileType,
        file_name: fileName,
      }),
    });
    const sessionData = await sessionRes.json();
    if (!sessionData.id) {
      console.log('Failed:', JSON.stringify(sessionData));
      return;
    }
    console.log('Session ID:', sessionData.id);

    // Step 2: Upload the file
    console.log('\n2. Uploading image...');
    const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${sessionData.id}`, {
      method: 'POST',
      headers: {
        'Authorization': 'OAuth ' + token,
        'file_offset': '0',
        'Content-Type': 'application/octet-stream',
      },
      body: imgBuffer,
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.h) {
      console.log('Failed:', JSON.stringify(uploadData));
      return;
    }
    console.log('Media handle obtained');

    // Step 3: Set as profile picture
    console.log('\n3. Setting profile picture...');
    const profileRes = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/whatsapp_business_profile`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        profile_picture_handle: uploadData.h,
      }),
    });
    const profileData = await profileRes.json();
    console.log('Result:', JSON.stringify(profileData));

    if (profileData.success) {
      console.log('\n✅ WhatsApp profile picture updated with company logo!');
    } else {
      console.log('\n❌ Failed to update profile picture');
    }
  } finally {
    await prisma.$disconnect();
  }
})();
