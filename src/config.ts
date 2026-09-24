import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  token: requireEnv("DISCORD_TOKEN"),
  clientId: requireEnv("DISCORD_CLIENT_ID"),
  guildId: process.env.DISCORD_GUILD_ID || undefined,
  port: numEnv("PORT", 3000),

  maxUploadBytes: numEnv("MAX_UPLOAD_MB", 25) * 1024 * 1024,
  maxGifBytes: numEnv("MAX_GIF_MB", 10) * 1024 * 1024,
  maxVideoSeconds: numEnv("MAX_VIDEO_SECONDS", 10),
  maxConcurrentJobs: Math.max(1, Math.floor(numEnv("MAX_CONCURRENT_JOBS", 2))),
};

export const SUPPORTED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
export const SUPPORTED_VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "avi", "mkv"];
export const SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_IMAGE_EXTENSIONS,
  ...SUPPORTED_VIDEO_EXTENSIONS,
];
