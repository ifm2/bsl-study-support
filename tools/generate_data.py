"""Validate the CSV masters and generate data.js / data.json. No network calls."""
import csv
import json
from pathlib import Path
from urllib.parse import urlparse
import re

ROOT = Path(__file__).resolve().parents[1]
FIELDS = {
    'signs': {'sign_id', 'word', 'meaning'},
    'videos': {'video_id', 'sign_id', 'source', 'url', 'verification_status', 'priority'},
    'lesson_vocabulary': {'entry_id', 'sign_id', 'selected_video_id', 'level', 'lesson',
                          'category', 'global_order', 'source_page', 'word', 'source_text', 'notes',
                          'topic', 'nmf', 'source_pages'},
    'video_sequences': {'sign_id', 'position', 'url'},
}
TOPICS = {'Work Life', 'The Home', 'Education', 'People and Personalities',
          'Hobbies and Activities', 'Health and Fitness', 'Home Life',
          'Travel and Holidays', 'Food and Drink'}

def require(condition, message):
    if not condition:
        raise ValueError(message)

def unique(rows, field):
    values = [r[field] for r in rows]
    require(all(values) and len(values) == len(set(values)), f'{field} must be nonempty and unique')

def valid_video_url(value):
    url = urlparse(value)
    if url.scheme != 'https' or not url.netloc:
        return False
    host = (url.hostname or '').lower()
    if host in {'signbsl.com', 'www.signbsl.com'}:
        return bool(re.fullmatch(r'/sign/[^/]+', url.path) and re.fullmatch(r'[A-Za-z0-9_-]{1,64}', url.fragment))
    return url.path.lower().endswith('.mp4')

def valid_direct_mp4_url(value):
    url = urlparse(value)
    return url.scheme == 'https' and bool(url.netloc) and url.path.lower().endswith('.mp4')

def validate(data):
    signs, videos, entries, sequences = (data[k] for k in FIELDS)
    require(bool(signs) and bool(entries), 'Signs and lesson vocabulary must not be empty')
    for rows, key in ((signs, 'sign_id'), (videos, 'video_id'), (entries, 'entry_id'), (entries, 'global_order')):
        unique(rows, key)
    require(len({(s['word'], s['meaning']) for s in signs}) == len(signs), 'Duplicate sign/meaning')
    smap = {s['sign_id']: s for s in signs}
    vmap = {v['video_id']: v for v in videos}
    pairs, priorities = set(), set()
    for v in videos:
        require(v['sign_id'] in smap, 'Unknown video sign_id: ' + v['sign_id'])
        require(valid_video_url(v['url']), 'Video URL must be a direct MP4 or a SignBSL sign URL with a video ID after #')
        require(v['priority'].isdigit() and int(v['priority']) > 0, 'Priority must be a positive integer')
        require(v['verification_status'] in {'Unverified', 'Verified', 'Unavailable', 'Rejected'}, 'Unknown verification status')
        require(bool(v['source'].strip()), 'Video source must not be empty')
        pair = (v['sign_id'], v['url'])
        priority = (v['sign_id'], int(v['priority']))
        require(pair not in pairs, 'Duplicate sign/video URL')
        require(priority not in priorities, 'Duplicate priority within sign')
        pairs.add(pair)
        priorities.add(priority)
    sequence_positions = set()
    for clip in sequences:
        require(clip['sign_id'] in smap, 'Unknown video sequence sign_id: ' + clip['sign_id'])
        require(clip['position'].isdigit() and 1 <= int(clip['position']) <= 3,
                'Video sequence positions must be 1, 2, or 3')
        require(valid_direct_mp4_url(clip['url']), 'Video sequence clips must be direct HTTPS MP4 URLs')
        key = (clip['sign_id'], int(clip['position']))
        require(key not in sequence_positions, 'Duplicate video sequence position')
        sequence_positions.add(key)
    for sign_id in {clip['sign_id'] for clip in sequences}:
        require({p for sid, p in sequence_positions if sid == sign_id} == {1, 2, 3},
                'Each video sequence must contain clips at positions 1, 2, and 3')
    for r in entries:
        require(r['sign_id'] in smap, 'Unknown lesson sign_id: ' + r['sign_id'])
        require(r['level'] in {'1', '2'}, 'Level must be 1 or 2')
        if r['level'] == '1':
            require(r['lesson'].isdigit() and 1 <= int(r['lesson']) <= 14, 'Lesson outside level range')
            require(not r['topic'], 'Level 1 uses lessons')
        else:
            require(not r['lesson'] and r['topic'] in TOPICS, 'Level 2 requires a topic, not a lesson')
            require('/' not in r['word'], 'Split all Level 2 slash labels')
        require(r['nmf'] in {'TRUE', 'FALSE'}, 'nmf must be TRUE or FALSE')
        require(r['global_order'].isdigit() and int(r['global_order']) > 0, 'Invalid global_order')
        require(r['entry_id'].isdigit() and int(r['entry_id']) > 0, 'Invalid entry_id')
        require(r['source_page'].isdigit() and int(r['source_page']) > 0, 'Invalid workbook page')
        pages = [p.strip() for p in r['source_pages'].split(';')]
        require(all(p.isdigit() and int(p) > 0 for p in pages) and r['source_page'] in pages, 'Invalid source_pages')
        require(bool(r['category']) and bool(r['word']) and bool(r['source_text']), 'Missing occurrence text')
        require(r['word'] == smap[r['sign_id']]['word'], 'Occurrence word does not match sign')
        if r['selected_video_id']:
            require(r['selected_video_id'] in vmap, 'Unknown selected_video_id')
            require(vmap[r['selected_video_id']]['sign_id'] == r['sign_id'], 'Selected video belongs to another sign')

def load():
    data = {}
    for name, fields in FIELDS.items():
        with (ROOT / f'data/{name}.csv').open(encoding='utf-8-sig', newline='') as f:
            reader = csv.DictReader(f)
            require(set(reader.fieldnames or []) == fields, f'Unexpected columns in {name}.csv')
            rows = list(reader)
            require(all(None not in r and all(v is not None for v in r.values()) for r in rows), f'Malformed row in {name}.csv')
            data[name] = rows
    validate(data)
    data['lesson_vocabulary'].sort(key=lambda r: int(r['global_order']))
    data['signs'].sort(key=lambda r: r['sign_id'])
    data['videos'].sort(key=lambda r: (r['sign_id'], int(r['priority'])))
    data['video_sequences'].sort(key=lambda r: (r['sign_id'], int(r['position'])))
    return data

if __name__ == '__main__':
    data = load()
    output = json.dumps(data, ensure_ascii=False, indent=2)
    (ROOT / 'data/data.json').write_text(output + '\n', encoding='utf-8')
    (ROOT / 'data/data.js').write_text('window.BSL_DATA = ' + output + ';\n', encoding='utf-8')
    print('Validated and generated: ' + ', '.join(f'{len(v)} {k}' for k, v in data.items()))
