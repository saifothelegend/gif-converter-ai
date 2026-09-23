import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { config, SUPPORTED_EXTENSIONS, SUPPORTED_IMAGE_EXTENSIONS, SUPPORTED_VIDEO_EXTENSIONS } from "../config";
import { convertToGif } from "../convert";
import { cleanupDir, createJobDir, extensionOf } from "../utils/files";
import { downloadToFile } from "../utils/download";
import { JobQueue } from "../utils/jobQueue";
import path from "node:path";

export const data = new SlashCommandBuilder()
  .setName("gif")
  .setDescription("Convert an uploaded image or video into an optimized GIF.")
  .addAttachmentOption((option) =>
    option
      .setName("media")
      .setDescription("Image (PNG/JPG/WEBP) or video (MP4/MOV/WEBM/AVI/MKV) to convert")
      .setRequired(true)
  );

// Shared queue: caps how many ffmpeg conversions run at once across all
// users/servers, so a burst of requests can't overwhelm a free instance.
const queue = new JobQueue(config.maxConcurrentJobs);

const FAILURE_MESSAGE = "❌ I couldn't convert that file. Please try another image or video.";

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const attachment = interaction.options.getAttachment("media", true);
  const ext = extensionOf(attachment.name ?? "");

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    await interaction.reply({
      content: `❌ Unsupported file type **.${ext || "unknown"}**. Supported: images (${SUPPORTED_IMAGE_EXTENSIONS.join(
        ", "
      )}) or videos (${SUPPORTED_VIDEO_EXTENSIONS.join(", ")}).`,
      ephemeral: true,
    });
    return;
  }

  if (attachment.size > config.maxUploadBytes) {
    await interaction.reply({
      content: `❌ That file is too large. Please upload something under ${(
        config.maxUploadBytes /
        (1024 * 1024)
      ).toFixed(0)}MB.`,
      ephemeral: true,
    });
    return;
  }

  // Acknowledge within Discord's 3-second interaction window, then do the
  // real work in the background and edit the reply when done.
  await interaction.deferReply();
  await interaction.editReply("🎬 Converting...");

  const jobDir = await createJobDir();
  const isVideo = SUPPORTED_VIDEO_EXTENSIONS.includes(ext);

  try {
    await queue.run(async () => {
      const inputPath = path.join(jobDir, `input.${ext}`);
      await downloadToFile(attachment.url, inputPath, config.maxUploadBytes);

      const gifPath = await convertToGif({
        inputPath,
        workDir: jobDir,
        isVideo,
        maxBytes: config.maxGifBytes,
        maxVideoSeconds: config.maxVideoSeconds,
      });

      const file = new AttachmentBuilder(gifPath, { name: "output.gif" });
      await interaction.editReply({ content: "✅ Done!", files: [file] });
    });
  } catch (err) {
    console.error(`[/gif] Conversion failed for ${attachment.name}:`, err);
    await interaction.editReply({ content: FAILURE_MESSAGE, files: [] }).catch(() => {});
  } finally {
    await cleanupDir(jobDir);
  }
}
