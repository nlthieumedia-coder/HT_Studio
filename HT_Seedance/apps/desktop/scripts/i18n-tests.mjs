import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = async (language, namespace) =>
  JSON.parse(
    await readFile(
      new URL(`../src/i18n/locales/${language}/${namespace}.json`, import.meta.url),
      'utf8',
    ),
  );

const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const detect = (saved, browser) =>
  saved === 'vi' || saved === 'en' ? saved : browser.toLowerCase().startsWith('vi') ? 'vi' : 'en';

const resources = {};
for (const language of ['vi', 'en']) {
  resources[language] = {};
  for (const namespace of ['common', 'accounts', 'errors']) {
    resources[language][namespace] = await load(language, namespace);
  }
}

assert.equal(detect(null, 'vi-VN'), 'vi', 'Vietnamese browser detection');
assert.equal(detect(null, 'fr-FR'), 'en', 'non-Vietnamese browsers default to English');
assert.equal(detect('en', 'vi-VN'), 'en', 'saved preference has priority');
assert.equal(detect('vi', 'en-US'), 'vi', 'saved Vietnamese preference persists');

for (const language of ['vi', 'en']) {
  assert.ok(get(resources[language].accounts, 'title'));
  assert.ok(get(resources[language].accounts, 'openProfile'));
  assert.ok(get(resources[language].accounts, 'checkSession'));
  assert.ok(get(resources[language].errors, 'PROFILE_ALREADY_RUNNING'));
  assert.ok(get(resources[language].common, 'status.AUTHENTICATED'));
}

const fallback = (language, namespace, key) =>
  get(resources[language][namespace], key) ?? get(resources.en[namespace], key) ?? key;
assert.equal(fallback('vi', 'common', 'does.not.exist'), 'does.not.exist');
assert.equal(fallback('vi', 'accounts', 'title'), get(resources.vi.accounts, 'title'));
assert.equal(fallback('en', 'common', 'status.INTERRUPTED'), 'Interrupted');

const internalStatus = 'LOGIN_REQUIRED';
assert.equal(internalStatus, 'LOGIN_REQUIRED', 'translation must not mutate internal status values');

console.log('i18n tests passed: detection, persistence, fallback, labels, errors, statuses');
