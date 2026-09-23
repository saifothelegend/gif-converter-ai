import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Creates a unique temp directory for a single conversion job, under the
 * OS temp dir (ephemeral storage — perfect for free hosts with no
 * persistent disk, since we never need the files after the reply is sent).
 */
export async function createJobDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), `gifbot-${randomUUID()}-`));
  return dir;
}

/** Best-effort recursive delete. Never throws — cleanup should never crash the bot. */
export async function cleanupDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch (err) {
    console.error(`[cleanup] Failed to remove temp dir ${dir}:`, err);
  }
}

export async function fileSizeBytes(filePath: string): Promise<number> {
  const s = await stat(filePath);
  return s.size;
}

export function extensionOf(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace(/^\./, "");
  return ext;
}
