const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const crypto = require("crypto");

async function main() {
  const config = await prisma.whatsAppConfig.findFirst();
  if (!config || !config.metaAccessToken) { console.log("No WhatsApp config"); return; }

  // Decrypt token using same logic as EncryptionService (fallback to JWT_SECRET)
  let key;
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    key = Buffer.from(envKey, "hex");
  } else {
    const secret = process.env.JWT_SECRET || "tecnikos-default-secret";
    key = crypto.scryptSync(secret, "tecnikos-salt", 32);
    console.log("Using JWT_SECRET derived key (no ENCRYPTION_KEY)");
  }

  // Parse GCM format: iv:authTag:ciphertext (base64)
  const parts = config.metaAccessToken.split(":");
  if (parts.length !== 3) { console.log("Invalid token format, parts:", parts.length); return; }

  const iv = Buffer.from(parts[0], "base64");
  const authTag = Buffer.from(parts[1], "base64");
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let token = decipher.update(encrypted, "base64", "utf8");
  token += decipher.final("utf8");

  console.log("Token decrypted OK, length:", token.length);

  // WABA ID - try from config or hardcoded
  const wabaId = config.metaWabaId || "548827068316260";
  console.log("WABA ID:", wabaId);

  // 1. List existing templates
  console.log("\n=== Existing Templates ===");
  const listUrl = "https://graph.facebook.com/v21.0/" + wabaId + "/message_templates?limit=20";
  const listRes = await fetch(listUrl, { headers: { Authorization: "Bearer " + token } });
  const listData = await listRes.json();

  if (listData.error) {
    console.log("Error listing templates:", JSON.stringify(listData.error));

    // Try with phone number ID as WABA
    console.log("\nTrying with phoneNumberId to find WABA...");
    const phoneRes = await fetch("https://graph.facebook.com/v21.0/" + config.metaPhoneNumberId + "?fields=id,display_phone_number,verified_name,name_status", {
      headers: { Authorization: "Bearer " + token }
    });
    const phoneData = await phoneRes.json();
    console.log("Phone info:", JSON.stringify(phoneData));

    return;
  }

  if (listData.data) {
    listData.data.forEach(t => {
      console.log(t.name, "|", t.status, "|", t.category);
    });
  }

  // 2. Check if notificacao_tecnikos exists
  const existing = listData.data?.find(t => t.name === "notificacao_tecnikos");
  if (existing) {
    console.log("\nTemplate notificacao_tecnikos exists:", existing.status);
  } else {
    console.log("\n=== Creating template notificacao_tecnikos ===");
    const createUrl = "https://graph.facebook.com/v21.0/" + wabaId + "/message_templates";
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "notificacao_tecnikos",
        language: "pt_BR",
        category: "UTILITY",
        components: [
          {
            type: "BODY",
            text: "{{1}}",
            example: {
              body_text: [["Ola Joao, voce recebeu um contrato Prestacao de Servicos da empresa XYZ para aceite. Acesse: https://tecnikos.com.br/contract/exemplo"]]
            }
          }
        ]
      })
    });
    const createData = await createRes.json();
    console.log("Create result:", JSON.stringify(createData, null, 2));
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
