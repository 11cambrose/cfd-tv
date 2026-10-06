// CFD TV headless smoke. Usage: node smoke.mjs <baseUrl> [--block-embeds] [--out file]
// Needs puppeteer-core (CHROME_PATH or /usr/bin/google-chrome) and optionally axe-core.
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire(import.meta.url);
const req = m => { try { return require(m); } catch { return require((process.env.QA_NODE_MODULES || './node_modules') + '/' + m); } };
const puppeteer = req('puppeteer-core');
let axeSrc = null; try { axeSrc = fs.readFileSync(require.resolve((process.env.QA_NODE_MODULES || './node_modules') + '/axe-core/axe.min.js'), 'utf8'); } catch {}
const base = (process.argv[2] || 'http://localhost:8000').replace(/\/$/, '');
const BLOCK = process.argv.includes('--block-embeds');
const knIdx = process.argv.indexOf('--known'); const KNOWN = knIdx > 0 ? JSON.parse(fs.readFileSync(process.argv[knIdx + 1], 'utf8')) : {};
const outIdx = process.argv.indexOf('--out'); const OUT = outIdx > 0 ? process.argv[outIdx + 1] : null;
const results = []; const rec = (name, pass, detail = '') => { const known = !pass && KNOWN[name]; results.push({ name, pass: !!pass, known: known || undefined, detail: String(detail) }); console.log(`${pass ? 'PASS' : known ? 'KNOWN' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}${known ? '  [known: ' + known + ']' : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Fake YouTube IFrame API for deterministic error tests (GitHub runners can get every embed refused).
// failFirst = how many loadVideoById calls error (code 150) before videos start "playing".
const ytStub = failFirst => `window.YT={PlayerState:{ENDED:0,PLAYING:1},Player:function(id,o){const ev=o.events||{},me=this;let n=0;
  const el=document.getElementById(id),f=document.createElement('iframe');f.title='YouTube video player';f.id=id;el.replaceWith(f);
  me.loadVideoById=function(v){me.v=v.videoId;const k=n++;setTimeout(()=>{if(k<${failFirst})ev.onError&&ev.onError({data:150,target:me});else ev.onStateChange&&ev.onStateChange({data:1,target:me});},30);};
  me.mute=me.unMute=me.pauseVideo=function(){};me.getVideoData=function(){return null;};setTimeout(()=>ev.onReady&&ev.onReady({target:me}),50);}};
  setTimeout(()=>window.onYouTubeIframeAPIReady&&window.onYouTubeIframeAPIReady(),10);`;
const THIRD = /youtube\.com|ytimg|googlevideo|spotify\.com|scdn\.co|instagram\.com|cdninstagram|doubleclick|google/;

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
async function open(path, { mobile = false, tz = null, hangYT = false, ytFail = null } = {}) {
  const page = await browser.newPage(); const errs = []; const reqs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !THIRD.test(m.location()?.url || '')) errs.push('console: ' + m.text()); });
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (ytFail !== null && /youtube\.com\/iframe_api/.test(u)) return r.respond({ status: 200, contentType: 'text/javascript', body: ytStub(ytFail) }); if (ytFail !== null && THIRD.test(u)) return r.abort('blockedbyclient'); if (hangYT && /youtube\.com\/iframe_api/.test(u)) { reqs.push({ u, hung: true }); return; } if (BLOCK && THIRD.test(u)) { reqs.push({ u, blocked: true }); return r.abort('blockedbyclient'); } reqs.push({ u }); r.continue(); });
  if (tz) await page.emulateTimezone(tz);
  if (mobile) { await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }); await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'); }
  else await page.setViewport({ width: 1440, height: 900 });
  const t0 = Date.now(); await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.CFDTV && window.CFDTV.channels.length > 0, { timeout: 15000 }).catch(() => {});
  return { page, errs, reqs, loadMs: Date.now() - t0 };
}
const osd = page => page.evaluate(() => ({ num: document.querySelector('#osdNum').textContent, name: document.querySelector('#osdName').textContent, lane: document.querySelector('#osdLane').className, url: location.search }));
const visible = (page, sel) => page.$eval(sel, el => !el.hidden && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden').catch(() => false);

try {
  // 1. desktop boot
  let { page, errs, reqs, loadMs } = await open('/');
  const n = await page.evaluate(() => window.CFDTV.channels.length);
  rec('desktop: data loads, 46 channels after filters', n === 46, `${n} channels, DOMContentLoaded+data in ${loadMs} ms`);
  rec('desktop: splash visible before tune-in', await visible(page, '#splash'));
  await page.click('#btnStart'); await sleep(1500);
  let o = await osd(page);
  rec('desktop: Tune in defaults to CH 19', o.num === '19' && o.url === '?ch=19', JSON.stringify(o));
  // channel flip
  await page.keyboard.press('ArrowUp'); await sleep(400); o = await osd(page); rec('flip: ArrowUp 19→20', o.num === '20', o.num);
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await sleep(400); o = await osd(page); rec('flip: ArrowDown x2 20→18', o.num === '18', o.num);
  await page.keyboard.press('PageUp'); await sleep(300); o = await osd(page); rec('flip: PageUp 18→19', o.num === '19', o.num);
  await page.keyboard.type('35'); await sleep(900); o = await osd(page); rec('flip: typed 35 tunes CH 35 (Spotify)', o.num === '35' && await visible(page, '#spot'), o.num);
  await page.keyboard.type('73'); await sleep(900); o = await osd(page); rec('flip: typed 73 shows highlight card', o.num === '73' && await visible(page, '#card'), o.num);
  await page.keyboard.press('ArrowUp'); await sleep(400); o = await osd(page); rec('flip: wraps 73→02', o.num === '02', o.num);
  await page.keyboard.press('ArrowDown'); await sleep(400); o = await osd(page); rec('flip: wraps 02→73', o.num === '73', o.num);
  await page.keyboard.type('55'); await sleep(900); o = await osd(page); rec('flip: missing CH 55 keeps current channel', o.num === '73', o.num);
  // guide + lanes
  await page.keyboard.press('g'); await sleep(300);
  const lanes = await page.evaluate(() => { const z = [...document.querySelectorAll('#laneZone li')].map(li => +li.dataset.n), b = [...document.querySelectorAll('#laneBrose li')].map(li => +li.dataset.n); const ch = window.CFDTV.channels; return { z, b, zBad: z.filter(n => ch.find(c => c.num === n).lane !== 'zone'), bBad: b.filter(n => ch.find(c => c.num === n).lane !== 'brose') }; });
  rec('guide: G opens guide', await visible(page, '#guide'));
  rec('lanes: zone column only zone channels', lanes.z.length === 11 && !lanes.zBad.length, `zone=${lanes.z.length} bad=${lanes.zBad}`);
  rec('lanes: brose column only brose channels', lanes.b.length === 35 && !lanes.bBad.length, `brose=${lanes.b.length} bad=${lanes.bBad}`);
  await page.click('#laneZone li[data-n="4"]'); await sleep(400); o = await osd(page); rec('guide: click CH 04 tunes it', o.num === '04' && o.lane.includes('zone'), JSON.stringify(o));
  await page.keyboard.press('Escape'); await page.keyboard.press('e'); await sleep(400);
  const epg = await page.evaluate(() => ({ blocks: document.querySelectorAll('#dayclock .blk').length, now: document.querySelectorAll('#dayclock .blk.now').length, rows: document.querySelectorAll('#grid .grow:not(.lanehead)').length, date: document.querySelector('#epgDate').textContent, clock: document.querySelector('#clock').textContent }));
  rec('epg: E opens Tonight, 9 blocks (no song logged), exactly one ON NOW', epg.blocks === 9 && epg.now === 1, JSON.stringify(epg));
  rec('epg: 3-hour grid has a row per channel', epg.rows === 46, epg.rows);
  const ctNow = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
  rec('clock: top bar shows Central time', epg.clock.endsWith(' CT') && epg.clock.startsWith(ctNow.slice(0, -3).split(':')[0]), `${epg.clock} vs CT ${ctNow}`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('m'); await sleep(200); const mute = await page.$eval('#btnMute', b => b.textContent); rec('sound: M toggles label', /Sound (on|off)/.test(mute), mute);
  // YouTube player state on CH 19
  await page.keyboard.type('19'); await sleep(BLOCK ? 1500 : 5000);
  const yt = await page.evaluate(() => ({ iframe: !!document.querySelector('#ytwrap iframe'), vis: document.querySelector('#ytwrap').style.visibility, now: document.querySelector('#osdNow').textContent }));
  if (BLOCK) {
    const card = await page.evaluate(() => { const c = document.querySelector('#card'); const a = c && c.querySelector('a.watch'); return { visible: !!c && !c.hidden, text: c ? c.innerText.slice(0, 160) : '', href: a ? a.href : null, state: window.CFDTV.ytState }; });
    rec('blocked embeds: YouTube channel shows "YouTube is blocked on this network" card', !yt.iframe && card.visible && /YouTube is blocked on this network/.test(card.text) && card.state === 'blocked', JSON.stringify({ osd: yt.now, state: card.state }));
    rec('blocked embeds: card links out to the live video on YouTube', !!card.href && card.href.startsWith('https://www.youtube.com/watch?v='), card.href);
    await page.keyboard.type('35'); await sleep(900); o = await osd(page);
    rec('blocked embeds: Spotify channel still tunes (card hidden)', o.num === '35' && !(await visible(page, '#card')), o.num);
  }
  else rec('embeds: YouTube iframe created on CH 19', yt.iframe, JSON.stringify(yt));
  rec('no first-party JS errors (desktop)', errs.length === 0, errs.slice(0, 5).join(' | '));
  // perf: first-party bytes
  const perf = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.startsWith(location.origin)).map(r => ({ n: r.name.replace(location.origin, ''), kb: Math.round((r.encodedBodySize || r.transferSize) / 1024), ms: Math.round(r.duration) })));
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) }; });
  const fpKB = perf.reduce((a, r) => a + r.kb, 0) + 4;
  rec('perf: first-party payload under 500 KB uncompressed', fpKB < 500, `${fpKB} KB (${perf.map(r => r.n + ' ' + r.kb + 'KB').join(', ')}); DCL ${nav.dcl} ms, load ${nav.load} ms (localhost)`);
  rec('perf: third-party requests counted', true, `${reqs.filter(r => THIRD.test(r.u)).length} third-party requests${BLOCK ? ' (blocked)' : ''}`);
  // a11y
  if (axeSrc) { await page.addScriptTag({ content: axeSrc }); const ax = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }); return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length })); });
    const serious = ax.filter(v => v.impact === 'serious' || v.impact === 'critical'); rec('a11y: axe WCAG 2 A/AA, no serious/critical', serious.length === 0, JSON.stringify(ax)); }
  const a11y = await page.evaluate(() => ({ lang: document.documentElement.lang, unnamedButtons: [...document.querySelectorAll('button')].filter(b => !(b.textContent.trim() || b.getAttribute('aria-label'))).length, iframesNoTitle: [...document.querySelectorAll('iframe')].filter(f => !f.title).length, focusVisible: !!document.querySelector('style,link') }));
  rec('a11y: lang set, buttons named, iframes titled', a11y.lang === 'en' && a11y.unnamedButtons === 0 && a11y.iframesNoTitle === 0, JSON.stringify(a11y));
  await page.close();

  // 2. deep links
  for (const [q, want] of [['?ch=2', '02'], ['?ch=31', '31'], ['?ch=72', '72'], ['?ch=99', '19'], ['?ch=abc', '19']]) {
    ({ page, errs } = await open('/' + q)); const hint = await page.$eval('#splash p', p => p.textContent); await page.click('#btnStart'); await sleep(900); o = await osd(page);
    rec(`deep link ${q} → CH ${want}`, o.num === want, `${o.num} ${o.name}; splash: "${hint}"`); await page.close(); }
  ({ page } = await open('/?epg')); await sleep(800); rec('deep link ?epg opens Tonight grid on load', await visible(page, '#epg')); await page.close();
  ({ page } = await open('/?ch=19')); await sleep(500); const hint = await page.$eval('#splash p', p => p.textContent); rec('deep link ?ch=19 shows "Channel 19 is waiting" on splash', /Channel 19 is waiting/.test(hint), hint); await page.close();
  { // YouTube API loads but embeds error (stubbed): one dead video is skipped; a refusal streak flips to the link-out card; no JS errors
    let sp, se; ({ page: sp, errs: se } = await open('/?ch=19', { ytFail: 1 })); await sp.click('#btnStart'); await sleep(1500);
    const one = await sp.evaluate(() => ({ state: window.CFDTV.ytState, bad: window.CFDTV.badCount, card: !document.querySelector('#card').hidden }));
    rec('yt errors: one dead video is skipped, player keeps going', one.state === 'ready' && one.bad === 1 && !one.card && se.length === 0, JSON.stringify({ ...one, errs: se }));
    await sp.close();
    ({ page: sp, errs: se } = await open('/?ch=8', { ytFail: 999 })); await sp.click('#btnStart'); await sleep(1500);
    const few = await sp.evaluate(() => ({ state: window.CFDTV.ytState, text: document.querySelector('#card').hidden ? '' : document.querySelector('#card').innerText.slice(0, 70) }));
    rec('yt errors: channel whose every video fails shows "No playable videos" card, no crash', /No playable videos/.test(few.text) && se.length === 0, JSON.stringify({ ...few, errs: se.slice(0, 2) }));
    await sp.keyboard.press('ArrowDown'); await sleep(400); await sp.keyboard.press('ArrowDown'); await sleep(1500);
    const all = await sp.evaluate(() => ({ state: window.CFDTV.ytState, reason: window.CFDTV.ytBlockReason, bad: window.CFDTV.badCount, text: document.querySelector('#card').hidden ? '' : document.querySelector('#card').innerText.slice(0, 80) }));
    rec('yt errors: refusal streak flips to "not playing embedded videos" card and un-bans the streak', all.state === 'blocked' && all.reason === 'playback' && /isn.t playing embedded videos/.test(all.text) && se.length === 0, JSON.stringify({ ...all, errs: se.slice(0, 2) }));
    await sp.close();
  }
  if (BLOCK) { // black-holed YouTube (request never answers): player script must time out, not hang forever
    let hp; ({ page: hp } = await open('/?ch=19&epg', { hangYT: true })); await sleep(500);
    const early = await hp.evaluate(() => ({ epg: !document.querySelector('#epg').hidden, guideItems: document.querySelectorAll('.lane li').length }));
    rec('hung YouTube: guide + ?epg work before the player script settles', early.epg && early.guideItems === 46, JSON.stringify(early));
    await hp.click('#btnStart'); await sleep(9500);
    const late = await hp.evaluate(() => ({ state: window.CFDTV.ytState, card: !document.querySelector('#card').hidden, text: document.querySelector('#card').innerText.slice(0, 60) }));
    rec('hung YouTube: 8 s timeout flips to the blocked card', late.state === 'blocked' && late.card && /blocked on this network/.test(late.text), JSON.stringify(late));
    await hp.close(); }

  // 3. visitor in another timezone still sees CT
  ({ page } = await open('/?epg', { tz: 'Asia/Tokyo' })); await sleep(800);
  const tk = await page.evaluate(() => ({ clock: document.querySelector('#clock').textContent, date: document.querySelector('#epgDate').textContent, now: document.querySelectorAll('#dayclock .blk.now').length, title: (document.querySelector('#dayclock .blk.now') || {}).innerText }));
  const ctNow2 = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' });
  rec('tz: Tokyo-zoned browser still shows Central clock + same ON NOW block', tk.clock.startsWith(ctNow2.split(':')[0] + ':') && tk.now === 1, JSON.stringify(tk)); await page.close();

  // 4. mobile
  ({ page, errs } = await open('/?ch=12', { mobile: true }));
  await page.tap('#btnStart'); await sleep(1200);
  const mob = await page.evaluate(() => ({ overflowX: document.documentElement.scrollWidth > window.innerWidth, remote: !!document.querySelector('#remote') && getComputedStyle(document.querySelector('#remote')).display !== 'none', screenH: Math.round(document.querySelector('#screen').getBoundingClientRect().height), btnH: Math.round(document.querySelector('#chUp').getBoundingClientRect().height) }));
  rec('mobile 390x844: no horizontal overflow', !mob.overflowX, JSON.stringify(mob));
  rec('mobile: remote buttons visible, tap targets ≥ 44px', mob.remote && mob.btnH >= 44, `CH▲ height ${mob.btnH}px`);
  await page.tap('#btnGuide'); await sleep(300);
  const small = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== 'hidden'; }).map(b => { const r = b.getBoundingClientRect(); return { b: (b.id || b.textContent.trim()).slice(0, 12), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.w < 44 || x.h < 44));
  rec('mobile: every visible button ≥ 44×44 (top bar, remote, guide close)', small.length === 0, JSON.stringify(small));
  await page.keyboard.press('Escape'); await sleep(200);
  await page.tap('#chUp'); await sleep(400); o = await osd(page); rec('mobile: CH ▲ tap 12→13', o.num === '13', o.num);
  const box = await page.$eval('#screen', s => { const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.evaluate(({ x, y }) => { const s = document.querySelector('#screen'); const mk = (type, yy) => { const t = new Touch({ identifier: 1, target: s, clientX: x, clientY: yy }); s.dispatchEvent(new TouchEvent(type, { bubbles: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t] })); }; mk('touchstart', y + 80); mk('touchend', y - 80); }, box);
  await sleep(400); o = await osd(page); rec('mobile: swipe up 13→14', o.num === '14', o.num);
  await page.tap('#btnPad'); await sleep(200); for (const k of ['4', '0']) { const b = await page.$$('.pad-grid button'); for (const el of b) if ((await el.evaluate(e => e.textContent)) === k) { await el.tap(); break; } }
  for (const el of await page.$$('.pad-grid button')) if ((await el.evaluate(e => e.textContent)) === 'OK') { await el.tap(); break; }
  await sleep(400); o = await osd(page); rec('mobile: number pad 4-0-OK tunes CH 40', o.num === '40', o.num);
  rec('no first-party JS errors (mobile)', errs.length === 0, errs.slice(0, 5).join(' | '));
  await page.screenshot({ path: (OUT ? OUT.replace(/\.json$/, '') : '/tmp/cfdtv') + '-mobile.png' });
  await page.close();
} catch (e) { rec('smoke harness crashed', false, e.stack); }
await browser.close();
const summary = { base, blockEmbeds: BLOCK, ranAt: new Date().toISOString(), pass: results.filter(r => r.pass).length, fail: results.filter(r => !r.pass && !r.known).length, known: results.filter(r => r.known).length, results };
if (OUT) fs.writeFileSync(OUT, JSON.stringify(summary, null, 1));
console.log(`\n${summary.pass} pass / ${summary.fail} fail / ${summary.known} known`);
process.exit(summary.fail ? 1 : 0);
