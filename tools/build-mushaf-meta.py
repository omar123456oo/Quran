#!/usr/bin/env python3
"""Generate mushaf-meta.js from the published sources, verifying all 604 pages.

Sources:
  - layout/glyphs: Quran.com API v4 (KFGQPC Madinah Mushaf, 1405 AH, QCF V1 glyph codes)
  - fonts:         static.qurancdn.com KFGQPC V1 per-page fonts (sizes only)
  - Surah list, page and Juz starts: alquran.cloud /v1/surah and /v1/meta

Every page must pass the same checks the app runs before storing a download
(see mushaf-store.js `validatePage`). Nothing is written if any page fails.

Usage: python3 tools/build-mushaf-meta.py   (writes ./mushaf-meta.js)
"""
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

UA = {'User-Agent': 'Mozilla/5.0', 'Accept-Encoding': 'identity'}
PAGE_API = ('https://api.quran.com/api/v4/verses/by_page/{p}?words=true&per_page=50'
            '&word_fields=code_v1,line_number,text_uthmani&fields=chapter_id')
FONT_URL = 'https://static.qurancdn.com/fonts/quran/hafs/v1/woff2/p{p}.woff2'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'mushaf-meta.js')


def get(url, head=False):
    req = urllib.request.Request(url, headers=UA, method='HEAD' if head else 'GET')
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return int(r.headers['Content-Length']) if head else r.read()
        except Exception:
            if attempt == 3:
                raise


def max_line(p):
    return 8 if p in (1, 2) else 15


def compact(p, data):
    """Same shape as MushafPage.compact() in mushaf-store.js."""
    lines = {}
    for v in data['verses']:
        for w in v['words']:
            lines.setdefault(w['line_number'], []).append(
                [w['code_v1'], w['text_uthmani'], v['verse_key'], 1 if w['char_type_name'] == 'end' else 0, w['position']])
    return {'v': 1, 'p': p, 'l': [[n, lines[n]] for n in sorted(lines)]}


surahs = json.loads(get('https://api.alquran.cloud/v1/surah'))['data']
meta = json.loads(get('https://api.alquran.cloud/v1/meta'))['data']
assert len(surahs) == 114
page_start = [f"{r['surah']}:{r['ayah']}" for r in meta['pages']['references']]
juz_start_ref = [f"{r['surah']}:{r['ayah']}" for r in meta['juzs']['references']]
assert len(page_start) == 604 and len(juz_start_ref) == 30
ayah_counts = [s['numberOfAyahs'] for s in surahs]


def next_key(key):
    s, a = map(int, key.split(':'))
    return f'{s}:{a + 1}' if a < ayah_counts[s - 1] else (f'{s + 1}:1' if s < 114 else None)


def fetch(p):
    return p, json.loads(get(PAGE_API.format(p=p))), get(FONT_URL.format(p=p), head=True)


with ThreadPoolExecutor(6) as ex:
    fetched = list(ex.map(fetch, range(1, 605)))

problems = []
pages = {}
for p, data, font_bytes in fetched:
    vs = data['verses']
    if data['pagination']['total_pages'] != 1 or not vs:
        problems.append(f'page {p}: unexpected pagination/empty')
        continue
    keys = [v['verse_key'] for v in vs]
    if keys[0] != page_start[p - 1]:
        problems.append(f'page {p}: first verse {keys[0]} != alquran.cloud {page_start[p - 1]}')
    for a, b in zip(keys, keys[1:]):
        if next_key(a) != b:
            problems.append(f'page {p}: verse gap {a} -> {b}')
    expected_next = page_start[p] if p < 604 else None
    if next_key(keys[-1]) != expected_next:
        problems.append(f'page {p}: last verse {keys[-1]} does not precede next page start {expected_next}')
    for v in vs:
        pos = [w['position'] for w in v['words']]
        if pos != list(range(1, len(pos) + 1)) or v['words'][-1]['char_type_name'] != 'end':
            problems.append(f"page {p}: verse {v['verse_key']} words not contiguous or missing end marker")
        if any(not w['code_v1'] or not (1 <= w['line_number'] <= max_line(p)) for w in v['words']):
            problems.append(f"page {p}: verse {v['verse_key']} bad glyph code or line number")
    pages[p] = {'data': data, 'font': font_bytes, 'compact': compact(p, data)}

# Header/basmala placement: a Surah start on line L needs header (and basmala unless
# Surah 1 or 9) on the lines above it; if the header does not fit, it is printed on the
# last line of the previous page.
header_at_page_end = {}
for p in range(1, 605):
    if p not in pages:
        continue
    used = {n for n, _ in pages[p]['compact']['l']}
    explained = set()
    for v in pages[p]['data']['verses']:
        if v['verse_number'] != 1:
            continue
        ch = v['chapter_id']
        first = min(w['line_number'] for w in v['words'])
        slots = [first - 1, first - 2] if ch not in (1, 9) else [first - 1]
        for s in slots:
            if s >= 1:
                explained.add(s)
            elif s == 0:
                header_at_page_end[p - 1] = ch
    pages[p]['explained'] = explained
    pages[p]['used'] = used
for p in pages:
    if header_at_page_end.get(p):
        pages[p]['explained'].add(15)
    empty = [n for n in range(1, max_line(p) + 1) if n not in pages[p]['used']]
    bad = [n for n in empty if n not in pages[p]['explained']]
    clash = [n for n in pages[p]['explained'] if n in pages[p]['used']]
    if bad:
        problems.append(f'page {p}: unexplained empty lines {bad}')
    if clash:
        problems.append(f'page {p}: header/basmala slot {clash} is occupied by text')

if problems:
    print(f'{len(problems)} problems; mushaf-meta.js NOT written', file=sys.stderr)
    for x in problems:
        print('  ' + x, file=sys.stderr)
    sys.exit(1)

surah_start_page = [None] * 114
juz_start_page = [None] * 30
for p in range(1, 605):
    for v in pages[p]['data']['verses']:
        if v['verse_number'] == 1 and surah_start_page[v['chapter_id'] - 1] is None:
            surah_start_page[v['chapter_id'] - 1] = p
        j = v['juz_number']
        if juz_start_page[j - 1] is None:
            juz_start_page[j - 1] = p
assert None not in surah_start_page and None not in juz_start_page

basmala = [w['code_v1'] for w in pages[1]['data']['verses'][0]['words'] if w['char_type_name'] == 'word']
out = {
    'edition': {
        'name': 'مصحف المدينة المنورة — مجمع الملك فهد لطباعة المصحف الشريف (رواية حفص عن عاصم)',
        'nameEn': 'King Fahd Glorious Qur\'an Printing Complex, Madinah Mushaf, Hafs, 1405 AH layout (KFGQPC V1)',
        'pages': 604, 'linesPerPage': 15,
        'layoutSource': 'Quran.com API v4 (verses/by_page, code_v1)',
        'fontSource': 'KFGQPC V1 page fonts via static.qurancdn.com',
    },
    'surahs': [[s['name'], s['englishName'], s['numberOfAyahs'], s['revelationType']] for s in surahs],
    'pageStart': page_start,
    'juzStart': juz_start_ref,
    'surahStartPage': surah_start_page,
    'juzStartPage': juz_start_page,
    'headerAtPageEnd': {str(k): v for k, v in sorted(header_at_page_end.items())},
    'basmalaCodes': basmala,
    'pageBytes': [pages[p]['font'] + len(json.dumps(pages[p]['compact'], ensure_ascii=False).encode()) for p in range(1, 605)],
}
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('/* Generated by tools/build-mushaf-meta.py — do not edit by hand. */\n')
    f.write('(function (root) { root.MushafMeta = ')
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    f.write('; if (typeof module === "object" && module.exports) module.exports = root.MushafMeta; })'
            '(typeof window !== "undefined" ? window : globalThis);\n')
total = sum(out['pageBytes'])
print(f'OK: 604 pages verified; header-at-page-end {len(header_at_page_end)}; '
      f'full Mushaf storage ≈ {total / 1e6:.1f} MB; wrote {OUT}')
