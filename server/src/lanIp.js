import { networkInterfaces } from 'node:os';

const RFC1918_ORDERED = [
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

const VIRTUAL_IFACE = /vmware|virtualbox|vpn|utun|tun|tap|hyper-v/i;

/**
 * Returns the most useful LAN IP address for the current machine.
 * Prefers RFC 1918 addresses in order: 192.168.x.x > 10.x.x.x > 172.16-31.x.x.
 * Skips virtual/VPN interfaces. Falls back to '127.0.0.1'.
 *
 * @returns {string}
 */
export function getLanIp() {
  const ifaces = networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (VIRTUAL_IFACE.test(name)) continue;
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      candidates.push(addr.address);
    }
  }

  for (const pattern of RFC1918_ORDERED) {
    const match = candidates.find((ip) => pattern.test(ip));
    if (match) return match;
  }

  // Any non-internal IPv4 that wasn't RFC 1918
  if (candidates.length > 0) return candidates[0];

  return '127.0.0.1';
}
