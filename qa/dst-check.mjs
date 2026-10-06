// Pulls the Central-time helpers out of app.js and checks them across both 2026-27 DST switches,
// independent of the machine's own TZ. Run with different TZ= values.
import fs from 'node:fs';
const src = fs.readFileSync((process.argv[2] || '.') + '/app.js', 'utf8');
const start = src.indexOf("const TZ="); const end = src.indexOf("const fmtTime=");
const helpers = new Function(src.slice(start, end).replace(/^const TZ=/, 'const TZ=') + '\nreturn {ct,ctOffsetMs,ctTimeToDate};')();
const { ct, ctTimeToDate } = helpers;
const cases = [
  // [ymd, hh:mm CT, expected UTC ISO]
  ['2026-10-06', '04:35', '2026-10-06T09:35:00.000Z'], // CDT
  ['2026-12-15', '04:35', '2026-12-15T10:35:00.000Z'], // CST
  ['2026-11-01', '04:35', '2026-11-01T10:35:00.000Z'], // fall-back day, after switch
  ['2026-11-01', '00:00', '2026-11-01T05:00:00.000Z'], // fall-back day, before switch (still CDT)
  ['2027-03-14', '04:35', '2027-03-14T09:35:00.000Z'], // spring-forward day, after switch
  ['2027-03-14', '00:00', '2027-03-14T06:00:00.000Z'], // spring-forward day, before switch (still CST)
  ['2027-03-14', '11:14', '2027-03-14T16:14:00.000Z'],
  ['2026-11-01', '19:00', '2026-11-02T01:00:00.000Z'],
];
const out = [];
for (const [ymd, hm, want] of cases) { const got = ctTimeToDate(ymd, hm).toISOString(); out.push({ ymd, hm, want, got, pass: got === want }); }
// ct() on instants either side of the switches
const inst = [['2026-11-01T06:30:00Z', '2026-11-01', 1, 30], ['2026-11-01T07:30:00Z', '2026-11-01', 1, 30], ['2027-03-14T07:59:00Z', '2027-03-14', 1, 59], ['2027-03-14T08:00:00Z', '2027-03-14', 3, 0]];
for (const [iso, ymd, h, mi] of inst) { const p = ct(new Date(iso)); out.push({ instant: iso, want: `${ymd} ${h}:${mi}`, got: `${p.ymd} ${p.h}:${p.mi}`, pass: p.ymd === ymd && p.h === h && p.mi === mi }); }
// Round-trip sweep: every CFD clock block start, every day Oct 2026 - Dec 2027 (covers both switch days and 2027's Nov 7).
const clock = JSON.parse(fs.readFileSync((process.argv[2] || '.') + '/channels.json', 'utf8')).clock;
let sweepBad = [], sweepN = 0;
for (let t = Date.UTC(2026, 9, 1, 12); t <= Date.UTC(2027, 11, 31, 12); t += 86400000) {
  const ymd = new Date(t).toISOString().slice(0, 10);
  for (const blk of clock) { sweepN++; const d = ctTimeToDate(ymd, blk.start); const p = ct(d);
    const hm = `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
    if (p.ymd !== ymd || hm !== blk.start) sweepBad.push(`${ymd} ${blk.start} -> ${p.ymd} ${hm}`); }
}
out.push({ sweep: `${sweepN} block starts round-trip through Central time`, bad: sweepBad.slice(0, 5), pass: sweepBad.length === 0 });
console.log(JSON.stringify({ tz: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone, results: out }, null, 1));
process.exit(out.every(r => r.pass) ? 0 : 1);
