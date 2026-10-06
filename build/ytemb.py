import json,subprocess
from concurrent.futures import ThreadPoolExecutor
ver=json.load(open('/workspace/cfd-tv/verify/yt-verified-2026-10-06.json'))
ids=sorted({v['id'] for r in ver for v in r['playlist_videos']})
def chk(i):
    c=subprocess.run(['curl','-s','-o','/dev/null','-m','20','-w','%{http_code}',f'https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v={i}'],capture_output=True,text=True).stdout
    return i,c
with ThreadPoolExecutor(16) as ex: res=dict(ex.map(chk,ids))
from collections import Counter; print(len(ids),Counter(res.values()))
json.dump(res,open('/tmp/yt_oembed.json','w'))
