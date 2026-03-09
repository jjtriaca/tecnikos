const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const crypto = require("crypto");

async function main() {
  const config = await prisma.whatsAppConfig.findFirst();
  if (!config) { console.log("No config"); return; }

  const key = process.env.ENCRYPTION_KEY;
  if (!key) { console.log("No ENCRYPTION_KEY"); return; }

  const parts = config.metaAccessToken.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv);
  let decrypted = decipher.update(parts[1], "hex", "utf8");
  decrypted += decipher.final("utf8");

  const wabaId = config.metaWabaId || "548827068316260";
  const url = "https://graph.facebook.com/v21.0/" + wabaId + "/message_templates?limit=20";
  const res = await fetch(url, { headers: { Authorization: "Bearer " + decrypted } });
  const data = await res.json();
  if (data.data) {
    data.data.forEach(t => console.log(t.name + " | " + t.status + " | " + t.category + " | " + JSON.stringify(t.components?.map(c => c.type + ":" + (c.text || "")))));
  } else {
    console.log(JSON.stringify(data));
  }

  // Also create template "notificacao_tecnikos" if it doesn't exist
  const exists = data.data?.find(t => t.name === "notificacao_tecnikos");
  if (!exists) {
    console.log("\n--- Creating template notificacao_tecnikos ---");
    const createUrl = "https://graph.facebook.com/v21.0/" + wabaId + "/message_templates";
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + decrypted,
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
              body_text: [["Ola Joao, voce recebeu um contrato da empresa XYZ para aceite. Acesse: https://tecnikos.com.br/contract/abc123"]]
            }
          }
        ]
      })
    });
    const createData = await createRes.json();
    console.log("Create result:", JSON.stringify(createData));
  } else {
    console.log("\nTemplate notificacao_tecnikos already exists: " + exists.status);
  }

  await prisma.$disconnect();
}
main().catch(e => console.error(e));
