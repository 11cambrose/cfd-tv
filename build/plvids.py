import json,subprocess,re,sys
sys.path.insert(0,'/tmp'); from ytparse import walk
ver=json.load(open('/workspace/cfd-tv/verify/yt-verified-2026-10-06.json'))
def sec(t):
    p=[int(x) for x in t.split(':')]; s=0
    for x in p: s=s*60+x
    return s
for r in ver:
    pid=r['id']
    s=subprocess.run(['curl','-sL','-A','Mozilla/5.0 (X11; Linux x86_64) Chrome/120','-H','Accept-Language: en-US','-b','CONSENT=YES+1',f'https://www.youtube.com/playlist?list={pid}'],capture_output=True,text=True).stdout
    m=re.search(r'var ytInitialData = (\{.*?\});</script>',s)
    vids=[];seen=set()
    if m:
        d=json.loads(m.group(1)); ls=[]
        walk(d,lambda o: ls.append(o['lockupViewModel']) if 'lockupViewModel' in o else None)
        for l in ls:
            if l.get('contentType')!='LOCKUP_CONTENT_TYPE_VIDEO' or l['contentId'] in seen: continue
            seen.add(l['contentId'])
            txt=json.dumps(l)
            b=[]
            walk(l,lambda o: b.append(o['thumbnailBadgeViewModel'].get('text','')) if 'thumbnailBadgeViewModel' in o else None)
            b=[x for x in b if re.fullmatch(r'\d{1,2}:\d{2}(?::\d{2})?',x)]
            t=l['metadata']['lockupMetadataViewModel']['title']['content']
            vids.append(dict(id=l['contentId'],title=t,sec=sec(b[0]) if b else 0))
    r['playlist_videos']=vids
    print(pid,len(vids),sum(1 for v in vids if v['sec']),r.get('count'),round(sum(v['sec'] for v in vids)/3600,1),'h')
json.dump(ver,open('/workspace/cfd-tv/verify/yt-verified-2026-10-06.json','w'),indent=1)
