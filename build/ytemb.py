import json,subprocess
from concurrent.futures import ThreadPoolExecutor
from paths import verify
ver=json.load(open(verify('yt-verified')))
ids=sorted({v['id'] for r in ver for v in r['playlist_videos']})
def chk(i):
    c=subprocess.run(['curl','-s','-o','/dev/null','-m','20','-w','%{http_code}',f'https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v={i}'],capture_output=True,text=True).stdout
    return i,c
with ThreadPoolExecutor(16) as ex: res=dict(ex.map(chk,ids))
from collections import Counter; print(len(ids),Counter(res.values()))
json.dump(res,open(verify('yt-oembed'),'w'))
