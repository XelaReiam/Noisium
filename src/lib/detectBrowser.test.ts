import { describe, it, expect, afterEach } from 'vitest';
import { detectBrowser, recoveryInstructions } from './detectBrowser';

const ORIGINAL_UA = navigator.userAgent;

function setUA(ua: string) {
  Object.defineProperty(navigator, 'userAgent', {
    value: ua,
    configurable: true,
  });
}

function setUserAgentData(value: unknown) {
  Object.defineProperty(navigator, 'userAgentData', {
    value,
    configurable: true,
  });
}

afterEach(() => {
  setUA(ORIGINAL_UA);
  // Remove userAgentData if a test set it
  // @ts-expect-error — deleting defined property
  delete navigator.userAgentData;
});

describe('detectBrowser', () => {
  it('returns "chromium" when userAgentData is present', () => {
    setUserAgentData({ brands: [{ brand: 'Chromium', version: '120' }] });
    expect(detectBrowser()).toBe('chromium');
  });

  it('returns "firefox" when UA contains Firefox/ and no userAgentData', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; rv:120.0) Gecko/20100101 Firefox/120.0');
    expect(detectBrowser()).toBe('firefox');
  });

  it('returns "safari" when UA contains Safari/ but no Firefox/ and no userAgentData', () => {
    setUA(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    );
    expect(detectBrowser()).toBe('safari');
  });

  it('falls back to "safari" for unknown UA without userAgentData', () => {
    setUA('Mozilla/5.0 (X11; Linux x86_64) UnknownBrowser/1.0');
    expect(detectBrowser()).toBe('safari');
  });
});

describe('recoveryInstructions', () => {
  it('mentions padlock for chromium', () => {
    expect(recoveryInstructions('chromium')).toMatch(/padlock/i);
  });
  it('mentions camera icon for firefox', () => {
    expect(recoveryInstructions('firefox')).toMatch(/camera icon/i);
  });
  it('mentions Safari Settings for safari', () => {
    expect(recoveryInstructions('safari')).toMatch(/Settings.*Microphone/i);
  });
});
