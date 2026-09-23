import { execFile } from "node:child_process";

/**
 * Runs a CLI binary (ffmpeg / ffprobe / gifsicle) and resolves with stdout.
 * Rejects with a readable error (including stderr) on non-zero exit so
 * callers can show a clean failure message instead of a stack trace.
 */
export function run(
  bin: string,
  args: string[],
  timeoutMs = 60_000
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 20 },
      (error, stdout, stderr) => {
        if (error) {
          const message = stderr?.toString().slice(-2000) || error.message;
          reject(new Error(`${bin} failed: ${message}`));
          return;
        }
        resolve(stdout.toString());
      }
    );
  });
}
