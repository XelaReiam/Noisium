// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLanIp } from './lanIp.js';

vi.mock('node:os', () => ({
  networkInterfaces: vi.fn(),
}));

import * as os from 'node:os';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getLanIp', () => {
  it('returns RFC 1918 address when a LAN interface exists', () => {
    os.networkInterfaces.mockReturnValue({
      eth0: [{ family: 'IPv4', internal: false, address: '192.168.1.42' }],
    });
    expect(getLanIp()).toBe('192.168.1.42');
  });

  it('falls back to 127.0.0.1 when only internal loopback exists', () => {
    os.networkInterfaces.mockReturnValue({
      lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
    });
    expect(getLanIp()).toBe('127.0.0.1');
  });

  it('prefers eth0 LAN address over VPN utun0 interface', () => {
    os.networkInterfaces.mockReturnValue({
      utun0: [{ family: 'IPv4', internal: false, address: '10.8.0.2' }],
      eth0: [{ family: 'IPv4', internal: false, address: '192.168.1.55' }],
    });
    const result = getLanIp();
    expect(result).toBe('192.168.1.55');
    expect(result).not.toBe('10.8.0.2');
  });
});
