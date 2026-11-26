import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const registration = readFileSync('register-organisation.html', 'utf8');
const app = readFileSync('app.js', 'utf8');
const requiredPages = ['dashboard','attendance','students','reports','requests','users','help','holidays'];
for (const page of requiredPages) {
  assert.ok(html.includes('data-page-view="' + page + '"'), 'Missing page: ' + page);
  assert.ok(html.includes('data-page="' + page + '"'), 'Missing navigation item: ' + page);
}
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const references = [...app.matchAll(/\$\('([^']+)'\)/g)].map(match => match[1]);
const missing = [...new Set(references.filter(id => !ids.has(id)))];
assert.deepEqual(missing, [], 'Application JavaScript references missing index.html IDs: ' + missing.join(', '));

const registrationIds = new Set([...registration.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const registrationReferences = [...registration.matchAll(/document\.getElementById\('([^']+)'\)/g)].map(match => match[1]);
const missingRegistration = [...new Set(registrationReferences.filter(id => !registrationIds.has(id)))];
assert.deepEqual(missingRegistration, [], 'Registration page references missing its own HTML IDs: ' + missingRegistration.join(', '));
for (const id of ['organizationRequestForm','requestOrgName','requestContactName','requestOrgType','requestOrgLocation','requestMemberCount','requestOwnerEmployeeId','requestOwnerPassword','requestPrivacyConsent']) {
  assert.ok(registrationIds.has(id), 'Missing registration form field: ' + id);
}
for (const feature of ['cycleAttendance','markAllPresent','loadAttendance','editStudent','markStudentLeft','loadRequests','loadUsers','publicCall']) {
  assert.ok(app.includes(feature), 'Missing required application feature: ' + feature);
}
console.log('NKKAMS smoke checks passed: pages, navigation, application DOM references, registration form and core workflows.');
