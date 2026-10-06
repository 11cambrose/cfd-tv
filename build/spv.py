import json,subprocess,re
from concurrent.futures import ThreadPoolExecutor
from paths import source, verify
inv=json.load(open(source('SPOTIFY-11BROSE-INVENTORY.json')))
dice=json.load(open(source('DJ-BROSE-DICE-2026-09-24.json')))['rows']
ids={x['playlist_id'] for x in inv}
for r in dice: ids.add(r['spotify_url'].rstrip('/').split('/')[-1].split('?')[0])
def chk(i):
    o=subprocess.run(['curl','-s','-m','20','-w','\n%{http_code}',f'https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/{i}'],capture_output=True,text=True).stdout
    body,code=o.rsplit('\n',1)
    t=None
    try: t=json.loads(body).get('title')
    except: pass
    return i,code,t
with ThreadPoolExecutor(8) as ex: res=list(ex.map(chk,sorted(ids)))
ok={i:t for i,c,t in res if c=='200'}
print(len(ids),'ok',len(ok)); print([r for r in res if r[1]!='200'])
json.dump(ok,open(verify('spotify-oembed'),'w'),ensure_ascii=False,indent=0)
print(len(dice), dice[-1]['landing'])
