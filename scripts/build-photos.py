#!/usr/bin/env python3
"""Add build photos from Jeff's Apple Photos library to the Explore set > Build photos gallery.

Runs only on Jeff's Mac (needs osxphotos, Pillow and Photos.app). Two steps, with Jeff's approval between them:

  python3 scripts/build-photos.py candidates            # photos taken since the gallery's addedThrough marker
  python3 scripts/build-photos.py add PICKS.json        # publish the approved picks, move the marker

`candidates` exports full-resolution originals (downloading from iCloud if needed) to a staging folder outside
the repo, writes candidates.json and a numbered contact sheet there, and prints the list. `add` reads a picks
file (see .claude/skills/build-photos/SKILL.md), writes resized, metadata-free WebP files to public/photos/build/,
appends the photos (and any new stages) to public/data/build-photos.json, and moves addedThrough to the newest
candidate reviewed, so rejected photos are not offered again next time.
"""
import argparse, base64, glob, hashlib, io, json, os, re, subprocess, sys, tempfile
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'public/data/build-photos.json'
OUT = ROOT / 'public/photos/build'
WIDTHS = [480, 960, 1600, 2400]
SKIP_LABELS = {'Receipt', 'Document'}


def load_manifest():
    return json.loads(MANIFEST.read_text())


def candidates(args):
    import osxphotos
    from PIL import Image, ImageDraw, ImageFont, ImageOps
    data = load_manifest()
    since = datetime.fromisoformat(args.since or data['addedThrough'])
    until = datetime.fromisoformat(args.until) if args.until else datetime.now()
    stage = Path(args.out or tempfile.mkdtemp(prefix='rc-build-photos-'))
    (stage / 'full').mkdir(parents=True, exist_ok=True)
    db = osxphotos.PhotosDB()
    rows = []
    for p in db.photos(from_date=since - timedelta(days=1), to_date=until + timedelta(days=1), movies=False):
        taken = p.date.strftime('%Y-%m-%dT%H:%M')
        if not (since.strftime('%Y-%m-%dT%H:%M') < taken <= until.strftime('%Y-%m-%dT%H:%M')):
            continue
        if p.screenshot or p.hidden or p.intrash or SKIP_LABELS & set(p.labels):
            continue
        rows.append({'uuid': p.uuid, 'taken': taken, 'labels': p.labels[:6], 'place': p.place.name if p.place else None})
    rows.sort(key=lambda r: r['taken'])
    if not rows:
        print(f'No new camera photos between {since:%Y-%m-%d %H:%M} and {until:%Y-%m-%d %H:%M}.')
        return
    uuids = stage / 'uuids.txt'
    uuids.write_text('\n'.join(r['uuid'] for r in rows) + '\n')
    subprocess.run(['osxphotos', 'export', str(stage / 'full'), '--uuid-from-file', str(uuids), '--download-missing',
                    '--skip-original-if-edited', '--skip-live', '--convert-to-jpeg', '--filename', '{uuid}',
                    '--overwrite'], check=True, stdout=subprocess.DEVNULL)
    T, cols = 320, 6
    font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 22)
    sheet = Image.new('RGB', (cols * T, -(-len(rows) // cols) * T), 'white')
    draw = ImageDraw.Draw(sheet)
    for i, r in enumerate(rows, 1):
        files = sorted(glob.glob(str(stage / 'full' / (r['uuid'] + '*'))), key=lambda f: '_edited' not in f)
        r['n'], r['file'] = i, files[0] if files else None
        x, y = (i - 1) % cols * T, (i - 1) // cols * T
        if r['file']:
            im = ImageOps.exif_transpose(Image.open(r['file']))
            im.thumbnail((T - 8, T - 34))
            sheet.paste(im, (x + 4, y + 30))
        draw.text((x + 6, y + 4), f"#{i} {r['taken'][5:].replace('T', ' ')}", fill='black', font=font)
    sheet.save(stage / 'contact-sheet.jpg', quality=82)
    (stage / 'candidates.json').write_text(json.dumps({'since': since.isoformat(timespec='minutes'), 'photos': rows}, indent=1))
    for r in rows:
        print(f"#{r['n']:>2}  {r['taken']}  {r['uuid'][:8]}  {', '.join(r['labels'])}")
    print(f'\nStaging folder: {stage}\nContact sheet:  {stage / "contact-sheet.jpg"}')


def slugify(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def add(args):
    from PIL import Image, ImageCms, ImageOps
    picks = json.loads(Path(args.picks).read_text())
    stage = Path(picks['staging'])
    cands = json.loads((stage / 'candidates.json').read_text())['photos']
    by_n = {c['n']: c for c in cands}
    data = load_manifest()
    for s in picks.get('stages', []):
        if not any(x['id'] == s['id'] for x in data['stages']):
            data['stages'].append(s)
    stage_ids = {s['id'] for s in data['stages']}
    srgb = ImageCms.createProfile('sRGB')
    OUT.mkdir(parents=True, exist_ok=True)
    for pick in picks['photos']:
        c = by_n[pick['n']]
        assert pick['stage'] in stage_ids, f"unknown stage {pick['stage']}"
        im = Image.open(c['file'])
        icc = im.info.get('icc_profile')
        im = ImageOps.exif_transpose(im).convert('RGB')
        if icc:  # bake the camera's Display P3 into sRGB; the published file carries no profile
            im = ImageCms.profileToProfile(im, ImageCms.ImageCmsProfile(io.BytesIO(icc)), srgb, outputMode='RGB')
        slug = c['taken'][:10] + '-' + slugify(pick['title'])
        assert not any(p['id'] == slug for p in data['photos']), f'{slug} is already in the gallery'
        src = {}
        for w in WIDTHS:
            if w > im.width:
                continue
            buf = io.BytesIO()
            im.resize((w, round(im.height * w / im.width)), Image.LANCZOS).save(buf, 'WEBP', quality=74 if w >= 1600 else 78, method=6)
            body = buf.getvalue()  # Pillow writes no EXIF, XMP or ICC chunk unless asked: GPS never leaves the Mac
            name = f'{slug}-{w}.{hashlib.sha256(body).hexdigest()[:8]}.webp'
            (OUT / name).write_bytes(body)
            src[str(w)] = name
        tiny = im.copy()
        tiny.thumbnail((24, 24))
        buf = io.BytesIO()
        tiny.save(buf, 'WEBP', quality=40)
        data['photos'].append({'id': slug, 'stage': pick['stage'], 'title': pick['title'], 'caption': pick['caption'],
                               'taken': c['taken'], 'width': im.width, 'height': im.height, 'src': src,
                               'placeholder': 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()})
        print('added', slug)
    data['photos'].sort(key=lambda p: p['taken'])
    data['addedThrough'] = max([data['addedThrough']] + [c['taken'] for c in cands])
    MANIFEST.write_text(json.dumps(data, indent=1, ensure_ascii=False) + '\n')
    print('addedThrough', data['addedThrough'])


ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
sub = ap.add_subparsers(dest='cmd', required=True)
c = sub.add_parser('candidates', help='list and export photos taken since the last gallery update')
c.add_argument('--since', help='override the addedThrough marker (YYYY-MM-DDTHH:MM, local time)')
c.add_argument('--until', help='latest time to include (default: now)')
c.add_argument('--out', help='staging folder (default: a new temp folder)')
a = sub.add_parser('add', help='publish approved picks into the gallery')
a.add_argument('picks', help='picks JSON file')
args = ap.parse_args()
{'candidates': candidates, 'add': add}[args.cmd](args)
