"""Local-only editor server for VerifyVideo.html."""
import csv
import hashlib
import io
import json
import re
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import generate_data  # noqa: E402

COLUMNS = {
    'signs': ['sign_id', 'word', 'meaning'],
    'videos': ['video_id', 'sign_id', 'source', 'url', 'verification_status', 'priority'],
    'lesson_vocabulary': ['entry_id', 'sign_id', 'selected_video_id', 'level', 'lesson', 'category',
                          'global_order', 'source_page', 'word', 'source_text', 'notes', 'topic', 'nmf', 'source_pages'],
    'video_sequences': ['sign_id', 'position', 'url'],
}


def read_master(name):
    path = ROOT / f'data/{name}.csv'
    raw = path.read_bytes()
    encoding = 'utf-8-sig' if raw.startswith(b'\xef\xbb\xbf') else 'utf-8'
    text = raw.decode(encoding)
    newline = '\r\n' if '\r\n' in text else '\n'
    rows = list(csv.DictReader(io.StringIO(text, newline='')))
    return rows, encoding, newline


def write_master(name, rows, encoding, newline):
    path = ROOT / f'data/{name}.csv'
    output = io.StringIO(newline='')
    writer = csv.DictWriter(output, fieldnames=COLUMNS[name], lineterminator=newline)
    writer.writeheader()
    writer.writerows(rows)
    path.write_bytes(output.getvalue().encode(encoding))


def generated_data():
    data = generate_data.load()
    output = json.dumps(data, ensure_ascii=False, indent=2)
    (ROOT / 'data/data.json').write_text(output + '\n', encoding='utf-8')
    (ROOT / 'data/data.js').write_text('window.BSL_DATA = ' + output + ';\n', encoding='utf-8')
    return data


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Keep the local dictionary and verification UI in sync with regenerated data files.
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_POST(self):
        if self.path not in {'/api/save', '/api/verify', '/api/sequence'}:
            return self.send_error(404)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 10000:
                raise ValueError('Invalid request size')
            body = json.loads(self.rfile.read(length))
            entries, entry_encoding, entry_newline = read_master('lesson_vocabulary')
            videos, video_encoding, video_newline = read_master('videos')
            entry = next((e for e in entries if e['entry_id'] == str(body.get('entry_id', ''))), None)
            if not entry:
                raise ValueError('Entry not found; reload the page and try again.')
            video = next((v for v in videos if v['video_id'] == entry['selected_video_id']), None)

            if self.path == '/api/sequence':
                urls = body.get('urls')
                if not isinstance(urls, list) or len(urls) != 3:
                    raise ValueError('Enter exactly three direct MP4 URLs in the order they should play.')
                urls = [str(url).strip() for url in urls]
                for raw_url in urls:
                    parsed = urlparse(raw_url)
                    if (parsed.scheme != 'https' or not parsed.netloc or len(raw_url) > 2048
                            or not parsed.path.lower().endswith('.mp4')):
                        raise ValueError('Each sequence clip must be a direct HTTPS MP4 URL.')

                sequences, sequence_encoding, sequence_newline = read_master('video_sequences')
                previous_urls = [clip['url'] for clip in sorted(
                    (clip for clip in sequences if clip['sign_id'] == entry['sign_id']),
                    key=lambda clip: int(clip['position']))]
                sequence_changed = previous_urls != urls
                sequences = [clip for clip in sequences if clip['sign_id'] != entry['sign_id']]
                sequences.extend({'sign_id': entry['sign_id'], 'position': str(i), 'url': url}
                                 for i, url in enumerate(urls, start=1))

                if not video:
                    video = next((v for v in videos if v['sign_id'] == entry['sign_id']), None)
                    if not video:
                        video_id = 'video_' + hashlib.sha256(
                            (entry['sign_id'] + json.dumps(urls)).encode()).hexdigest()[:16]
                        priorities = [int(v['priority']) for v in videos if v['sign_id'] == entry['sign_id']]
                        video = {'video_id': video_id, 'sign_id': entry['sign_id'],
                                 'source': 'Manual three-clip sequence via VerifyVideo', 'url': urls[0],
                                 'verification_status': 'Unverified',
                                 'priority': str(max(priorities, default=0) + 1)}
                        videos.append(video)
                    entry['selected_video_id'] = video['video_id']
                if sequence_changed:
                    video['verification_status'] = 'Unverified'

                validation_data = generate_data.load()
                validation_data['videos'] = videos
                validation_data['lesson_vocabulary'] = entries
                validation_data['video_sequences'] = sequences
                generate_data.validate(validation_data)
                write_master('video_sequences', sequences, sequence_encoding, sequence_newline)
                write_master('videos', videos, video_encoding, video_newline)
                write_master('lesson_vocabulary', entries, entry_encoding, entry_newline)
                data = generated_data()
                return self.respond(200, {'video_id': video['video_id'],
                                          'message': 'Three-clip sequence saved in order.', 'data': data})

            if self.path == '/api/verify':
                if not video:
                    raise ValueError('This entry has no assigned video to verify.')
                video['verification_status'] = 'Verified'
                generate_data.validate({**generate_data.load(), 'videos': videos})
                write_master('videos', videos, video_encoding, video_newline)
                data = generated_data()
                return self.respond(200, {'video_id': video['video_id'], 'message': f'{video["video_id"]} marked Verified.', 'data': data})

            raw_url = str(body.get('url', '')).strip()
            parsed = urlparse(raw_url)
            host = (parsed.hostname or '').lower()
            is_signbsl_video = (host in {'signbsl.com', 'www.signbsl.com'}
                                and re.fullmatch(r'/sign/[^/]+', parsed.path)
                                and re.fullmatch(r'[A-Za-z0-9_-]{1,64}', parsed.fragment))
            is_direct_mp4 = parsed.path.lower().endswith('.mp4')
            if parsed.scheme != 'https' or not parsed.netloc or len(raw_url) > 2048 or not (is_signbsl_video or is_direct_mp4):
                raise ValueError('Enter a direct .mp4 URL or a SignBSL sign URL ending in #video-id (maximum 2048 characters).')
            if video and video['url'] == raw_url:
                raise ValueError('This URL is already assigned to the entry.')
            if video:
                video['url'] = raw_url
                video['verification_status'] = 'Unverified'
                video_id = video['video_id']
            else:
                video = next((v for v in videos if v['sign_id'] == entry['sign_id']), None)
                if video:
                    video['url'] = raw_url
                    video['verification_status'] = 'Unverified'
                    video_id = video['video_id']
                else:
                    video_id = 'video_' + hashlib.sha256((entry['sign_id'] + raw_url).encode()).hexdigest()[:16]
                    if any(v['video_id'] == video_id for v in videos):
                        raise ValueError('Generated video ID already exists; use Fix Video instead.')
                    priorities = [int(v['priority']) for v in videos if v['sign_id'] == entry['sign_id']]
                    video = {'video_id': video_id, 'sign_id': entry['sign_id'], 'source': 'Manually added via VerifyVideo',
                             'url': raw_url, 'verification_status': 'Unverified', 'priority': str(max(priorities, default=0) + 1)}
                    videos.append(video)
                entry['selected_video_id'] = video_id

            validation_data = generate_data.load()
            validation_data['videos'] = videos
            validation_data['lesson_vocabulary'] = entries
            generate_data.validate(validation_data)
            write_master('videos', videos, video_encoding, video_newline)
            write_master('lesson_vocabulary', entries, entry_encoding, entry_newline)
            data = generated_data()
            return self.respond(200, {'video_id': video_id, 'data': data})
        except Exception as e:
            return self.respond(400, {'error': str(e)})

    def respond(self, code, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


if __name__ == '__main__':
    print('VerifyVideo available at http://127.0.0.1:8000/VerifyVideo.html (Ctrl+C to stop)')
    ThreadingHTTPServer(('127.0.0.1', 8000), Handler).serve_forever()
