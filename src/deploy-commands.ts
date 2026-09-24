import { REST, Routes } from "discord.js";
import { config } from "./config";
import { data as gifCommand } from "./commands/gif";

async function main() {
  const rest = new REST().setToken(config.token);
  const body = [gifCommand.toJSON()];

  if (config.guildId) {
    // Guild-scoped: registers instantly. Great for development.
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body }
    );
    console.log(`Registered /gif command for guild ${config.guildId}.`);
  } else {
    // Global: registers for every server the bot is in, but can take up
    // to ~1 hour to fully propagate.
    await rest.put(Routes.applicationCommands(config.clientId), { body });
    console.log("Registered /gif command globally (may take up to 1 hour to appear).");
  }
}

main().catch((err) => {
  console.error("Failed to register commands:", err);
  process.exit(1);
});
