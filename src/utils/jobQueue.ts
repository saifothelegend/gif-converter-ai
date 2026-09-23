/**
 * A tiny counting semaphore. Free hosting tiers have very limited CPU/RAM
 * (e.g. 0.1 vCPU / 512MB), so we cap how many ffmpeg conversions can run
 * at once. Anything beyond the limit waits in line (FIFO) instead of
 * spawning more processes and starving the box.
 */
export class JobQueue {
  private running = 0;
  private readonly max: number;
  private readonly waiting: Array<() => void> = [];

  constructor(max: number) {
    this.max = max;
  }

  get activeCount(): number {
    return this.running;
  }

  get queuedCount(): number {
    return this.waiting.length;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.waiting.push(() => {
        this.running += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.running -= 1;
    const next = this.waiting.shift();
    if (next) next();
  }
}
