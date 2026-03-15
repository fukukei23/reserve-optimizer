import fetch from "node-fetch";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID || "1479832235044769872";

async function main() {
  const url = `https://discord.com/api/v10/guilds/${guildId}/channels`;
  const res = await fetch(url, {
    headers: { Authorization: `Bot ${token}` }
  });
  
  if (!res.ok) {
    throw new Error(`Discord API error ${res.status}`);
  }
  
  const channels: any[] = await res.json();
  
  console.log(`\n=== Channels in guild ${guildId} ===\n`);
  
  // Filter and sort channels
  const textChannels = channels
    .filter(ch => ch.type === 0 || ch.type === 5) // Text or Announcement
    .sort((a, b) => (a.parent_id || "").localeCompare(b.parent_id || "") || a.position - b.position);
  
  textChannels.forEach(ch => {
    const type = ch.type === 5 ? "[ANNOUNCEMENT]" : "[TEXT]";
    console.log(`${type} ${ch.name} (ID: ${ch.id})`);
  });
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
