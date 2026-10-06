#!/usr/bin/env python3
"""CFD TV broken-ID detector.

Offline mode (default): every YouTube video ID and Spotify playlist ID in channels.json
must appear in the newest verify/ snapshots with a passing status.
Live mode (--live): re-hit public YouTube oEmbed and Spotify oEmbed for every ID.
Exit 1 on any missing/broken ID. Writes a JSON report with --out.
"""
import argparse, glob, json, os, sys, urllib.request, urllib.error, concurrent.futures as cf

def ids(channels):
    yt, sp = {}, {}
    for c in channels["channels"]:
        for v in c.get("videos", []):
            yt.setdefault(v[0], []).append(c["num"])
        for p in c.get("playlists", []):
            sp.setdefault(p[0], []).append(c["num"])
        for r in c.get("dice", []):
            sp.setdefault(r["id"], []).append(c["num"])
    return yt, sp

def newest(pattern):
    f = sorted(glob.glob(pattern))
    return f[-1] if f else None

def probe(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 cfd-tv-qa"})
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.status
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt == 0:
                continue
            return e.code
        except Exception:
            if attempt == 0:
                continue
            return 0
    return 0

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--live", action="store_true")
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--out")
    a = ap.parse_args()
    ch = json.load(open(os.path.join(a.root, "channels.json")))
    yt, sp = ids(ch)
    report = {"youtube_ids": len(yt), "spotify_ids": len(sp), "mode": "live" if a.live else "offline", "broken": []}
    if not a.live:
        yo = newest(os.path.join(a.root, "verify", "yt-oembed-*.json"))
        so = newest(os.path.join(a.root, "verify", "spotify-oembed-*.json"))
        report["snapshots"] = [yo, so]
        yov = json.load(open(yo)) if yo else {}
        sov = json.load(open(so)) if so else {}
        for k, chs in yt.items():
            if str(yov.get(k)) != "200":
                report["broken"].append({"kind": "youtube", "id": k, "channels": chs, "status": yov.get(k, "missing")})
        for k, chs in sp.items():
            if k not in sov:
                report["broken"].append({"kind": "spotify", "id": k, "channels": chs, "status": "missing"})
    else:
        jobs = [("youtube", k, f"https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v={k}") for k in yt]
        jobs += [("spotify", k, f"https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/{k}") for k in sp]
        with cf.ThreadPoolExecutor(a.workers) as ex:
            for (kind, k, _), st in zip(jobs, ex.map(lambda j: probe(j[2]), jobs)):
                if st != 200:
                    report["broken"].append({"kind": kind, "id": k, "channels": (yt if kind == "youtube" else sp)[k], "status": st})
    report["ok"] = not report["broken"]
    txt = json.dumps(report, indent=1)
    if a.out:
        open(a.out, "w").write(txt)
    print(f"{report['mode']}: {report['youtube_ids']} YouTube + {report['spotify_ids']} Spotify IDs, broken={len(report['broken'])}")
    for b in report["broken"][:50]:
        print("  BROKEN", b)
    sys.exit(0 if report["ok"] else 1)

if __name__ == "__main__":
    main()
