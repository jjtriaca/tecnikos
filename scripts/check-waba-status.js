const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.whatsAppConfig.findFirst();
  if (!config || !config.metaAccessToken) {
    console.log("No WhatsApp config found");
    return;
  }

  console.log("=== WhatsApp Config ===");
  console.log("Phone Number ID:", config.metaPhoneNumberId);
  console.log("WABA ID:", config.metaWabaId || "NOT SET IN DB");
  console.log("Has token:", !!config.metaAccessToken);

  // Decrypt token
  const secret = process.env.JWT_SECRET || "tecnikos-default-secret";
  const key = crypto.scryptSync(secret, "tecnikos-salt", 32);
  const parts = config.metaAccessToken.split(":");
  if (parts.length !== 3) {
    console.log("Invalid token format, parts:", parts.length);
    return;
  }
  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let token = decipher.update(parts[2], "base64", "utf8");
  token += decipher.final("utf8");
  console.log("Token decrypted OK, length:", token.length);

  const wabaId = config.metaWabaId || "1421505052856896";

  // 1. Phone number status
  console.log("\n=== Phone Number Status ===");
  try {
    const phoneRes = await fetch(
      "https://graph.facebook.com/v21.0/" + config.metaPhoneNumberId +
      "?fields=id,display_phone_number,verified_name,name_status,quality_rating,account_mode",
      { headers: { Authorization: "Bearer " + token } }
    );
    const phoneData = await phoneRes.json();
    console.log(JSON.stringify(phoneData, null, 2));
  } catch (e) {
    console.log("Phone check error:", e.message);
  }

  // 2. WABA status
  console.log("\n=== WABA Status (ID: " + wabaId + ") ===");
  try {
    const wabaRes = await fetch(
      "https://graph.facebook.com/v21.0/" + wabaId +
      "?fields=id,name,account_review_status,on_behalf_of_business_info,primary_funding_id,timezone_id",
      { headers: { Authorization: "Bearer " + token } }
    );
    const wabaData = await wabaRes.json();
    console.log(JSON.stringify(wabaData, null, 2));
  } catch (e) {
    console.log("WABA check error:", e.message);
  }

  // 3. List templates
  console.log("\n=== Templates ===");
  try {
    const tplRes = await fetch(
      "https://graph.facebook.com/v21.0/" + wabaId + "/message_templates?limit=20",
      { headers: { Authorization: "Bearer " + token } }
    );
    const tplData = await tplRes.json();
    if (tplData.error) {
      console.log("Template list error:", JSON.stringify(tplData.error, null, 2));
    } else if (tplData.data) {
      console.log("Total templates:", tplData.data.length);
      tplData.data.forEach(t => {
        console.log(" -", t.name, "|", t.status, "|", t.category, "|", t.language);
      });
    } else {
      console.log("No template data:", JSON.stringify(tplData));
    }
  } catch (e) {
    console.log("Template check error:", e.message);
  }

  // 4. Business owned WABAs
  console.log("\n=== Business Owned WABAs (Business ID: 2115296342089072) ===");
  try {
    const bizRes = await fetch(
      "https://graph.facebook.com/v21.0/2115296342089072/owned_whatsapp_business_accounts?fields=id,name,account_review_status",
      { headers: { Authorization: "Bearer " + token } }
    );
    const bizData = await bizRes.json();
    console.log(JSON.stringify(bizData, null, 2));
  } catch (e) {
    console.log("Business WABAs error:", e.message);
  }

  // 5. Business profile
  console.log("\n=== WhatsApp Business Profile ===");
  try {
    const profRes = await fetch(
      "https://graph.facebook.com/v21.0/" + config.metaPhoneNumberId +
      "/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical",
      { headers: { Authorization: "Bearer " + token } }
    );
    const profData = await profRes.json();
    console.log(JSON.stringify(profData, null, 2));
  } catch (e) {
    console.log("Business profile error:", e.message);
  }

  // 6. Debug token info
  console.log("\n=== Token Debug Info ===");
  try {
    const debugRes = await fetch(
      "https://graph.facebook.com/v21.0/debug_token?input_token=" + token,
      { headers: { Authorization: "Bearer " + token } }
    );
    const debugData = await debugRes.json();
    if (debugData.data) {
      console.log("App ID:", debugData.data.app_id);
      console.log("Type:", debugData.data.type);
      console.log("Is valid:", debugData.data.is_valid);
      console.log("Scopes:", JSON.stringify(debugData.data.scopes));
      console.log("Granular scopes:", JSON.stringify(debugData.data.granular_scopes));
    } else {
      console.log(JSON.stringify(debugData, null, 2));
    }
  } catch (e) {
    console.log("Token debug error:", e.message);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
