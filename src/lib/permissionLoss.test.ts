import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wirePermissionLoss } from './permissionLoss';
import type { AudioEngine } from './audioEngine';

function makeFakeEngine(): AudioEngine {
  return {
    markLost: vi.fn(),
    // Stub any other methods accessed; only markLost is called by the helper.
  } as unknown as AudioEngine;
}

// EventTarget polyfill for our fake permission status object
class FakePermissionStatus extends EventTarget {
  state: PermissionState = 'granted';
  setState(s: PermissionState) {
    this.state = s;
    this.dispatchEvent(new Event('change'));
  }
}

beforeEach(() => {
  // Default: permissions.query rejects (mimics setup.ts default)
  vi.mocked(navigator.permissions.query).mockReset();
  vi.mocked(navigator.permissions.query).mockRejectedValue(
    new Error('not implemented'),
  );
  vi.mocked(navigator.mediaDevices.enumerateDevices).mockReset();
  vi.mocked(navigator.mediaDevices.addEventListener).mockReset();
  vi.mocked(navigator.mediaDevices.removeEventListener).mockReset();
});

describe('wirePermissionLoss', () => {
  it('does not crash when permissions.query throws (Safari case)', async () => {
    const engine = makeFakeEngine();
    const cleanup = await wirePermissionLoss(engine, () => 'dev-x');
    expect(cleanup).toBeInstanceOf(Function);
    cleanup(); // must also not throw
  });

  it('attaches devicechange listener regardless of permissions.query outcome', async () => {
    const engine = makeFakeEngine();
    await wirePermissionLoss(engine, () => 'dev-x');
    expect(navigator.mediaDevices.addEventListener).toHaveBeenCalledWith(
      'devicechange',
      expect.any(Function),
    );
  });

  it('cleanup removes the devicechange listener', async () => {
    const engine = makeFakeEngine();
    const cleanup = await wirePermissionLoss(engine, () => 'dev-x');
    cleanup();
    expect(navigator.mediaDevices.removeEventListener).toHaveBeenCalledWith(
      'devicechange',
      expect.any(Function),
    );
  });

  it('calls engine.markLost when permissions.query change fires with non-granted state', async () => {
    const fake = new FakePermissionStatus();
    fake.state = 'granted';
    vi.mocked(navigator.permissions.query).mockResolvedValue(
      fake as unknown as PermissionStatus,
    );
    const engine = makeFakeEngine();
    await wirePermissionLoss(engine, () => 'dev-x');
    expect(engine.markLost).not.toHaveBeenCalled();

    fake.setState('denied');
    expect(engine.markLost).toHaveBeenCalledTimes(1);
  });

  it('does NOT call engine.markLost when permissions.query change fires with granted', async () => {
    const fake = new FakePermissionStatus();
    fake.state = 'granted';
    vi.mocked(navigator.permissions.query).mockResolvedValue(
      fake as unknown as PermissionStatus,
    );
    const engine = makeFakeEngine();
    await wirePermissionLoss(engine, () => 'dev-x');
    fake.setState('granted'); // duplicate "still granted" event
    expect(engine.markLost).not.toHaveBeenCalled();
  });

  it('calls engine.markLost when devicechange fires and active device is gone', async () => {
    let deviceChangeHandler: (() => void | Promise<void>) | null = null;
    vi.mocked(navigator.mediaDevices.addEventListener).mockImplementation(
      ((type: string, handler: EventListener) => {
        if (type === 'devicechange') {
          deviceChangeHandler = handler as () => void;
        }
      }) as never,
    );
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      // active device "dev-old" is NOT in this list
      { kind: 'audioinput', deviceId: 'dev-new', label: '', groupId: '' } as MediaDeviceInfo,
    ]);
    const engine = makeFakeEngine();
    await wirePermissionLoss(engine, () => 'dev-old');
    expect(deviceChangeHandler).not.toBeNull();
    await deviceChangeHandler!();
    expect(engine.markLost).toHaveBeenCalledTimes(1);
  });

  it('does NOT call engine.markLost when devicechange fires and active device is still present', async () => {
    let deviceChangeHandler: (() => void | Promise<void>) | null = null;
    vi.mocked(navigator.mediaDevices.addEventListener).mockImplementation(
      ((type: string, handler: EventListener) => {
        if (type === 'devicechange') {
          deviceChangeHandler = handler as () => void;
        }
      }) as never,
    );
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      { kind: 'audioinput', deviceId: 'dev-x', label: '', groupId: '' } as MediaDeviceInfo,
      { kind: 'audioinput', deviceId: 'dev-y', label: '', groupId: '' } as MediaDeviceInfo,
    ]);
    const engine = makeFakeEngine();
    await wirePermissionLoss(engine, () => 'dev-x');
    await deviceChangeHandler!();
    expect(engine.markLost).not.toHaveBeenCalled();
  });

  it('uses the getter (not captured value) so device switches are seen', async () => {
    let deviceChangeHandler: (() => void | Promise<void>) | null = null;
    vi.mocked(navigator.mediaDevices.addEventListener).mockImplementation(
      ((type: string, handler: EventListener) => {
        if (type === 'devicechange') {
          deviceChangeHandler = handler as () => void;
        }
      }) as never,
    );
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      { kind: 'audioinput', deviceId: 'dev-current', label: '', groupId: '' } as MediaDeviceInfo,
    ]);
    let activeId = 'dev-original';
    const engine = makeFakeEngine();
    await wirePermissionLoss(engine, () => activeId);

    // Simulate a switch
    activeId = 'dev-current';
    await deviceChangeHandler!();
    // dev-current is in the device list — should NOT mark lost
    expect(engine.markLost).not.toHaveBeenCalled();
  });
});
