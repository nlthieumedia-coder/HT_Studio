import { describe, expect, it } from 'vitest';
import { generateMachineLicenseKey, verifyLicenseKey } from '../src/main/license/license-service';

describe('license validation', () => {
  it('accepts a Downloader key generated for the current HWID', () => {
    const hwid = 'HTD-1234-5678';
    expect(verifyLicenseKey(generateMachineLicenseKey(hwid), hwid).valid).toBe(true);
  });

  it('rejects malformed and modified keys', () => {
    expect(verifyLicenseKey('INVALID', 'HTD-1234-5678').valid).toBe(false);
    expect(verifyLicenseKey('HTDOWN-AAAA-BBBB-CCCC-DDDD', 'HTD-1234-5678').valid).toBe(false);
  });

  it('does not accept a valid Downloader key on another machine', () => {
    const key = generateMachineLicenseKey('HTD-1234-5678');
    expect(verifyLicenseKey(key, 'HTD-9999-0000').valid).toBe(false);
  });
});
