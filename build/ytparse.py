import re,json,sys
def init(path):
    s=open(path,encoding='utf-8').read()
    m=re.search(r'var ytInitialData = (\{.*?\});</script>',s) or re.search(r'ytInitialData"\]\s*=\s*(\{.*?\});',s)
    return json.loads(m.group(1)), s
def walk(o,f):
    if isinstance(o,dict):
        f(o)
        for v in o.values(): walk(v,f)
    elif isinstance(o,list):
        for v in o: walk(v,f)
def playlists(d):
    out=[];cont=[]
    def f(o):
        if 'lockupViewModel' in o:
            l=o['lockupViewModel']
            if l.get('contentType','').endswith('PLAYLIST') or l.get('contentId','').startswith(('PL','OL','UU','FL')):
                title=l.get('metadata',{}).get('lockupMetadataViewModel',{}).get('title',{}).get('content')
                cnt=None
                txt=json.dumps(l)
                m=re.search(r'"text": "(\d[\d,]*) (?:videos|video|episodes|lessons)"',txt)
                if m: cnt=m.group(1)
                out.append((l.get('contentId'),title,cnt))
        if 'gridPlaylistRenderer' in o:
            g=o['gridPlaylistRenderer']; out.append((g['playlistId'],''.join(r.get('text','') for r in g['title'].get('runs',[])) or g['title'].get('simpleText'),g.get('videoCountText',{}).get('runs',[{}])[0].get('text')))
        if 'continuationCommand' in o: cont.append(o['continuationCommand']['token'])
    walk(d,f); return out,cont
if __name__=='__main__':
    d,s=init(sys.argv[1]); p,c=playlists(d)
    for x in p: print(x)
    print('cont',len(c))
