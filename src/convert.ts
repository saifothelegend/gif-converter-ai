import path from "node:path";
import { rm } from "node:fs/promises";
import { run } from "./utils/exec";
import { fileSizeBytes } from "./utils/files";

export class ConversionFailedError extends Error {}
export class ConversionTooLargeError extends Error {}

interface QualityAttempt {
  fps: number;
  width: number;
  lossy: number; // gifsicle --lossy compression level (higher = smaller/worse)
}

// Progressively smaller/lower-fps attempts. We start at the best quality
// that's still fast on a free, shared CPU, and step down automatically
// only if the result is too big for Discord.
const ATTEMPTS: QualityAttempt[] = [
  { fps: 15, width: 480, lossy: 40 },
  { fps: 12, width: 400, lossy: 60 },
  { fps: 10, width: 320, lossy: 80 },
  { fps: 8, width: 240, lossy: 100 },
  { fps: 6, width: 200, lossy: 130 },
];

/** Reads the container duration (seconds) via ffprobe. Returns null if unavailable (e.g. still images). */
async function probeDurationSeconds(inputPath: string): Promise<number | null> {
  try {
    const stdout = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);
    const seconds = parseFloat(stdout.trim());
    return Number.isFinite(seconds) ? seconds : null;
  } catch {
    return null;
  }
}

async function ffmpegPaletteGif(
  inputPath: string,
  outPath: string,
  workDir: string,
  attempt: QualityAttempt,
  isVideo: boolean,
  trimSeconds: number | null
): Promise<void> {
  const filter = `fps=${attempt.fps},scale=${attempt.width}:-1:flags=lanczos:force_original_aspect_ratio=decrease`;
  const palettePath = path.join(workDir, "palette.png");

  const trimArgs = isVideo && trimSeconds ? ["-t", trimSeconds.toFixed(2)] : [];

  // Pass 1: generate an optimal color palette for this clip.
  await run("ffmpeg", [
    "-y",
    ...trimArgs,
    "-i", inputPath,
    "-vf", `${filter},palettegen=stats_mode=diff`,
    palettePath,
  ], 90_000);

  // Pass 2: encode the GIF using that palette (much better quality/size
  // than a single-pass conversion).
  await run("ffmpeg", [
    "-y",
    ...trimArgs,
    "-i", inputPath,
    "-i", palettePath,
    "-filter_complex", `${filter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
    "-loop", "0",
    outPath,
  ], 90_000);

  await rm(palettePath, { force: true });
}

async function gifsicleOptimize(inPath: string, outPath: string, lossy: number): Promise<void> {
  await run("gifsicle", [
    "-O3",
    `--lossy=${lossy}`,
    "--colors", "256",
    inPath,
    "-o", outPath,
  ], 60_000);
}

export interface ConvertOptions {
  inputPath: string;
  workDir: string;
  isVideo: boolean;
  maxBytes: number;
  maxVideoSeconds: number;
}

/**
 * Converts an image or video into an optimized GIF that fits under
 * `maxBytes`. Automatically retries with a lower fps/resolution/more
 * aggressive lossy compression until it fits, or throws if it never does.
 * Returns the path to the final GIF file.
 */
export async function convertToGif(options: ConvertOptions): Promise<string> {
  const { inputPath, workDir, isVideo, maxBytes, maxVideoSeconds } = options;

  let trimSeconds: number | null = null;
  if (isVideo) {
    const duration = await probeDurationSeconds(inputPath);
    trimSeconds = duration ? Math.min(duration, maxVideoSeconds) : maxVideoSeconds;
  }

  let lastError: unknown = null;

  for (let i = 0; i < ATTEMPTS.length; i++) {
    const attempt = ATTEMPTS[i];
    const rawGif = path.join(workDir, `raw-${i}.gif`);
    const finalGif = path.join(workDir, `final-${i}.gif`);

    try {
      await ffmpegPaletteGif(inputPath, rawGif, workDir, attempt, isVideo, trimSeconds);
      await gifsicleOptimize(rawGif, finalGif, attempt.lossy);

      const size = await fileSizeBytes(finalGif);
      await rm(rawGif, { force: true });

      if (size <= maxBytes) {
        return finalGif;
      }

      // Too big — clean up and step down to the next, smaller attempt.
      await rm(finalGif, { force: true });
    } catch (err) {
      lastError = err;
      await rm(rawGif, { force: true }).catch(() => {});
      await rm(finalGif, { force: true }).catch(() => {});
      // Keep trying smaller/cheaper settings in case the failure was
      // resolution/memory related; if every attempt fails we surface
      // the last error below.
    }
  }

  if (lastError) {
    throw new ConversionFailedError(
      lastError instanceof Error ? lastError.message : String(lastError)
    );
  }
  throw new ConversionTooLargeError(
    "Could not shrink the GIF below the size limit even at the lowest quality settings."
  );
}
