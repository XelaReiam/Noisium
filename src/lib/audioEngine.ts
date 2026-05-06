import { verifyAgcConstraints } from './agcVerify';
import { computeRms } from './rms';
import { dbFsFromRms } from './measurement';

export type MicPermission =
  | 'idle'        // No request made yet — show "Enable microphone" card
  | 'requesting'  // getUserMedia call in flight — UI shows pending state
  | 'granted'     // Stream live, level indicator running
  | 'denied'      // User refused (NotAllowedError) — show denied card with browser-specific copy
  | 'missing'     // No mic device (NotFoundError) — show missing-device card
  | 'lost';       // Was granted, then revoked or device disappeared

export interface EngineStatus {
  permission: MicPermission;
  deviceId: string | null;
  deviceLabel: string | null;
  audioReady: boolean;
}

/** Reason a measurement window aborted before completing. */
export type MeasurementAbortReason = 'state-change' | 'device-change' | 'manual';

/**
 * Result of AudioEngine.startMeasurement(). Discriminated union — `aborted: false`
 * carries the captured average; `aborted: true` carries the cause.
 *
 * NOTE: 'device-change' is reserved for future engine-side device-change detection.
 * Currently `startMeasurement` only produces 'state-change' and 'manual' reasons —
 * 'device-change' is detected by the React-side MeasurementAbortGuard component
 * (Plan 03-05) which calls `signal.abort()` on the AbortController, producing a
 * 'manual' reason from the engine's perspective. The store maps the React-side
 * call to its own 'device-change' reason. See RESEARCH Pattern 10.
 */
export type MeasurementResult =
  | { aborted: false; avgDbFs: number; avgRms: number; rmsStdDev: number; durationMs: number }
  | { aborted: true; reason: MeasurementAbortReason };

type StatusCallback = (status: EngineStatus) => void;

const AGC_CONSTRAINTS: MediaTrackConstraints = {
  autoGainControl: false,
  echoCancellation: false,
  noiseSuppression: false,
};

// rAF smoothing: fast attack (rising), slow decay (falling) — matches a real VU meter
const ATTACK_ALPHA = 0.3;
const DECAY_ALPHA = 0.05;

const ANALYSER_FFT_SIZE = 2048;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private silentGain: GainNode | null = null;
  private floatBuffer: Float32Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;
  private onStatusChange: StatusCallback;

  /**
   * Smoothed RMS in [0, 1]. Read by LevelIndicator via its own rAF.
   * Plain instance property — never goes through React state or Zustand
   * (60fps would thrash the reconciler).
   */
  currentLevel = 0;

  constructor(onStatusChange: StatusCallback) {
    // CAL-03: NO AudioContext creation here. Browser autoplay policy requires
    // it inside the user-gesture handler. Constructor must be safe to call
    // at React mount time.
    this.onStatusChange = onStatusChange;
  }

  async requestPermission(deviceId?: string): Promise<EngineStatus> {
    // 1. Create AudioContext inside the gesture handler (CAL-03)
    if (!this.ctx) {
      this.ctx = new AudioContext();
      // Diagnostic: log sample rate at acquisition (Phase 1 blocker note)
      console.log(
        `[Noisium] AudioContext created. sampleRate=${this.ctx.sampleRate}`,
      );
    }
    if (this.ctx.state !== 'running') {
      await this.ctx.resume();
    }

    // 2. Stop prior stream FIRST — releases OS mic-in-use indicator on device switch
    this._stopStream();

    // 3. Build constraints: AGC disabled (CAL-02), optional deviceId
    const audioConstraints: MediaTrackConstraints = {
      ...AGC_CONSTRAINTS,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });

      this.stream = stream;
      const track = stream.getAudioTracks()[0];

      // 4. CAL-02 verification — only warns on `=== true`, silent on undefined (Safari)
      const rawSettings = track.getSettings();
      const settings = {
        autoGainControl:
          typeof rawSettings.autoGainControl === 'boolean'
            ? rawSettings.autoGainControl
            : undefined,
        echoCancellation:
          typeof rawSettings.echoCancellation === 'boolean'
            ? rawSettings.echoCancellation
            : undefined,
        noiseSuppression:
          typeof rawSettings.noiseSuppression === 'boolean'
            ? rawSettings.noiseSuppression
            : undefined,
        deviceId: rawSettings.deviceId,
      };
      const issues = verifyAgcConstraints(settings);
      if (issues.length > 0) {
        console.warn(
          `[Noisium AGC] Constraints still enabled: ${issues.join(', ')}. ` +
            `Measurement accuracy may be affected. ` +
            `Settings: ${JSON.stringify(settings)}`,
        );
      } else {
        console.log(
          `[Noisium AGC] OK: ${JSON.stringify({
            autoGainControl: settings.autoGainControl,
            echoCancellation: settings.echoCancellation,
            noiseSuppression: settings.noiseSuppression,
          })}`,
        );
      }

      // 5. Build the audio graph
      const source = this.ctx.createMediaStreamSource(stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = ANALYSER_FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0; // we smooth manually in rAF loop
      this.floatBuffer = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;

      // Silent GainNode → destination prevents browser auto-suspending an "idle"
      // input-only AudioContext. Standard workaround per Web Audio best practices.
      this.silentGain = this.ctx.createGain();
      this.silentGain.gain.value = 0;
      source.connect(this.analyser);
      source.connect(this.silentGain);
      this.silentGain.connect(this.ctx.destination);

      // 6. Start the rAF level loop
      this._startLoop();

      const status: EngineStatus = {
        permission: 'granted',
        deviceId: settings.deviceId ?? null,
        deviceLabel: track.label,
        audioReady: true,
      };
      this.onStatusChange(status);
      return status;
    } catch (err) {
      const permission: MicPermission =
        err instanceof DOMException && err.name === 'NotFoundError'
          ? 'missing'
          : 'denied';
      const status: EngineStatus = {
        permission,
        deviceId: null,
        deviceLabel: null,
        audioReady: false,
      };
      this.onStatusChange(status);
      return status;
    }
  }

  async setDevice(deviceId: string): Promise<EngineStatus> {
    // requestPermission already calls _stopStream first
    return this.requestPermission(deviceId);
  }

  markLost(): void {
    this._stopLoop();
    this._stopStream();
    this.currentLevel = 0;
    this.onStatusChange({
      permission: 'lost',
      deviceId: null,
      deviceLabel: null,
      audioReady: false,
    });
  }

  dispose(): void {
    this._stopLoop();
    this._stopStream();
    if (this.ctx) {
      // close() returns a promise but we don't await — fire and forget
      this.ctx.close().catch(() => {
        /* swallow — context may already be closed */
      });
      this.ctx = null;
    }
    this.analyser = null;
    this.silentGain = null;
    this.floatBuffer = null;
    this.currentLevel = 0;
    this.onStatusChange({
      permission: 'idle',
      deviceId: null,
      deviceLabel: null,
      audioReady: false,
    });
  }

  getCurrentLevel(): number {
    return this.currentLevel;
  }

  /**
   * Run a fixed-duration measurement window. Resolves with the average dBFS
   * across the window, or an aborted result if the AudioContext leaves 'running'
   * or the AbortSignal fires.
   *
   * Sampling: setInterval at ~30 Hz, parallel to the existing rAF VU loop.
   * Both read the same AnalyserNode — reads are non-destructive.
   *
   * Window boundary: wall-clock via performance.now(), NOT sample count.
   * Sample rate varies by device (Windows usually 48000, macOS 44100, etc.) so
   * a sample-count window would yield slightly different durations per device.
   *
   * @param windowSeconds  Duration of capture (e.g. 3 for calibration, 5/8/10 for measurement)
   * @param signal         Optional AbortSignal — abort() resolves the promise with reason: 'manual'
   */
  async startMeasurement(
    windowSeconds: number,
    signal?: AbortSignal,
  ): Promise<MeasurementResult> {
    if (!this.analyser || !this.floatBuffer) {
      throw new Error('[Noisium] AudioEngine not ready — call requestPermission first');
    }
    if (this.ctx && this.ctx.state !== 'running') {
      await this.ctx.resume();
    }
    // Capture refs locally for the closure — they cannot be reassigned mid-window
    // because requestPermission rebuilds them, which would only happen if the user
    // clicked Enable mic mid-measurement (impossible — UI is disabled during measurement).
    const ctx = this.ctx;
    const analyser = this.analyser;
    const buffer = this.floatBuffer;

    return new Promise<MeasurementResult>((resolve) => {
      const samples: number[] = [];
      const startMs = performance.now();
      const targetMs = windowSeconds * 1000;
      let finished = false;

      const finish = (result: MeasurementResult): void => {
        if (finished) return;
        finished = true;
        clearInterval(intervalId);
        ctx?.removeEventListener('statechange', onStateChange);
        signal?.removeEventListener('abort', onAbort);
        resolve(result);
      };

      // Sampling tick — ~30 Hz independent of frame rate
      const intervalId = setInterval(() => {
        if (finished) return;
        analyser.getFloatTimeDomainData(buffer);
        samples.push(computeRms(buffer));
        if (performance.now() - startMs >= targetMs) {
          const avgRms =
            samples.length > 0
              ? samples.reduce((a, b) => a + b, 0) / samples.length
              : 0;
          const variance =
            samples.length > 1
              ? samples.reduce((sum, s) => sum + (s - avgRms) ** 2, 0) / samples.length
              : 0;
          finish({
            aborted: false,
            avgDbFs: dbFsFromRms(avgRms),
            avgRms,
            rmsStdDev: Math.sqrt(variance),
            durationMs: performance.now() - startMs,
          });
        }
      }, 33);

      // AudioContext state-change abort observer.
      // Use addEventListener (NOT onstatechange =) — future-proofs against any
      // Phase 2 patch that might assign onstatechange for markLost wiring. RESEARCH Pitfall 2.
      const onStateChange = (): void => {
        if (ctx && ctx.state !== 'running') {
          finish({ aborted: true, reason: 'state-change' });
        }
      };
      ctx?.addEventListener('statechange', onStateChange);

      // External abort signal — Plan 03-05's MeasurementAbortGuard fires this
      // when navigator.mediaDevices.devicechange detects the active mic disappeared.
      const onAbort = (): void => finish({ aborted: true, reason: 'manual' });
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * Capture a 3-second ambient baseline. Thin wrapper around startMeasurement(3).
   * Throws if aborted — calibration has no Retry semantics; the host clicks
   * "Calibrate room" again to retry.
   *
   * The 3→2→1 countdown UI lives in the calling component, NOT here. The engine
   * just runs the actual capture window when called. Per CONTEXT decision: the
   * countdown is host-UI timing.
   */
  async calibrate(signal?: AbortSignal): Promise<{ ambientDbFs: number; stableBaseline: boolean }> {
    const result = await this.startMeasurement(3, signal);
    if (result.aborted) {
      throw new Error('Calibration aborted');
    }
    // Coefficient of variation > 0.5 means the ambient noise was highly variable
    // during the capture window — HVAC kick, door slam, host speaking, etc.
    const cv = result.avgRms > 0 ? result.rmsStdDev / result.avgRms : 0;
    return { ambientDbFs: result.avgDbFs, stableBaseline: cv < 0.5 };
  }

  private _stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  private _startLoop(): void {
    this._stopLoop();
    const tick = (): void => {
      if (!this.analyser || !this.floatBuffer) return;
      this.analyser.getFloatTimeDomainData(this.floatBuffer);
      const rms = computeRms(this.floatBuffer);
      const alpha = rms > this.currentLevel ? ATTACK_ALPHA : DECAY_ALPHA;
      this.currentLevel = alpha * rms + (1 - alpha) * this.currentLevel;
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private _stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
