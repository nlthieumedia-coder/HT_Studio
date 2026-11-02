import { test } from "node:test";
import assert from "node:assert/strict";
import { getMachineId, generateLicenseKey, verifyLicenseKey, PRE_GENERATED_MASTER_KEYS } from "../src/license.js";

test("getMachineId trả về đúng định dạng HT-XXXX-XXXX", () => {
  const hwid = getMachineId();
  assert.match(hwid, /^HT-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
});

test("Tất cả 10 pre-generated keys đều hợp lệ", () => {
  assert.equal(PRE_GENERATED_MASTER_KEYS.length, 10);
  const hwid = getMachineId();
  for (const key of PRE_GENERATED_MASTER_KEYS) {
    const res = verifyLicenseKey(key, hwid);
    assert.equal(res.valid, true, `Key ${key} phải hợp lệ`);
    assert.equal(res.type, "PRE_GENERATED");
  }
});

test("generateLicenseKey sinh key hợp lệ với chữ ký", () => {
  const hwid = getMachineId();
  const generalKey = generateLicenseKey();
  const resGeneral = verifyLicenseKey(generalKey, hwid);
  assert.equal(resGeneral.valid, true);

  const boundKey = generateLicenseKey(hwid);
  const resBound = verifyLicenseKey(boundKey, hwid);
  assert.equal(resBound.valid, true);
  assert.equal(resBound.type, "MACHINE_BOUND");
});

test("verifyLicenseKey từ chối key sai định dạng hoặc giả mạo", () => {
  const hwid = getMachineId();
  assert.equal(verifyLicenseKey("", hwid).valid, false);
  assert.equal(verifyLicenseKey("HTVIDS-INVALID-KEY", hwid).valid, false);
  assert.equal(verifyLicenseKey("HTVIDS-0000-0000-0000-0000", hwid).valid, false);
});

test("checkLicenseOnline và activateLicenseOnline bắt buộc xác minh máy chủ", async () => {
  const { checkLicenseOnline, activateLicenseOnline } = await import("../src/license.js");
  const hwid = getMachineId();
  const validKey = PRE_GENERATED_MASTER_KEYS[0];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const action = url.searchParams.get("action");
    return new Response(JSON.stringify(action === "check"
      ? { valid: true }
      : { success: true, message: "OK" }), { status: 200 });
  };

  try {
    const checkRes = await checkLicenseOnline(validKey, hwid);
    assert.equal(checkRes.ok, true);
    assert.equal(checkRes.online, true);

    const actRes = await activateLicenseOnline(validKey, hwid);
    assert.equal(actRes.ok, true);
    assert.equal(actRes.online, true);

    const badRes = await activateLicenseOnline("HTVIDS-FAKE-0000-0000-0000", hwid);
    assert.equal(badRes.ok, false);

    globalThis.fetch = async () => { throw new Error("offline"); };
    const offlineRes = await checkLicenseOnline(validKey, hwid);
    assert.equal(offlineRes.ok, false);
    assert.equal(offlineRes.online, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
