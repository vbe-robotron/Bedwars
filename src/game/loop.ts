export type FrameCallback = (deltaSeconds: number, elapsedSeconds: number) => void;

export class GameLoop {
  private animationFrame = 0;
  private running = false;
  private lastTime = 0;
  private elapsed = 0;

  constructor(private readonly update: FrameCallback) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
  }

  private readonly tick = (time: number): void => {
    if (!this.running) return;
    const delta = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.elapsed += delta;
    this.update(delta, this.elapsed);
    this.animationFrame = requestAnimationFrame(this.tick);
  };
}
