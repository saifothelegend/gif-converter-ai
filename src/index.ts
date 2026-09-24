import { Client, Events, GatewayIntentBits, Interaction } from "discord.js";
import { config } from "./config";
import * as gifCommand from "./commands/gif";
import { startKeepAliveServer } from "./keepalive";

const client = new Client({
  // We only need the base "guilds" intent: slash commands and their
  // attachment options don't require message content or privileged
  // intents at all, which keeps setup in the Developer Portal simple.
  intents: [GatewayIntentBits.Guilds],
});

const commands = new Map([[gifCommand.data.name, gifCommand]]);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}. Ready for /gif.`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Unhandled error in /${interaction.commandName}:`, err);
    const failure = "❌ I couldn't convert that file. Please try another image or video.";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: failure, files: [] }).catch(() => {});
    } else {
      await interaction.reply({ content: failure, ephemeral: true }).catch(() => {});
    }
  }
});

// Never let one bad conversion or an unexpected promise rejection take the
// whole process down — log it and keep serving other users. The host's
// process manager (Render, etc.) will restart us if we do crash.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

startKeepAliveServer(config.port, () => ({
  bot: client.user?.tag ?? "starting",
  uptimeSeconds: Math.floor(process.uptime()),
}));

client.login(config.token);
