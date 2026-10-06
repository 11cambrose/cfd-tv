// CFD TV data checks: JSON schema + invariants (unique channel numbers, lane separation, clock coverage).
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let Ajv; try { Ajv = require('ajv'); } catch { Ajv = require(path.resolve(process.env.QA_NODE_MODULES || '.', 'ajv')); }
const root = process.argv[2] || '.'; const schemaPath = process.argv[3] || new URL('./channels.schema.json', import.meta.url).pathname;
const data = JSON.parse(fs.readFileSync(path.join(root, 'channels.json'), 'utf8'));
const hl = JSON.parse(fs.readFileSync(path.join(root, 'data/highlights.json'), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: false });
const ok = ajv.validate(JSON.parse(fs.readFileSync(schemaPath, 'utf8')), data);
const fails = [];
if (!ok) for (const e of ajv.errors.slice(0, 25)) fails.push(`schema ${e.instancePath} ${e.message}`);
const nums = data.channels.map(c => c.num); const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
if (dup.length) fails.push(`duplicate channel numbers ${dup}`);
// lanes: README contract  zone = 02-10,72,73 ; brose = 11-43,70,71
const zone = new Set([2,3,4,5,6,7,8,9,10,72,73]);
for (const c of data.channels) { const want = zone.has(c.num) ? 'zone' : 'brose'; if (c.lane !== want) fails.push(`lane mix: CH ${c.num} ${c.name} is ${c.lane}, contract says ${want}`); }
for (const b of data.clock) { const c = data.channels.find(x => x.num === b.ch); if (!c) fails.push(`clock block ${b.title} points at missing CH ${b.ch}`); else if (c.lane !== b.lane) fails.push(`clock block ${b.title} lane ${b.lane} != CH ${b.ch} lane ${c.lane}`); }
// clock covers 00:00-24:00 contiguously
const toM = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
let t = 0; for (const b of [...data.clock].sort((a, b) => toM(a.start) - toM(b.start))) { if (toM(b.start) !== t) fails.push(`clock gap/overlap at ${b.start} (expected ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')})`); t = toM(b.end); }
if (t !== 1440) fails.push(`clock ends at ${t} min, not 24:00`);
for (const c of data.channels.filter(c => c.type === 'highlight')) if (!hl[c.key]) fails.push(`highlights.json missing key ${c.key} for CH ${c.num}`);
const empty = data.channels.filter(c => (c.type === 'youtube' && !c.videos.length) || (c.type === 'spotify' && !(c.playlists || c.dice || []).length));
const counts = data.channels.reduce((a, c) => (a[c.type] = (a[c.type] || 0) + 1, a), {});
console.log(JSON.stringify({ schema_ok: ok, channels: data.channels.length, counts, empty_channels: empty.map(c => c.num), clock_blocks: data.clock.length, fails }, null, 1));
process.exit(fails.length ? 1 : 0);
