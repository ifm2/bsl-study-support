"""Local-only editor server for VerifyVideo.html."""
import csv
import json
import re
import sys
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import generate_data  # noqa: E402

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path == '/api/verify':
            try:
                length = int(self.headers.get('Content-Length', '0'))
                body = json.loads(self.rfile.read(length))
                data = generate_data.load()
                entry = next((e for e in data['lesson_vocabulary'] if e['entry_id'] == str(body.get('entry_id', ''))), None)
                if not entry or not entry['selected_video_id']:
                    raise ValueError('This entry has no assigned video to verify.')
                video = next((v for v in data['videos'] if v['video_id'] == entry['selected_video_id']), None)
                if not video:
                    raise ValueError('Selected video was not found.')
                video['verification_status'] = 'Verified'
                generate_data.validate(data)
                data['lesson_vocabulary'].sort(key=lambda r: int(r['global_order']))
                data['signs'].sort(key=lambda r: r['sign_id'])
                data['videos'].sort(key=lambda r: (r['sign_id'], int(r['priority'])))
                for name, rows in data.items():
                    with (ROOT / f'data/{name}.csv').open('w', encoding='utf-8', newline='') as f:
                        writer=csv.DictWriter(f, fieldnames=generate_data.FIELDS[name], lineterminator='\n')
                        writer.writeheader(); writer.writerows(rows)
                output = json.dumps(data, ensure_ascii=False, indent=2)
                (ROOT / 'data/data.json').write_text(output + '\n', encoding='utf-8')
                (ROOT / 'data/data.js').write_text('window.BSL_DATA = ' + output + ';\n', encoding='utf-8')
                return self.respond(200, {'video_id':video['video_id'],'message':f'{video["video_id"]} marked Verified.','data':data})
            except Exception as e:
                return self.respond(400, {'error':str(e)})
        if self.path != '/api/save':
            return self.send_error(404)
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length > 10000:
                raise ValueError('Request too large')
            body = json.loads(self.rfile.read(length))
            entry_id, raw_url = str(body.get('entry_id', '')), str(body.get('url', '')).strip()
            parsed = urlparse(raw_url)
            if parsed.scheme != 'https' or not parsed.netloc or len(raw_url) > 2048:
                raise ValueError('Enter a valid HTTPS URL (maximum 2048 characters).')
            data = generate_data.load()
            entry = next((e for e in data['lesson_vocabulary'] if e['entry_id'] == entry_id), None)
            if not entry:
                raise ValueError('Entry not found; reload the page and try again.')
            videos = data['videos']
            old_selected = next((v for v in videos if v['video_id'] == entry['selected_video_id']), None)
            if old_selected and old_selected['url'] == raw_url:
                raise ValueError('This URL is already assigned to the entry.')
            if old_selected:
                # Fix the existing candidate, preserving its permanent ID and metadata.
                old_selected['url'] = raw_url
                old_selected['verification_status'] = 'Unverified'
                video_id = old_selected['video_id']
            else:
                # Reuse an existing candidate for this sign when present, otherwise create a stable ID.
                candidate = next((v for v in videos if v['sign_id'] == entry['sign_id']), None)
                if candidate:
                    candidate['url'] = raw_url
                    candidate['verification_status'] = 'Unverified'
                    video_id = candidate['video_id']
                else:
                    digest = __import__('hashlib').sha256((entry['sign_id'] + raw_url).encode()).hexdigest()[:16]
                    video_id = 'video_' + digest
                    if any(v['video_id'] == video_id for v in videos):
                        raise ValueError('Generated video ID already exists; use Fix Video instead.')
                    priorities = [int(v['priority']) for v in videos if v['sign_id'] == entry['sign_id']]
                    videos.append({'video_id': video_id, 'sign_id': entry['sign_id'], 'source': 'Manually added via VerifyVideo',
                                   'url': raw_url, 'verification_status': 'Unverified', 'priority': str(max(priorities, default=0)+1)})
                entry['selected_video_id'] = video_id
            generate_data.validate(data)
            stamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            audit_path = ROOT / 'data/video_edit_log.csv'
            new_log = not audit_path.exists()
            with audit_path.open('a', encoding='utf-8', newline='') as f:
                w = csv.writer(f)
                if new_log: w.writerow(['timestamp_utc','entry_id','word','video_id','old_url','new_url','action'])
                w.writerow([stamp, entry_id, entry['word'], video_id, old_selected['url'] if old_selected else '', raw_url, 'update' if old_selected else 'assign'])
            # Preserve the canonical ID-based ordering and write all three masters.
            data['lesson_vocabulary'].sort(key=lambda r: int(r['global_order']))
            data['signs'].sort(key=lambda r: r['sign_id'])
            data['videos'].sort(key=lambda r: (r['sign_id'], int(r['priority'])))
            for name, rows in data.items():
                path = ROOT / f'data/{name}.csv'
                with path.open('w', encoding='utf-8', newline='') as f:
                    writer=csv.DictWriter(f, fieldnames=generate_data.FIELDS[name], lineterminator='\n')
                    writer.writeheader(); writer.writerows(rows)
            output = json.dumps(data, ensure_ascii=False, indent=2)
            (ROOT / 'data/data.json').write_text(output + '\n', encoding='utf-8')
            (ROOT / 'data/data.js').write_text('window.BSL_DATA = ' + output + ';\n', encoding='utf-8')
            self.respond(200, {'video_id':video_id,'data':data})
        except Exception as e:
            self.respond(400, {'error':str(e)})

    def respond(self, code, payload):
        raw=json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)

if __name__ == '__main__':
    print('VerifyVideo available at http://127.0.0.1:8000/VerifyVideo.html (Ctrl+C to stop)')
    ThreadingHTTPServer(('127.0.0.1',8000),Handler).serve_forever()
