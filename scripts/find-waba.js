const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const crypto = require("crypto");

async function main() {
  const config = await prisma.whatsAppConfig.findFirst();
  if (!config || !config.metaAccessToken) { console.log("No config"); return; }

  const secret = process.env.JWT_SECRET || "tecnikos-default-secret";
  const key = crypto.scryptSync(secret, "tecnikos-salt", 32);

  const parts = config.metaAccessToken.split(":");
  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let token = decipher.update(parts[2], "base64", "utf8");
  token += decipher.final("utf8");

  const phoneId = config.metaPhoneNumberId;
  console.log("Phone Number ID:", phoneId);

  // Get the WABA ID from the phone number
  const res = await fetch("https://graph.facebook.com/v21.0/" + phoneId + "?fields=id,display_phone_number,verified_name,name_status", {
    headers: { Authorization: "Bearer " + token }
  });
  const data = await res.json();
  console.log("Phone data:", JSON.stringify(data, null, 2));

  // Try to get business account from phone number
  const res2 = await fetch("https://graph.facebook.com/v21.0/" + phoneId + "/whatsapp_business_profile", {
    headers: { Authorization: "Bearer " + token }
  });
  const data2 = await res2.json();
  console.log("Business profile:", JSON.stringify(data2, null, 2));

  // Try /debug_token to find app info
  const res3 = await fetch("https://graph.facebook.com/v21.0/debug_token?input_token=" + token, {
    headers: { Authorization: "Bearer " + token }
  });
  const data3 = await res3.json();
  if (data3.data) {
    console.log("Token belongs to app:", data3.data.app_id);
    console.log("Granular scopes:", JSON.stringify(data3.data.granular_scopes));
  }

  // Try to find WABA through the app's business
  // The system user token should have whatsapp_business_management permission
  // Use the app-scoped business ID
  const businessId = data3.data?.profile_id;
  if (businessId) {
    console.log("\nBusiness ID:", businessId);
    const res4 = await fetch("https://graph.facebook.com/v21.0/" + businessId + "/owned_whatsapp_business_accounts", {
      headers: { Authorization: "Bearer " + token }
    });
    const data4 = await res4.json();
    console.log("Owned WABAs:", JSON.stringify(data4, null, 2));
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
