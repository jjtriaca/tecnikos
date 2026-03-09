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

  const systemUserId = "122102184027217286";

  const approaches = [
    // System user's assigned WABAs
    "https://graph.facebook.com/v21.0/" + systemUserId + "/assigned_business_asset_groups",
    "https://graph.facebook.com/v21.0/" + systemUserId + "/assigned_pages",
    // Direct: get phone's WABA via different field
    "https://graph.facebook.com/v21.0/" + config.metaPhoneNumberId + "?fields=messaging_product,display_phone_number,verified_name",
    // Try business discovery
    "https://graph.facebook.com/v21.0/950743807617295?fields=id,name", // app info
  ];

  for (const url of approaches) {
    const shortName = url.split("?")[0].split("/").slice(-2).join("/");
    console.log("\n--- " + shortName + " ---");
    try {
      const res = await fetch(url, { headers: { Authorization: "Bearer " + token } });
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2));
    } catch (e) {
      console.log("Error:", e.message);
    }
  }

  // The WABA is likely accessible through the business ID
  // Let's get it from the Business Manager
  // First find the business
  const bizRes = await fetch("https://graph.facebook.com/v21.0/950743807617295?fields=id,name,owner_business", {
    headers: { Authorization: "Bearer " + token }
  });
  const bizData = await bizRes.json();
  console.log("\n--- App owner ---");
  console.log(JSON.stringify(bizData, null, 2));

  if (bizData.owner_business) {
    const ownerBizId = bizData.owner_business.id;
    console.log("\nBusiness ID:", ownerBizId);
    const wabaRes = await fetch("https://graph.facebook.com/v21.0/" + ownerBizId + "/owned_whatsapp_business_accounts", {
      headers: { Authorization: "Bearer " + token }
    });
    const wabaData = await wabaRes.json();
    console.log("WABAs:", JSON.stringify(wabaData, null, 2));
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
