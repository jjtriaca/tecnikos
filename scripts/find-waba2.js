const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const crypto = require("crypto");

async function main() {
  const config = await prisma.whatsAppConfig.findFirst();
  const secret = process.env.JWT_SECRET || "tecnikos-default-secret";
  const key = crypto.scryptSync(secret, "tecnikos-salt", 32);
  const parts = config.metaAccessToken.split(":");
  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let token = decipher.update(parts[2], "base64", "utf8");
  token += decipher.final("utf8");

  // Try various approaches to find WABA
  const approaches = [
    // 1. Phone number -> business account
    { url: "https://graph.facebook.com/v21.0/" + config.metaPhoneNumberId + "?fields=id,display_phone_number,account_id" },
    // 2. System user's businesses
    { url: "https://graph.facebook.com/v21.0/me?fields=id,name" },
    // 3. System user's accessible WABAs
    { url: "https://graph.facebook.com/v21.0/me/businesses" },
  ];

  for (const a of approaches) {
    console.log("\n--- " + a.url.split("?")[0].split("/").pop() + " ---");
    try {
      const res = await fetch(a.url, { headers: { Authorization: "Bearer " + token } });
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log("Error:", e.message);
    }
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
