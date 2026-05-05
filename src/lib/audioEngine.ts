import { verifyAgcConstraints } from './agcVerify';
import { computeRms } from './rms';

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
