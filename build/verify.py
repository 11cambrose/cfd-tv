import subprocess,re,json,sys
sys.path.insert(0,'/tmp')
from ytparse import init,playlists
srcs={'thechesszone':('yt__thechesszone.html','UCUJNrSwx1a7mm3En5oaYc_w'),'coachchad':('yt__coachchad.html','UCrt_o8hPXmUHPB6JvQRqb6w'),'11cambrose':('yt_user_11cambrose.html','UCHp4nhbMynPwl_cP1Lc9PNA')}
res=[]
def feed(q):
    x=subprocess.run(['curl','-sL','-A','Mozilla/5.0','https://www.youtube.com/feeds/videos.xml?'+q],capture_output=True,text=True).stdout
    t=re.search(r'<title>(.*?)</title>',x)
    vids=re.findall(r'<yt:videoId>(.*?)</yt:videoId>',x)
    titles=re.findall(r'<media:title>(.*?)</media:title>',x)
    return (t.group(1) if t else None),vids,titles
for acct,(f,uc) in srcs.items():
    d,_=init(f); p,_=playlists(d)
    t,v,ti=feed('channel_id='+uc)
    res.append(dict(account=acct,kind='uploads',id='UU'+uc[2:],channel_id=uc,title=t,feed_title=t,videos=v,video_titles=ti))
    for pid,title,cnt in p:
        t,v,ti=feed('playlist_id='+pid)
        res.append(dict(account=acct,kind='playlist',id=pid,channel_id=uc,title=title,count=cnt,feed_title=t,videos=v,video_titles=ti))
for r in res: print(r['account'],r['kind'],r['id'],repr(r['title']),r.get('count'),'feed:',repr(r['feed_title']),len(r['videos']))
json.dump(res,open('/workspace/cfd-tv/verify/yt-verified-2026-10-06.json','w'),indent=1)
