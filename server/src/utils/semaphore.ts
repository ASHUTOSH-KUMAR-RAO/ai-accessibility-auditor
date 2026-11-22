/** Tiny counting semaphore: at most `max` tasks run at once, the rest wait in FIFO order. */
export class Semaphore {
  private active = 0
  private readonly waiters: Array<() => void> = []
  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((resolve) => this.waiters.push(resolve))
    else this.active++
    try {
      return await fn()
    } finally {
      const next = this.waiters.shift()
      if (next) next() // hand the slot over directly
      else this.active--
    }
  }
}
