import test from "node:test";
import assert from "node:assert/strict";

function parseBulkAccounts(value: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const valid: Array<{ email: string; password: string; totpSecret?: string; recoveryEmail?: string }> = [];
  const errors: string[] = [];
  String(value || '').split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    let parts: string[] = [];
    if (line.includes('|')) parts = line.split('|').map(s => s.trim());
    else if (line.includes('\t')) parts = line.split('\t').map(s => s.trim());
    else if (line.includes(',')) parts = line.split(',').map(s => s.trim());
    else if (line.includes(':')) parts = line.split(':').map(s => s.trim());
    else parts = line.split(/\s+/).map(s => s.trim());
    parts = parts.filter(Boolean);
    if (parts.length < 2) {
      errors.push(`Dòng ${index + 1}: cần ít nhất Email và Mật khẩu.`);
      return;
    }
    if (!emailRegex.test(parts[0]!)) {
      errors.push(`Dòng ${index + 1}: định dạng email không hợp lệ ("${parts[0]}").`);
      return;
    }
    const email = parts[0]!.toLowerCase();
    const password = parts[1]!;
    let totpSecret: string | undefined = undefined;
    let recoveryEmail: string | undefined = undefined;
    for (const rem of parts.slice(2)) {
      if (emailRegex.test(rem)) {
        recoveryEmail = rem.toLowerCase();
      } else {
        const clean = rem.replace(/\s+/g, '');
        if (/^[A-Za-z2-7]{10,}$/.test(clean) || (!totpSecret && clean.length >= 8)) {
          totpSecret = clean.toUpperCase();
        } else if (rem.includes('@')) {
          recoveryEmail = rem.toLowerCase();
        }
      }
    }
    valid.push({ email, password, totpSecret, recoveryEmail });
  });
  return { valid, errors };
}

test("parses accounts with | separator", () => {
  const input = "user1@gmail.com | pass1 | JBSWY3DPEHPK3PXP\nuser2@gmail.com | pass2 | 4S654S654S654S65 | recov@gmail.com";
  const { valid, errors } = parseBulkAccounts(input);
  assert.equal(errors.length, 0);
  assert.equal(valid.length, 2);
  assert.equal(valid[0]?.email, "user1@gmail.com");
  assert.equal(valid[0]?.password, "pass1");
  assert.equal(valid[0]?.totpSecret, "JBSWY3DPEHPK3PXP");
  assert.equal(valid[1]?.recoveryEmail, "recov@gmail.com");
});

test("parses accounts with colon, tab, and comma separators", () => {
  const input = "user3@gmail.com:pass3:JBSWY3DPEHPK3PXP\nuser4@gmail.com\tpass4\tJBSWY3DPEHPK3PXP\nuser5@gmail.com,pass5";
  const { valid, errors } = parseBulkAccounts(input);
  assert.equal(errors.length, 0);
  assert.equal(valid.length, 3);
  assert.equal(valid[0]?.email, "user3@gmail.com");
  assert.equal(valid[1]?.password, "pass4");
  assert.equal(valid[2]?.totpSecret, undefined);
});

test("detects invalid lines gracefully without failing valid ones", () => {
  const input = "invalid_line_without_pass\nuser6@gmail.com | pass6\nnotanemail | pass";
  const { valid, errors } = parseBulkAccounts(input);
  assert.equal(valid.length, 1);
  assert.equal(valid[0]?.email, "user6@gmail.com");
  assert.equal(errors.length, 2);
});
