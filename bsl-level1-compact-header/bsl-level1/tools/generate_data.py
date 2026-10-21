"""Run: python tools/generate_data.py (from the project folder)."""
import csv, json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
with (root / 'data/vocabulary.csv').open(encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f))
ids = [int(r['entry_id']) for r in rows]
orders = [int(r['global_order']) for r in rows]
if len(ids) != len(set(ids)) or len(orders) != len(set(orders)):
    raise ValueError('entry_id and global_order must each be unique')
rows.sort(key=lambda r: int(r['global_order']))
text = json.dumps(rows, ensure_ascii=False, indent=2)
(root / 'data/vocabulary.json').write_text(text, encoding='utf-8')
(root / 'data/vocabulary.js').write_text('window.BSL_VOCABULARY = ' + text + ';\n', encoding='utf-8')
print(f'Generated website data for {len(rows)} entries.')

with (root / 'data/video_variants.csv').open(encoding='utf-8-sig', newline='') as f:
    variants = list(csv.DictReader(f))
known_ids = {str(x) for x in ids}
for v in variants:
    if v['entry_id'] not in known_ids:
        raise ValueError('Unknown entry_id in video_variants.csv: ' + v['entry_id'])
    if not v['video_url'].startswith('https://'):
        raise ValueError('Invalid video URL in video_variants.csv')
(root / 'data/video_variants.js').write_text('window.BSL_VIDEO_VARIANTS = ' + json.dumps(variants, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
print(f'Generated {len(variants)} alternative video links.')
