/**
 * Wall-clock-based countdown timer. Uses performance.now() as the source of
 * truth (not a tick counter) so pausing/resuming and background tabs never
 * cause drift.
 */
class WaggleCountdown {
  constructor({ onTick, onComplete } = {}) {
    this.onTick = onTick || (() => {});
    this.onComplete = onComplete || (() => {});
    this.totalSeconds = 0;
    this.remainingSeconds = 0;
    this.state = "idle"; // idle | running | paused | done
    this._endTime = null;
    this._rafId = null;
  }

  configure(totalSeconds) {
    this._stopLoop();
    this.totalSeconds = totalSeconds;
    this.remainingSeconds = totalSeconds;
    this.state = "idle";
    this.onTick(this.remainingSeconds, this.totalSeconds);
  }

  start() {
    if (this.totalSeconds <= 0) return;
    this.state = "running";
    this._endTime = performance.now() + this.remainingSeconds * 1000;
    this._loop();
  }

  pause() {
    if (this.state !== "running") return;
    this.state = "paused";
    this._stopLoop();
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "running";
    this._endTime = performance.now() + this.remainingSeconds * 1000;
    this._loop();
  }

  reset(totalSeconds = this.totalSeconds) {
    this.configure(totalSeconds);
  }

  stop() {
    this._stopLoop();
    this.state = "idle";
  }

  _loop() {
    this._rafId = requestAnimationFrame(() => {
      if (this.state !== "running") return;
      const msLeft = this._endTime - performance.now();
      this.remainingSeconds = Math.max(0, msLeft / 1000);
      this.onTick(this.remainingSeconds, this.totalSeconds);
      if (msLeft <= 0) {
        this.state = "done";
        this.onComplete();
        return;
      }
      this._loop();
    });
  }

  _stopLoop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }
}
