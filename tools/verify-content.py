#!/usr/bin/env python3
"""Verify content/stories.json and content/miracles.json against the Quran dataset.

For every reference {s, from, to, expect}:
  - Surah 1–114 and the ayah range lie inside the Surah (verified ayah counts);
  - the referenced ayahs are fetched (alquran.cloud, edition quran-simple-clean) and every
    'expect' phrase must occur in them (after normalising letters/diacritics), so a wrong
    reference cannot pass silently.
Also checks ids, required fields and links, then writes 'minutes' (reading time computed
from the actual explanation text plus the referenced verses). Nothing is written on failure.

Usage: python3 tools/verify-content.py
"""
import json
import math
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = [os.path.join(ROOT, 'content', f) for f in ('stories.json', 'miracles.json')]
WORDS_PER_MINUTE = 130          # unhurried Arabic reading, incl. Quranic text
UA = {'User-Agent': 'Mozilla/5.0'}
_surahs = {}


def get(url):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.loads(r.read())
        except Exception:
            if attempt == 3:
                raise


def surah(n):
    if n not in _surahs:
        d = get(f'https://api.alquran.cloud/v1/surah/{n}/quran-simple-clean')['data']
        _surahs[n] = [a['text'] for a in d['ayahs']]
    return _surahs[n]


DIACRITICS = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')


def norm(t):
    t = DIACRITICS.sub('', t)
    t = re.sub('[أإآٱ]', 'ا', t).replace('ى', 'ي').replace('ة', 'ه').replace('ؤ', 'و').replace('ئ', 'ي')
    return re.sub(r'\s+', ' ', t).strip()


def words(t):
    return len(re.findall(r'[؀-ۿ]+', t or ''))


counts = [s['numberOfAyahs'] for s in get('https://api.alquran.cloud/v1/surah')['data']]
problems = []
docs = {}
for path in FILES:
    with open(path, encoding='utf-8') as f:
        docs[path] = json.load(f)

story_ids = {i['id'] for i in docs[FILES[0]]['items']}
all_ids = {}
for path, doc in docs.items():
    name = os.path.basename(path)
    for item in doc['items']:
        iid = item.get('id')
        where = f'{name}:{iid}'
        if not iid or iid in all_ids:
            problems.append(f'{where}: missing or duplicate id')
        all_ids[iid] = name
        for field in ('prophet', 'title', 'icon', 'intro', 'sections', 'lessons'):
            if not item.get(field):
                problems.append(f'{where}: missing {field}')
        n_words = words(item.get('intro')) + sum(words(x) for x in item.get('lessons', []))
        n_refs = 0
        for sec in item.get('sections', []):
            n_words += words(sec.get('title')) + words(sec.get('text'))
            if sec.get('hadith'):
                h = sec['hadith']
                if not (h.get('text') and h.get('source') and h.get('grade')):
                    problems.append(f'{where}: hadith without text/source/grade')
                n_words += words(h.get('text'))
            if not sec.get('refs'):
                problems.append(f"{where}: section '{sec.get('title')}' has no Quran reference")
            for ref in sec.get('refs', []):
                n_refs += 1
                s, a, b = ref.get('s'), ref.get('from'), ref.get('to')
                label = f'{where} {s}:{a}-{b}'
                if not (isinstance(s, int) and 1 <= s <= 114):
                    problems.append(f'{label}: bad surah'); continue
                if not (isinstance(a, int) and isinstance(b, int) and 1 <= a <= b <= counts[s - 1]):
                    problems.append(f'{label}: ayah range outside 1–{counts[s - 1]}'); continue
                text = surah(s)[a - 1:b]
                passage = norm(' '.join(text))
                n_words += words(' '.join(text))
                if not ref.get('expect'):
                    problems.append(f'{label}: no expected phrase')
                for phrase in ref.get('expect', []):
                    if norm(phrase) not in passage:
                        problems.append(f'{label}: "{phrase}" not found in the referenced verses')
        links = item.get('related', []) + item.get('relatedStories', [])
        for rid in links:
            if rid not in story_ids and rid not in {i['id'] for i in doc['items']}:
                problems.append(f'{where}: unknown related id {rid}')
        item['minutes'] = max(1, math.ceil(n_words / WORDS_PER_MINUTE))
        item['_refs'] = n_refs

if problems:
    print(f'{len(problems)} problems — content NOT updated', file=sys.stderr)
    for p in problems:
        print('  ' + p, file=sys.stderr)
    sys.exit(1)

total_refs = 0
for path, doc in docs.items():
    for item in doc['items']:
        total_refs += item.pop('_refs')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write('\n')
    # Script copy loaded by the app: works from a web server and when index.html is opened
    # directly as a file (file://), where fetch() of JSON is blocked.
    kind = doc['kind']
    with open(path[:-5] + '.js', 'w', encoding='utf-8') as f:
        f.write('/* Generated from ' + os.path.basename(path) + ' by tools/verify-content.py — edit the JSON, not this file. */\n')
        f.write('window.QuranContentData = window.QuranContentData || {};\n')
        f.write(f'window.QuranContentData[{json.dumps(kind)}] = ')
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
print(f'OK: {sum(len(d["items"]) for d in docs.values())} items, {total_refs} Quran references verified; reading times written')
