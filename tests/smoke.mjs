import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync('index.html', 'utf8');
const app = readFileSync('app.js', 'utf8');
const requiredPages = ['dashboard','attendance','students','reports','requests','users','help'];
for (const page of requiredPages) {
  assert.ok(html.includes('data-page-view="' + page + '"'), 'Missing page: ' + page);
  assert.ok(html.includes('data-page="' + page + '"'), 'Missing navigation item: ' + page);
}
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const references = [...app.matchAll(/\$\('([^']+)'\)/g)].map(match => match[1]);
const missing = [...new Set(references.filter(id => !ids.has(id)))];
assert.deepEqual(missing, [], 'JavaScript references missing HTML IDs: ' + missing.join(', '));
for (const feature of ['cycleAttendance','markAllPresent','loadAttendance','editStudent','markStudentLeft','loadRequests','loadUsers','publicCall']) {
  assert.ok(app.includes(feature), 'Missing required application feature: ' + feature);
}
console.log('NKKAMS smoke checks passed: pages, navigation, DOM references and core workflows.');
