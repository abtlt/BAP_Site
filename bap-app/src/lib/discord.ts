// Notifications Discord envoyées à chaque prise / fin de service d'un
// journaliste. Le webhook est surchargé (nom + avatar) pour apparaître
// comme envoyé par le journaliste lui-même, avec sa photo de profil
// Roblox.
const SERVICE_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1539361347916271697/Fq6ofVLbmpGliYBA2MHNQatrOxp2L209TgvCGaAPSpmBmfnu-NY0viFswJShIsuB_455";

const COLOR_GREEN = 0x4caf6d; // var(--green)
const COLOR_RED = 0xe2564f; // var(--red)

interface WebhookMeta {
  guildId: string | null;
  channelId: string | null;
}

// Les webhooks Discord ne peuvent pas "répondre" nativement à un message
// (pas de message_reference disponible côté webhook). On émule au mieux
// en récupérant le salon/serveur du webhook une fois, pour construire un
// lien direct vers le message de prise de service depuis l'embed de fin.
let cachedMeta: WebhookMeta | null = null;

async function getWebhookMeta(): Promise<WebhookMeta> {
  if (cachedMeta) return cachedMeta;
  try {
    const res = await fetch(SERVICE_WEBHOOK_URL);
    if (!res.ok) return { guildId: null, channelId: null };
    const data = (await res.json()) as { guild_id?: string; channel_id?: string };
    cachedMeta = { guildId: data.guild_id ?? null, channelId: data.channel_id ?? null };
    return cachedMeta;
  } catch {
    return { guildId: null, channelId: null };
  }
}

function jumpLink(meta: WebhookMeta, messageId: string): string | null {
  if (!meta.guildId || !meta.channelId) return null;
  return `https://discord.com/channels/${meta.guildId}/${meta.channelId}/${messageId}`;
}

// Envoie l'embed (vert) de prise de service et retourne l'id du message
// Discord créé, pour pouvoir y faire référence à la fin du service.
export async function sendServiceStartWebhook(params: {
  displayName: string;
  serverId: string;
  avatarUrl: string;
}): Promise<string | null> {
  const { displayName, serverId, avatarUrl } = params;

  try {
    const res = await fetch(`${SERVICE_WEBHOOK_URL}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: displayName || "Journaliste BAP",
        avatar_url: avatarUrl || undefined,
        embeds: [
          {
            title: "Prise de service",
            color: COLOR_GREEN,
            fields: [
              { name: "Prénom & Nom", value: displayName || "—", inline: false },
              { name: "Appartenance", value: "BAP", inline: false },
              { name: "ID du Serveur", value: serverId || "—", inline: false },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id ?? null;
  } catch {
    // On ne bloque jamais la prise de service côté site si Discord est
    // injoignable — la notification est un bonus, pas une dépendance dure.
    return null;
  }
}

// Envoie l'embed (rouge) de fin de service, avec un lien vers le message
// de prise de service correspondant quand il est disponible.
export async function sendServiceEndWebhook(params: {
  displayName: string;
  avatarUrl: string;
  startMessageId: string | null;
}) {
  const { displayName, avatarUrl, startMessageId } = params;

  try {
    let description: string | undefined;
    if (startMessageId) {
      const meta = await getWebhookMeta();
      const link = jumpLink(meta, startMessageId);
      if (link) description = `[↩ En réponse à la prise de service](${link})`;
    }

    await fetch(SERVICE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: displayName || "Journaliste BAP",
        avatar_url: avatarUrl || undefined,
        embeds: [
          {
            title: "Fin de Service",
            description,
            color: COLOR_RED,
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    });
  } catch {
    // idem : ne bloque jamais la fin de service côté site.
  }
}
