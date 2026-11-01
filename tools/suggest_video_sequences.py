"""Suggest unverified word-by-word sequences for two- and three-word signs."""
import argparse
import csv
import hashlib
import io
import json
import re
from pathlib import Path
from urllib.parse import urlparse

import generate_data

ROOT = Path(__file__).resolve().parents[1]
TOKENS = re.compile(r"[\w]+(?:['’][\w]+)*", re.UNICODE)


def parts(value):
    return TOKENS.findall(value)


def key(value):
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def read_table(name):
    path = ROOT / f'data/{name}.csv'
    raw = path.read_bytes()
    encoding = 'utf-8-sig' if raw.startswith(b'\xef\xbb\xbf') else 'utf-8'
    text = raw.decode(encoding)
    newline = '\r\n' if '\r\n' in text else '\n'
    reader = csv.DictReader(io.StringIO(text, newline=''))
    return list(reader), reader.fieldnames, encoding, newline


def write_table(name, rows, fieldnames, encoding, newline):
    buffer = io.StringIO(newline='')
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, lineterminator=newline)
    writer.writeheader()
    writer.writerows(rows)
    (ROOT / f'data/{name}.csv').write_bytes(buffer.getvalue().encode(encoding))


def direct_mp4(value):
    url = urlparse(value)
    return url.scheme == 'https' and bool(url.netloc) and url.path.lower().endswith('.mp4')


def build_suggestions(data):
    videos, video_fields, video_encoding, video_newline = read_table('videos')
    entries, entry_fields, entry_encoding, entry_newline = read_table('lesson_vocabulary')
    sequences, sequence_fields, sequence_encoding, sequence_newline = read_table('video_sequences')
    by_video_id = {video['video_id']: video for video in videos}
    videos_by_sign = {}
    for video in videos:
        videos_by_sign.setdefault(video['sign_id'], []).append(video)

    component_urls = {}
    for sign in data['signs']:
        words = parts(sign['word'])
        if len(words) != 1:
            continue
        candidates = [video for video in videos_by_sign.get(sign['sign_id'], [])
                      if video['verification_status'] not in {'Unavailable', 'Rejected'}
                      and direct_mp4(video['url'])]
        candidates.sort(key=lambda video: (
            0 if video['verification_status'] == 'Verified' else 1,
            int(video['priority']), video['video_id']))
        component_urls.setdefault(key(words[0]), []).extend(candidates)

    for candidates in component_urls.values():
        candidates.sort(key=lambda video: (
            0 if video['verification_status'] == 'Verified' else 1,
            int(video['priority']), video['video_id']))

    entry_by_sign = {}
    for entry in entries:
        words = parts(entry['word'])
        if len(words) in {2, 3}:
            entry_by_sign.setdefault(entry['sign_id'], []).append(entry)

    existing_signs = {sequence['sign_id'] for sequence in sequences}
    suggestions = []
    exact_count = guessed_count = ambiguous_count = 0
    for sign_id, matching_entries in entry_by_sign.items():
        if sign_id in existing_signs:
            continue
        matching_entries.sort(key=lambda entry: int(entry['global_order']))
        variants = {tuple(key(word) for word in parts(entry['word'])) for entry in matching_entries}
        if len(variants) != 1:
            ambiguous_count += 1
            continue
        words = parts(matching_entries[0]['word'])
        urls = []
        for word in words:
            candidates = component_urls.get(key(word), [])
            if candidates:
                urls.append(candidates[0]['url'])
                exact_count += 1
            else:
                slug = key(word)
                if not slug:
                    urls = []
                    break
                urls.append(f'https://media.signbsl.com/videos/bsl/signstation/{slug}.mp4')
                guessed_count += 1
        if len(urls) == len(words):
            suggestions.append((sign_id, matching_entries, urls))
        else:
            ambiguous_count += 1

    return {
        'videos': videos, 'video_fields': video_fields, 'video_encoding': video_encoding,
        'video_newline': video_newline, 'entries': entries, 'entry_fields': entry_fields,
        'entry_encoding': entry_encoding, 'entry_newline': entry_newline,
        'sequences': sequences, 'sequence_fields': sequence_fields,
        'sequence_encoding': sequence_encoding, 'sequence_newline': sequence_newline,
        'suggestions': suggestions, 'exact_count': exact_count,
        'guessed_count': guessed_count, 'ambiguous_count': ambiguous_count,
    }


def apply_suggestions(batch):
    videos = batch['videos']
    entries = batch['entries']
    by_video_id = {video['video_id']: video for video in videos}
    videos_by_sign = {}
    for video in videos:
        videos_by_sign.setdefault(video['sign_id'], []).append(video)

    for sign_id, matching_entries, urls in batch['suggestions']:
        video_ids = {entry['selected_video_id'] for entry in matching_entries if entry['selected_video_id']}
        selected_video = next(
            (by_video_id[entry['selected_video_id']] for entry in matching_entries
             if entry['selected_video_id'] in by_video_id), None)
        if not selected_video:
            selected_video = next(iter(videos_by_sign.get(sign_id, [])), None)
        if not selected_video:
            video_id = 'video_' + hashlib.sha256((sign_id + json.dumps(urls)).encode()).hexdigest()[:16]
            if video_id in by_video_id:
                raise ValueError(f'Generated video ID already exists: {video_id}')
            priorities = [int(video['priority']) for video in videos_by_sign.get(sign_id, [])]
            selected_video = {
                'video_id': video_id, 'sign_id': sign_id,
                'source': 'Auto-suggested word sequence', 'url': urls[0],
                'verification_status': 'Unverified',
                'priority': str(max(priorities, default=0) + 1), 'problem_report': '',
            }
            videos.append(selected_video)
            by_video_id[video_id] = selected_video
            videos_by_sign.setdefault(sign_id, []).append(selected_video)
        selected_video['verification_status'] = 'Unverified'
        video_ids.add(selected_video['video_id'])
        for entry in entries:
            if entry['sign_id'] == sign_id and not entry['selected_video_id']:
                entry['selected_video_id'] = selected_video['video_id']
        for video_id in video_ids:
            if video_id in by_video_id:
                by_video_id[video_id]['verification_status'] = 'Unverified'

    sequences = batch['sequences']
    for sign_id, _, urls in batch['suggestions']:
        sequences.extend({'sign_id': sign_id, 'position': str(index), 'url': url}
                         for index, url in enumerate(urls, start=1))

    data = generate_data.load()
    data['videos'] = videos
    data['lesson_vocabulary'] = entries
    data['video_sequences'] = sequences
    generate_data.validate(data)

    write_table('videos', videos, batch['video_fields'], batch['video_encoding'], batch['video_newline'])
    write_table('lesson_vocabulary', entries, batch['entry_fields'], batch['entry_encoding'], batch['entry_newline'])
    write_table('video_sequences', sequences, batch['sequence_fields'], batch['sequence_encoding'], batch['sequence_newline'])
    data = generate_data.load()
    output = json.dumps(data, ensure_ascii=False, indent=2)
    (ROOT / 'data/data.json').write_text(output + '\n', encoding='utf-8')
    (ROOT / 'data/data.js').write_text('window.BSL_DATA = ' + output + ';\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Write the suggestions into the CSV masters and generated data.')
    args = parser.parse_args()
    data = generate_data.load()
    batch = build_suggestions(data)
    clips = sum(len(urls) for _, _, urls in batch['suggestions'])
    print(f"New phrase sequences: {len(batch['suggestions'])}")
    print(f"Components matched to existing word videos: {batch['exact_count']}")
    print(f"Components using a SignStation filename guess: {batch['guessed_count']}")
    print(f"Skipped ambiguous or unusable signs: {batch['ambiguous_count']}")
    print(f"Total clips in suggestions: {clips}")
    if args.apply and batch['suggestions']:
        apply_suggestions(batch)
        print('Applied. All new phrase videos are Unverified.')
    elif args.apply:
        print('No new sequences to apply.')
    else:
        print('Dry run only. Use --apply to write these suggestions.')


if __name__ == '__main__':
    main()
