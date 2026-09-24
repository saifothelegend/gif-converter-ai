import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

export class DownloadTooLargeError extends Error {
  constructor(limitBytes: number) {
    super(`File exceeds the ${(limitBytes / (1024 * 1024)).toFixed(0)}MB limit.`);
    this.name = "DownloadTooLargeError";
  }
}

/**
 * Streams a remote file to disk, aborting early if it exceeds maxBytes
 * instead of buffering the whole thing in memory first. Important on a
 * 512MB free instance.
 */
export async function downloadToFile(
  url: string,
  destPath: string,
  maxBytes: number
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download attachment (HTTP ${response.status}).`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new DownloadTooLargeError(maxBytes);
  }

  let downloaded = 0;
  const fileStream = createWriteStream(destPath);
  const nodeReadable = Readable.fromWeb(response.body as any);

  nodeReadable.on("data", (chunk: Buffer) => {
    downloaded += chunk.length;
    if (downloaded > maxBytes) {
      nodeReadable.destroy(new DownloadTooLargeError(maxBytes));
    }
  });

  try {
    await finished(nodeReadable.pipe(fileStream));
  } catch (err) {
    fileStream.close();
    throw err;
  }
}
