/* CFD TV — static channel surfer. No build step. Data: channels.json + data/highlights.json */
(function(){
'use strict';
const TZ='America/Chicago';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let DATA=null,HL=null,CH=[],cur=-1,player=null,ytReady=false,muted=true,started=false,osdTimer=0,numBuf='',numTimer=0,tickTimer=0,bad=new Set();
let ANCHOR=0;

/* ---------- Central-time helpers ---------- */
const fmtParts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function ct(d){const p={};for(const x of fmtParts.formatToParts(d||new Date()))p[x.type]=x.value;
  return {y:+p.year,m:+p.month,d:+p.day,h:+p.hour%24,mi:+p.minute,s:+p.second,ymd:`${p.year}-${p.month}-${p.day}`,mmdd:`${p.month}${p.day}`};}
function ctOffsetMs(d){const p=ct(d);return Date.UTC(p.y,p.m-1,p.d,p.h,p.mi,p.s)-Math.floor(d.getTime()/1000)*1000;}
function ctTimeToDate(ymd,hhmm){ // "2026-10-06","04:35" -> Date (handles DST by re-checking offset)
  const [Y,M,D]=ymd.split('-').map(Number);let [h,mi]=hhmm.split(':').map(Number);
  let guess=Date.UTC(Y,M-1,D,h,mi)-ctOffsetMs(new Date(Date.UTC(Y,M-1,D,12)));
  return new Date(guess);}
const fmtTime=d=>d.toLocaleTimeString('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit'});
function hm(s){s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h}h ${m}m`:`${m}m`;}

/* ---------- schedule math (communal clock) ---------- */
function ytAt(c,t){ // returns {i,offset,video,startedAt,endsAt}
  const vids=c.videos.filter(v=>!bad.has(v[0]));if(!vids.length)return null;
  const total=vids.reduce((a,v)=>a+v[1],0);let pos=(((t-ANCHOR)/1000)%total+total)%total;
  for(let i=0;i<vids.length;i++){if(pos<vids[i][1]){const st=t-pos*1000;return {i,offset:pos,video:vids[i],start:st,end:st+vids[i][1]*1000,vids};}pos-=vids[i][1];}
  return {i:0,offset:0,video:vids[0],start:t,end:t+vids[0][1]*1000,vids};}
function spHourly(c,t){const n=c.playlists.length;if(!n)return null;const k=Math.floor((t-ANCHOR)/3600000);const i=((k%n)+n)%n;const st=ANCHOR+k*3600000;return {p:c.playlists[i],start:st,end:st+3600000};}
function diceToday(c,ymd){const rows=c.dice.filter(r=>r.date<=ymd);const last=rows.length?rows[rows.length-1].date:null;return {last,today:c.dice.filter(r=>r.date===ymd),landed:last?c.dice.filter(r=>r.date===last):[],next:c.dice.filter(r=>r.date>ymd).slice(0,6)};}
function forecast(ymd,t){const dj=byNum(31),dc=byNum(43);const d=diceToday(dc,ymd);
  if(d.today.length)return {list:d.today,why:'Landing today on the DJ Brose dice plan'};
  const h=spHourly(dj,t);return {list:[{id:h.p[0],title:h.p[1]}],why:'No dice landing today, so the DJ Brose channel rotation'};}

function inCommute(t){const b=DATA.clock.find(x=>x.kind==='forecast');const ymd=ct(new Date(t)).ymd;return t>=ctTimeToDate(ymd,b.start).getTime()&&t<ctTimeToDate(ymd,b.end).getTime();}
/* ---------- data ---------- */
const byNum=n=>CH.find(c=>c.num===n);
const laneLabel=l=>DATA.lanes[l].label;
async function load(){
  const [a,b]=await Promise.all([fetch('channels.json').then(r=>r.json()),fetch('data/highlights.json').then(r=>r.json())]);
  DATA=a;HL=b;CH=a.channels.filter(c=>c.type!=='youtube'||c.videos.length).filter(c=>c.type!=='spotify'||(c.playlists||c.dice||[]).length);
  ANCHOR=Date.parse(a.clock_anchor_utc);
}

/* ---------- YouTube ---------- */
function loadYT(){return new Promise(res=>{if(window.YT&&YT.Player)return res();window.onYouTubeIframeAPIReady=res;const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';document.head.appendChild(s);});}
function makePlayer(){return new Promise(res=>{player=new YT.Player('yt',{width:'100%',height:'100%',playerVars:{autoplay:1,mute:1,controls:0,rel:0,playsinline:1,modestbranding:1,iv_load_policy:3,disablekb:1},
  events:{onReady:()=>{ytReady=true;res();},onStateChange:e=>{if(e.data===0)tune(cur,true);},onError:e=>{const c=CH[cur];if(c&&c.type==='youtube'){const a=ytAt(c,Date.now());if(a){bad.add(a.video[0]);}tune(cur,true);}}}});});}

/* ---------- tuning ---------- */
function staticFlash(){const s=$('#static');s.classList.add('on');setTimeout(()=>s.classList.remove('on'),380);}
function showOSD(c,now){$('#osdNum').textContent=String(c.num).padStart(2,'0');const L=$('#osdLane');L.textContent=laneLabel(c.lane);L.className='osd-lane '+c.lane;$('#osdName').textContent=c.name;$('#osdNow').textContent=now||'';
  const o=$('#osd');o.classList.remove('fade');clearTimeout(osdTimer);osdTimer=setTimeout(()=>o.classList.add('fade'),5000);}
function hideAll(){$('#ytwrap').style.visibility='hidden';const sp=$('#spot');sp.hidden=true;$('#card').hidden=true;if(ytReady&&player.pauseVideo)try{player.pauseVideo();}catch(e){}}
function tune(i,quiet){
  if(!CH.length)return;i=((i%CH.length)+CH.length)%CH.length;const changed=i!==cur;cur=i;const c=CH[i];const now=Date.now();
  if(changed&&!quiet)staticFlash();
  history.replaceState(null,'','?ch='+c.num);
  document.querySelectorAll('.lane li').forEach(li=>li.classList.toggle('on',+li.dataset.n===c.num));
  if(c.type==='youtube'){
    const a=ytAt(c,now);hideAll();$('#ytwrap').style.visibility='visible';
    if(ytReady){player.loadVideoById({videoId:a.video[0],startSeconds:Math.floor(a.offset)});if(muted)player.mute();else player.unMute();}
    showOSD(c,`${a.video[2]} · ${hm((a.end-now)/1000)} left`);
  } else if(c.type==='spotify'){
    hideAll();let p,note;const t=ct();
    if(c.mode==='dice'){const d=diceToday(c,t.ymd);const r=(d.today[0]||d.landed[0]||c.dice[0]);p=[r.id,r.title];note=d.today.length?'Lands today':`Last landing ${d.last||'none yet'}`;}
    else if(c.num===31&&inCommute(now)){const f=forecast(t.ymd,now);p=[f.list[0].id,f.list[0].title];note='Morning commute forecast · '+f.why;}
    else {const h=spHourly(c,now);p=h.p;note=`until ${fmtTime(new Date(h.end))}`;}
    const sp=$('#spot');const src=`https://open.spotify.com/embed/playlist/${encodeURIComponent(p[0])}?utm_source=cfdtv&theme=0`;if(sp.src!==src)sp.src=src;sp.hidden=false;
    showOSD(c,`${p[1]} · ${note}`);
  } else { hideAll();renderHighlight(c);showOSD(c,'Born on this day · '+ct().mmdd.slice(0,2)+'/'+ct().mmdd.slice(2)); }
}
function surf(d){tune(cur+d);}
function goNum(n){const i=CH.findIndex(c=>c.num===n);if(i>=0)tune(i);else{const e=$('#numEntry');e.textContent=n+' —';e.hidden=false;setTimeout(()=>e.hidden=true,900);}}

/* ---------- highlight channels (70–73) ---------- */
function igEmbed(kind,code){const k=kind==='reel'?'reel':(kind==='tv'||kind==='igtv')?'tv':'p';return `https://www.instagram.com/${k}/${encodeURIComponent(code)}/embed/`;}
function igLink(kind,code){const k=kind==='reel'?'reel':(kind==='tv'||kind==='igtv')?'tv':'p';return `https://www.instagram.com/${k}/${encodeURIComponent(code)}/`;}
function nearestDay(map,mmdd){const keys=Object.keys(map).sort();if(!keys.length)return null;return keys.find(k=>k>=mmdd)||keys[0];}
const wp=id=>`https://coffeefordessert.com/?p=${id}`;
function renderHighlight(c){
  const t=ct();const card=$('#card');card.className=c.lane;card.hidden=false;let h=`<h2>${esc(c.name)}</h2><p class="muted">${esc(c.source)}</p>`;
  if(c.key==='tcz'){const e=HL.tcz[t.mmdd]||{};
    h+=`<h3>Chess Master vs Chess Villain · 11:14 am–1:14 pm</h3><p>${esc(e.lunch||'No matchup on file for today.')}</p>`;
    const r=DATA.rail[t.ymd];h+=`<h3>Alarm study · 4:35 am</h3><p>${r?`<a href="${wp(r[1])}" target="_blank" rel="noopener">${esc(r[0])}</a>`:'Today\'s 4:45 TCZ rail post is on <a href="https://coffeefordessert.com/" target="_blank" rel="noopener">coffeefordessert.com</a>.'}</p>`;
    if(e.born&&e.born.length)h+=`<h3>Studies born today</h3><ul>${e.born.map(b=>`<li><a href="${wp(b[1])}" target="_blank" rel="noopener">${esc(b[0])}</a> <span class="muted">${esc(b[2])}</span></li>`).join('')}</ul>`;
    if(e.study)h+=`<h3>From the archive index</h3><p>${esc(e.study[0])} ${e.study[1].map(id=>`<a href="${wp(id)}" target="_blank" rel="noopener">#${id}</a>`).join(' ')}</p>`;
    if(e.ig)h+=`<p><a href="${esc(e.ig)}" target="_blank" rel="noopener">Instagram from ${esc(e.ig_date)}</a></p>`;
  } else if(c.key==='stories'){let k=t.mmdd,items=HL.stories[k];let note='';if(!items){k=nearestDay(HL.stories,t.mmdd);items=HL.stories[k]||[];note=`Nothing on this day. Next story day: ${k.slice(0,2)}/${k.slice(2)}.`;}
    h+=note?`<p class="muted">${esc(note)}</p>`:'';h+=`<ul>${items.map(s=>`<li><b>${esc(s[0])}</b> ${esc(s[1]||'(no caption)')}</li>`).join('')}</ul><p class="muted">Stories expire on Instagram, so this is the dated log only. Song names are not in the export.</p>`;
  } else {const map=HL[c.key];let k=t.mmdd,items=map[k];let note='';if(!items){k=nearestDay(map,t.mmdd);items=map[k]||[];note=`Nothing born today. Next: ${k.slice(0,2)}/${k.slice(2)}.`;}
    const posts=items.filter(x=>x[1]==='p'||x[1]==='reel'||x[1]==='tv'||x[1]==='igtv');
    if(note)h+=`<p class="muted">${esc(note)}</p>`;
    if(posts.length){const pick=posts[Math.floor(Date.now()/600000)%posts.length];h+=`<iframe class="igframe" src="${igEmbed(pick[1],pick[2])}" loading="lazy" title="Instagram post"></iframe>`;}
    h+=`<ul>${items.map(x=>{const u=(x[1]==='link')?x[2]:igLink(x[1],x[2]);return `<li>${esc(x[0])} · <a href="${esc(u)}" target="_blank" rel="noopener">${esc(x[1]==='link'?'link':x[1])}</a></li>`;}).join('')}</ul><p class="muted">Dates are when the link was sent in the thread, not when the post was first published.</p>`;
  }
  card.innerHTML=h;
}

/* ---------- guide ---------- */
function renderGuide(){const z=$('#laneZone'),b=$('#laneBrose');z.innerHTML='';b.innerHTML='';
  for(const c of CH){const li=document.createElement('li');li.dataset.n=c.num;li.innerHTML=`<span class="n">${String(c.num).padStart(2,'0')}</span><span>${esc(c.name)}</span><span class="t">${c.type==='highlight'?'IG':c.type==='spotify'?'Spotify':'YouTube'}</span>`;
    li.onclick=()=>goNum(c.num);(c.lane==='zone'?z:b).appendChild(li);}}

/* ---------- Tonight EPG ---------- */
function blockSub(b,ymd,t){const e=HL.tcz[ct(t).mmdd]||{};
  switch(b.kind){
    case 'study':{const r=DATA.rail[ymd];if(r)return `<a href="${wp(r[1])}" target="_blank" rel="noopener">${esc(r[0])}</a>`;const born=(e.born||[])[0];return born?`Born today: <a href="${wp(born[1])}" target="_blank" rel="noopener">${esc(born[0])}</a>`:'The 4:45 post on coffeefordessert.com';}
    case 'forecast':{const f=forecast(ymd,ctTimeToDate(ymd,'07:00').getTime());return esc(f.list.map(x=>x.title).join(' · '))+` <span class="muted">(${esc(f.why)})</span>`;}
    case 'lunch':return esc(e.lunch||'Matchup to be named');
    case 'song':{const s=DATA.songs[ymd];return s?esc(s.title+(s.artist?' — '+s.artist:'')):'';}
    case 'icymi':{const n=k=>(HL[k][ct(t).mmdd]||[]).length;return `Study, lunch game, and born-today picks: ${n('stories')} stories · ${n('almanac')} galleries · ${n('evergreen')} evergreen`;}
  }
  const c=byNum(b.ch);if(c&&c.type==='youtube'){const a=ytAt(c,ctTimeToDate(ymd,b.start).getTime());return a?esc(a.video[2]):'';}
  return '';
}
function renderEPG(){
  const now=new Date(),t=ct(now),ymd=t.ymd;$('#epgDate').textContent=now.toLocaleDateString('en-US',{timeZone:TZ,weekday:'long',month:'long',day:'numeric'})+' · CT';
  const dc=$('#dayclock');dc.innerHTML='';let nowBlock=null;
  for(const b of DATA.clock){
    if(b.kind==='song'&&!DATA.songs[ymd])continue; // song of the day only on dated days
    const s=ctTimeToDate(ymd,b.start),e=b.end==='24:00'?new Date(ctTimeToDate(ymd,'23:59').getTime()+60000):ctTimeToDate(ymd,b.end);
    const isNow=now>=s&&now<e,past=now>=e;if(isNow)nowBlock=b;
    const el=document.createElement('div');el.className=`blk ${b.lane}${isNow?' now':''}${past?' past':''}`;
    el.innerHTML=`<div class="tm">${fmtTime(s)}–${fmtTime(e)}</div><div><div>${esc(b.title)}</div><div class="sub">${blockSub(b,ymd,s)}</div></div><div class="ch">CH ${String(b.ch).padStart(2,'0')}</div>`;
    el.onclick=ev=>{if(ev.target.tagName!=='A')goNum(b.ch);};dc.appendChild(el);}
  $('#nowcard').innerHTML=nowBlock?`<b>On now:</b> ${esc(nowBlock.title)} on CH ${nowBlock.ch} · <span class="muted">${laneLabel(nowBlock.lane)}</span>`:'';
  // grid: next 3h
  const g=$('#grid');g.innerHTML='';const t0=Math.floor(now.getTime()/1800000)*1800000,span=3*3600000,t1=t0+span;
  const ticks=document.createElement('div');ticks.className='ticks';let tk='<div></div><div class="tk">';for(let x=t0;x<=t1;x+=1800000)tk+=`<span style="left:${(x-t0)/span*100}%">${fmtTime(new Date(x))}</span>`;ticks.innerHTML=tk+'</div>';g.appendChild(ticks);
  for(const lane of ['zone','brose']){
    const lh=document.createElement('div');lh.className='grow lanehead '+lane;lh.textContent=laneLabel(lane);g.appendChild(lh);
    for(const c of CH.filter(c=>c.lane===lane)){
      const row=document.createElement('div');row.className='grow '+lane;const tr=document.createElement('div');tr.className='track';
      const lbl=document.createElement('div');lbl.className='lbl';lbl.innerHTML=`<b>${String(c.num).padStart(2,'0')}</b>${esc(c.name)}`;lbl.onclick=()=>goNum(c.num);
      const add=(s,e,title)=>{const a=Math.max(s,t0),b2=Math.min(e,t1);if(b2<=a)return;const p=document.createElement('div');p.className='prog';p.style.left=((a-t0)/span*100)+'%';p.style.width=((b2-a)/span*100)+'%';p.textContent=title;p.title=title;tr.appendChild(p);};
      if(c.type==='youtube'){let x=t0,guard=0;while(x<t1&&guard++<60){const a=ytAt(c,x);if(!a)break;add(a.start,a.end,a.video[2]);x=a.end+1;}}
      else if(c.type==='spotify'){if(c.mode==='dice'){const d=diceToday(c,ymd);const r=d.today[0]||d.landed[0];add(t0,t1,r?`${r.title} (${r.date})`:'—');}
        else {let x=t0;while(x<t1){const h=spHourly(c,x);add(h.start,h.end,h.p[1]);x=h.end;}}}
      else {const n=(c.key==='tcz')?((HL.tcz[t.mmdd]||{}).born||[]).length:(HL[c.key][t.mmdd]||[]).length;add(t0,t1,c.key==='tcz'?((HL.tcz[t.mmdd]||{}).lunch||'TCZ on this day'):`${n} born today`);}
      row.appendChild(lbl);row.appendChild(tr);g.appendChild(row);}
  }
}

/* ---------- input ---------- */
function numKey(d){numBuf=(numBuf+d).slice(-2);const e=$('#numEntry');e.textContent=numBuf.padStart(2,'-');e.hidden=false;clearTimeout(numTimer);
  numTimer=setTimeout(()=>{e.hidden=true;const n=parseInt(numBuf,10);numBuf='';if(!isNaN(n))goNum(n);},numBuf.length>=2?350:1300);}
function toggle(id,force){const p=$('#'+id);p.hidden=force===undefined?!p.hidden:!force;if(!p.hidden){if(id==='epg')renderEPG();p.scrollIntoView({behavior:'smooth',block:'start'});}}
function setMute(m){muted=m;$('#btnMute').textContent=m?'Sound off':'Sound on';if(ytReady)m?player.mute():player.unMute();}
function bind(){
  document.addEventListener('keydown',e=>{if(e.target.closest&&e.target.closest('input,textarea'))return;if(!started&&(e.key==='Enter'||e.key===' ')){start();e.preventDefault();return;}
    if(e.key==='ArrowUp'||e.key==='PageUp'){surf(1);e.preventDefault();}else if(e.key==='ArrowDown'||e.key==='PageDown'){surf(-1);e.preventDefault();}
    else if(/^[0-9]$/.test(e.key))numKey(e.key);else if(e.key==='g'||e.key==='G')toggle('guide');else if(e.key==='e'||e.key==='E')toggle('epg');
    else if(e.key==='m'||e.key==='M')setMute(!muted);else if(e.key==='Escape'){toggle('guide',false);toggle('epg',false);$('#pad').hidden=true;}});
  $('#chUp').onclick=()=>surf(1);$('#chDown').onclick=()=>surf(-1);$('#btnGuide').onclick=()=>toggle('guide');$('#btnEpg').onclick=()=>toggle('epg');$('#btnMute').onclick=()=>setMute(!muted);
  $('#btnStart').onclick=start;document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>toggle(b.dataset.close,false));
  const pg=$('.pad-grid');['1','2','3','4','5','6','7','8','9','⌫','0','OK'].forEach(k=>{const b=document.createElement('button');b.textContent=k;b.onclick=()=>{if(k==='⌫'){numBuf=numBuf.slice(0,-1);}else if(k==='OK'){const n=parseInt(numBuf,10);numBuf='';$('#pad').hidden=true;$('#numEntry').hidden=true;if(!isNaN(n))goNum(n);}else{numBuf=(numBuf+k).slice(-2);$('#numEntry').textContent=numBuf;$('#numEntry').hidden=false;}};pg.appendChild(b);});
  $('#btnPad').onclick=()=>{$('#pad').hidden=!$('#pad').hidden;};
  let y0=null;const sc=$('#screen');sc.addEventListener('touchstart',e=>{y0=e.touches[0].clientY;},{passive:true});
  sc.addEventListener('touchend',e=>{if(y0==null||!started)return;const dy=e.changedTouches[0].clientY-y0;if(Math.abs(dy)>50)surf(dy<0?1:-1);y0=null;},{passive:true});
}
async function start(){if(started)return;started=true;if(!CH.length)return;$('#splash').hidden=true;setMute(false);
  const q=new URLSearchParams(location.search);const n=parseInt(q.get('ch')||'',10);const i=CH.findIndex(c=>c.num===n);
  tune(i>=0?i:CH.findIndex(c=>c.num===19)>=0?CH.findIndex(c=>c.num===19):0,true);
  if(ytReady&&!muted)player.unMute();}
function tick(){const t=ct();const d=new Date();$('#clock').textContent=fmtTime(d)+' CT';
  const c=CH[cur];if(started&&c&&c.type==='spotify'&&c.mode==='hourly'&&((t.mi===0&&t.s<2)||(c.num===31&&t.s<2&&(t.h===7&&t.mi===0||t.h===8&&t.mi===30))))tune(cur,true);
  if(!$('#epg').hidden&&t.s===0)renderEPG();}

/* ---------- boot ---------- */
(async function(){
  bind();tickTimer=setInterval(tick,1000);tick();
  try{await load();}catch(e){$('#osdName').textContent='channels.json failed to load';console.error(e);return;}
  renderGuide();
  try{await loadYT();await makePlayer();}catch(e){console.warn('YouTube API unavailable',e);}
  if(started){const n=parseInt(new URLSearchParams(location.search).get('ch')||'19',10);const i=CH.findIndex(c=>c.num===n);tune(cur>=0?cur:(i>=0?i:0),true);}
  const q=new URLSearchParams(location.search);if(q.get('ch'))$('#splash').querySelector('p').textContent=`Channel ${q.get('ch')} is waiting.`;
  if(q.has('epg'))toggle('epg',true);
})();
window.CFDTV={ct,ytAt,spHourly,forecast,get data(){return DATA;},get channels(){return CH;},tune,goNum};
})();
