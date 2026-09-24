import { REST, Routes } from "discord.js";
import { config } from "./config";

/**
 * Wipes every registered command (both global and, if DISCORD_GUILD_ID is
 * set, guild-scoped) for this application. Run this once if you ever see
 * "Required option ... not found" errors — it almost always means Discord
 * (or your client's cache) is holding onto an old command definition that
 * doesn't match the current code. After clearing, run `deploy-commands`
 * again to register the current, correct /gif definition.
 */
async function main() {
  const rest = new REST().setToken(config.token);

  await rest.put(Routes.applicationCommands(config.clientId), { body: [] });
  console.log("Cleared all global commands.");

  if (config.guildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: [] }
    );
    console.log(`Cleared all guild commands for guild ${config.guildId}.`);
  }

  console.log("Done. Now run: npm run deploy-commands (or node dist/deploy-commands.js)");
}

main().catch((err) => {
  console.error("Failed to clear commands:", err);
  process.exit(1);
});
