import fetch from "node-fetch";

const token = process.env.DISCORD_BOT_TOKEN;
const channelId = process.argv[2];

if (!channelId) {
  console.error("Usage: ts-node scripts/preview_discord_channel.ts <channelId> [limit]");
  process.exit(1);
}

const limit = process.argv[3] ? Number(process.argv[3]) : 5;

async function main() {
  const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=${limit}`;
  const res = await fetch(url, { headers: { Authorization: `Bot ${token}` } });
  if (!res.ok) {
    throw new Error(`Discord API error ${res.status}`);
  }
  const messages: any[] = await res.json();
  messages.forEach((msg) => {
    console.log(`\n[${msg.id}] ${msg.author?.username} at ${msg.timestamp}`);
    console.log(msg.content.split("\n").slice(0, 6).join("\n"));
  });
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
