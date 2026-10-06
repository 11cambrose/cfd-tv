"""Build /workspace/cfd-tv/channels.json and data/highlights.json from verified sources (2026-10-06)."""
import json, csv, re, datetime
from collections import defaultdict
SITE='/workspace/cfd-tv'
ver=json.load(open(f'{SITE}/verify/yt-verified-2026-10-06.json'))
emb=json.load(open(f'{SITE}/verify/yt-oembed-2026-10-06.json'))
spok=json.load(open(f'{SITE}/verify/spotify-oembed-2026-10-06.json'))
byid={r['id']:r for r in ver}
ACCT={'thechesszone':'@thechesszone','coachchad':'@coachchad','11cambrose':'@brosetheghost (user/11cambrose)'}

def vids(*pids):
    out=[];seen=set()
    for p in pids:
        for v in byid[p]['playlist_videos']:
            if v['id'] in seen or emb.get(v['id'])!='200' or not v['sec']: continue
            seen.add(v['id']); out.append([v['id'],v['sec'],v['title']])
    return out

def yt(num,name,lane,pids,note=None):
    r=byid[pids[0]]
    src=[dict(id=p,kind=byid[p]['kind'],title=byid[p]['title'],account=ACCT[byid[p]['account']],
              url=(f"https://www.youtube.com/playlist?list={p}"),listed_count=byid[p].get('count')) for p in pids]
    c=dict(num=num,name=name,lane=lane,type='youtube',sources=src,videos=vids(*pids))
    if note: c['note']=note
    return c

Z='zone'; B='brose'
P=lambda t: next(r['id'] for r in ver if r['title']==t and r['kind']=='playlist')
U=lambda a: next(r['id'] for r in ver if r['account']==a and r['kind']=='uploads')
channels=[
 yt(2,'CFD Network',Z,[U('thechesszone'),U('coachchad'),P('GETTING STARTED in THE CHESS ZONE')],'Composite of the two chess desks\' uploads plus Getting Started.'),
 yt(3,'TCZ Now',Z,[U('thechesszone')]),
 yt(4,'Coach Chad',Z,[U('coachchad')]),
 yt(5,'Training in Public',Z,[P('[TCZ] Training in Public')]),
 yt(6,'Essentials',Z,[P("[TCZ] COACH CHAD'S CHESS ESSENTIALS")]),
 yt(7,'Instructor',Z,[P('[TCZ] CHESS INSTRUCTOR, COACH CHAD')]),
 yt(8,'Coaching AAA',Z,[P('Coaching Series AAA')]),
 yt(9,'IG Series',Z,[P('the.chesszone IG series')]),
 yt(10,'Chess Library',Z,[P('The Chess Zone')],'Lives on the brosetheghost account; airs in the chess lane.'),
 yt(11,'Brose Originals',B,[U('11cambrose')]),
 yt(12,'Coffee for Dessert',B,[P('CoffeeForDessert')]),
 yt(13,'What the Funk',B,[P('What the Funk')]),
 yt(14,'On the Lo-Lo',B,[P('Keep this on the Lo-Lo')]),
 yt(15,'Mac Miller',B,[P('Mac Miller: A Legacy of Living Life')]),
 yt(16,'Tiny Desk',B,[P('Best of Tiny Desk / Live Shows')]),
 yt(17,'Meaningwave',B,[P('M E A N I N G W A V E - Best of 19-20')]),
 yt(18,'Hip-Hop Guide',B,[P('A Personal Guide through the Infinite Realm of Hip-Hop')]),
 yt(19,'Living Dreams',B,[P('JD Casper - Living Dreams')]),
 yt(20,'Hip-Hop Pt. 2',B,[P('A Personal Guide through the Infinite Realm of Hip-Hop Part 2')]),
 yt(21,'Let It Go',B,[P('Let it Go and Be You')]),
 yt(22,'Imagine Magic',B,[P('Can you imagine magic?')]),
 yt(23,'Peace & Harmony',B,[P('A Personal Guide for Finding Peace and Harmony in your Universe')]),
 yt(24,'Futurism',B,[P('F U T U R I S M')]),
 yt(25,'Future Thinking',B,[P('Personal Guide for Innovative Future Thinking')]),
 yt(26,'Universal Mind',B,[P('Bits and Bites of Our Universal Mind')]),
 yt(27,'Documentaries',B,[P('Documentaries')]),
 yt(28,'Bulky Lectures',B,[P('Bulky Lectures')]),
 yt(29,'Collusion',B,[P('Collusion')]),
]
used={s['id'] for c in channels for s in c['sources']}
reserve=[dict(id=r['id'],title=r['title'],account=ACCT[r['account']],listed_count=r.get('count'),embeddable_videos=len(vids(r['id']))) for r in ver if r['id'] not in used]

# Spotify folder-as-channel
inv=json.load(open('/workspace/research/products/dj-brose-radio/SPOTIFY-11BROSE-INVENTORY.json'))
by={x['spotify_title'].strip():x['playlist_id'] for x in inv}
def sp(titles): return [[by[t],spok[by[t]].strip()] for t in titles if by[t] in spok]
groups=[
 (31,'DJ Brose',['DJ Brose 1.0','DJ Brose 2.0']),
 (32,'Meaningwave Masterpieces',['Meaningwave Masterpieces 1','Meaningwave Masterpieces 2','MEANINGWAVE MASTERPIECES VII - PROUD','W I S D O M W A V E']),
 (33,'What the Funk (Spotify)',['What the Funk','What the Funk 2.0','What the Funk 3.0','What the Frunk','What the Gunk','RU Down with the Funk :: RHCP']),
 (34,'Wolf Gang',['Wolf Gang A','Wolf Gang X','Wolf Gang Ö','OMM gangwolfhorse']),
 (35,'HRN',['HRN','HRN 2.0','HRN.OG']),
 (36,'chadio',['chadio radio','chADIO two point oh']),
 (37,'incense',['..incense..','..incense 2.0']),
 (38,'Okay Chad',['Okay Chad (2)','Okay Chad, enough talk 🤫']),
 (39,'Mac Crates',['..hbd Mac!','..hbd Mac 2.0 +','Mac','Mac Channels the Muse','i ordered The Big Mac Quest']),
 (40,'The Wind',['Wind Up','Wind Down (lay down)','Where the Wind Wiinds Up','Feather in the Wind','Drifting in a Nice Wind','Destroy the Wind: deconstruct/decompose/divine']),
 (41,'Lost and Found',['Lost and Found #111','Lost and Found Again: A Tribute to John Denver','was just Lost but then Chad Found these']),
 (42,'Chad Garage',['chaddilac','chaDILLA','chamborghini','Red Charrari','Light Chevy 100K Heavy','Chadzilla']),
]
allp=sorted([[i,t.strip()] for i,t in spok.items()],key=lambda x:x[1].lower())
channels.append(dict(num=30,name='AIR Full Loop',lane=B,type='spotify',mode='hourly',playlists=allp,note='Every verified public 11brose playlist, a new one each hour on the CFD clock.'))
for n,name,titles in groups:
    channels.append(dict(num=n,name=name,lane=B,type='spotify',mode='hourly',playlists=sp(titles),folder='provisional (grouped by playlist title; real Spotify folders not yet supplied)'))
dice=json.load(open('/workspace/cfd-charge/DJ-BROSE-DICE-2026-09-24.json'))['rows']
drows=[]
for r in dice:
    i=r['spotify_url'].rstrip('/').split('/')[-1].split('?')[0]
    if i in spok: drows.append(dict(date=r['landing'][:10],id=i,title=spok[i].strip()))
channels.append(dict(num=43,name='DJ Brose Dice',lane=B,type='spotify',mode='dice',dice=drows,note='Landing dates from the 2026-09-24 DJ Brose dice plan (plan only, nothing scheduled). Shows the most recent landing.'))

# Highlights 70-73
H=defaultdict(lambda: defaultdict(list))
def mmdd_from(s,fmt):
    return datetime.datetime.strptime(s,fmt).strftime('%m%d')
for r in csv.DictReader(open('/workspace/artifacts/11brose-stories-dates-2026-10-03.csv')):
    d=datetime.datetime.strptime(r['story_time'],'%b %d, %Y %I:%M %p')
    H['stories'][d.strftime('%m%d')].append([d.strftime('%Y-%m-%d %H:%M'),r['caption'].strip()])
def igkind(u):
    m=re.search(r'instagram\.com/(p|reel|reels|tv)/([A-Za-z0-9_-]+)',u)
    return (('reel' if m.group(1) in('reel','reels') else m.group(1)),m.group(2)) if m else (None,None)
for r in csv.DictReader(open('/workspace/artifacts/brose-almanac-thread-2026-10-03.csv')):
    if r['duplicate_of_earlier']: continue
    k,code=igkind(r['url']); H['almanac'][r['send_date'][5:7]+r['send_date'][8:10]].append([r['send_date'],k or 'link',code or r['url']])
for r in csv.DictReader(open('/workspace/artifacts/evergreen-reshare-ig-links-2026-10-03.csv')):
    if r['duplicate_of_earlier'] or r['kind'] not in('post','reel','igtv'): continue
    k,code=igkind(r['url'])
    if not code: continue
    H['evergreen'][r['send_date'][5:7]+r['send_date'][8:10]].append([r['send_date'],k,code])
idx={r['date'].replace('-',''):r for r in csv.DictReader(open('/workspace/artifacts/ledgers/TCZ-ARCHIVE-INDEX.csv'))}
studies=defaultdict(list)
for r in csv.DictReader(open('/workspace/artifacts/tcz-birthday-codes-2026-10-03.csv')):
    if r['status']=='published' and r['title'].strip(): studies[r['birthday'][:4]].append([r['title'].strip(),int(r['wp_id']),r['play_date']])
tcz={}
for k,r in idx.items():
    e=dict(lunch=r['lunch_film'].strip())
    if r['ig_url']: e['ig']=r['ig_url']; e['ig_date']=r['ig_date']
    if r['study_title']: e['study']=[r['study_title'],[int(x) for x in re.findall(r'\d+',r['study_wp'])]]
    if r['song_of_day'].strip(): e['song']=r['song_of_day'].strip()
    if studies.get(k): e['born']=studies[k]
    tcz[k]=e
rail={}
for p in json.load(open('/workspace/artifacts/tcz-published-bodies-2026-10-03.json')):
    if p['date'].endswith('T04:45:00'):
        rail[p['date'][:10]]=[re.sub('<[^>]+>','',p['title']['rendered']).replace('&#8217;','’').replace('&amp;','&').replace('&#8211;','–'),p['id']]
for n,name,lane,key,src in [(70,'Brose Stories · On This Day',B,'stories','11brose IG stories export (dates + captions)'),
                            (71,'cfd.galleries Almanac · Born Today',B,'almanac','cfd.galleries DM thread (IG links + send dates)'),
                            (72,'Coach Chad Evergreen · Born Today',Z,'evergreen','Coach Chad DM thread (IG post/reel links + send dates)'),
                            (73,'TCZ On This Day',Z,'tcz','TCZ-ARCHIVE-INDEX + birthday codes')]:
    channels.append(dict(num=n,name=name,lane=lane,type='highlight',key=key,source=src))
channels.sort(key=lambda c:c['num'])
songs={}  # date (YYYY-MM-DD) -> {"title":..,"artist":..}; empty until Chad logs songs
clock=[
 dict(start='00:00',end='04:35',title='Overnight · AIR Full Loop',ch=30,lane=B),
 dict(start='04:35',end='05:05',title='Alarm Study · the 4:45 TCZ rail',ch=3,lane=Z,kind='study'),
 dict(start='05:05',end='07:00',title='Early Board · Chess Library',ch=10,lane=Z),
 dict(start='07:00',end='08:30',title='Morning Commute · DJ Brose Forecast',ch=31,lane=B,kind='forecast'),
 dict(start='08:30',end='11:14',title='Daytime · Future Thinking',ch=25,lane=B),
 dict(start='11:14',end='13:14',title='Chess Master vs Chess Villain',ch=4,lane=Z,kind='lunch'),
 dict(start='13:14',end='15:00',title='Afternoon · Universal Mind',ch=26,lane=B),
 dict(start='15:00',end='15:30',title='Song of the Day',ch=31,lane=B,kind='song'),
 dict(start='15:30',end='19:00',title='Late Afternoon · On the Lo-Lo',ch=14,lane=B),
 dict(start='19:00',end='24:00',title='ICYMI · today on CFD',ch=73,lane=Z,kind='icymi'),
]
out=dict(name='CFD TV',version='2026-10-06',timezone='America/Chicago',clock_anchor_utc='2026-01-01T06:00:00Z',
 lanes={Z:dict(label='Coach Chad / The Chess Zone',accounts=['@thechesszone','@coachchad']),B:dict(label='Brose / Coffee for Dessert',accounts=['@brosetheghost (user/11cambrose)','Spotify 11brose','cfd.galleries'])},
 verified=dict(youtube='Playlist and channel IDs read from public YouTube channel pages and confirmed by public RSS feeds on 2026-10-06; every video passed YouTube oEmbed (embeddable) on 2026-10-06.',
               spotify='All playlist IDs returned 200 from Spotify oEmbed on 2026-10-06; owner 11brose confirmed in the 2026-09-24 inventory.'),
 clock=clock,channels=channels,reserve_youtube=reserve,rail=rail,songs=songs,highlights_file='data/highlights.json')
json.dump(out,open(f'{SITE}/channels.json','w'),ensure_ascii=False,separators=(',',':'))
json.dump(dict(stories=H['stories'],almanac=H['almanac'],evergreen=H['evergreen'],tcz=tcz),open(f'{SITE}/data/highlights.json','w'),ensure_ascii=False,separators=(',',':'))
for c in channels:
    n=len(c.get('videos',c.get('playlists',c.get('dice',[]))))
    print(c['num'],c['name'],c['type'],c['lane'],n, round(sum(v[1] for v in c.get('videos',[]))/3600,1) if c['type']=='youtube' else '')
print('reserve',[(r['title'],r['embeddable_videos']) for r in reserve])
print({k:sum(len(v) for v in H[k].values()) for k in H}, len(tcz), len(rail))
