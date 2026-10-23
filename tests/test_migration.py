import copy,csv,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
from generate_data import load,validate
class DataTests(unittest.TestCase):
 def setUp(self):self.data=load()
 def test_level1_lossless(self):
  original=json.loads((ROOT/'tests/fixtures/original_vocabulary.json').read_text(encoding='utf-8'))
  rows=[r for r in self.data['lesson_vocabulary'] if r['level']=='1']
  videos={r['video_id']:r for r in self.data['videos']}
  self.assertEqual(len(rows),852)
  for before,after in zip(original,rows):
   for key in ('entry_id','global_order','lesson','category','source_page','word','source_text','notes'):
    self.assertEqual(before[key],after[key])
   self.assertEqual(videos[after['selected_video_id']]['url'],before['video_url'])
   self.assertEqual(videos[after['selected_video_id']]['verification_status'],before['status'])
 def test_level2_topics_split_and_nmf(self):
  rows=[r for r in self.data['lesson_vocabulary'] if r['level']=='2']
  self.assertEqual(len(rows),813)
  self.assertEqual(len({r['topic'] for r in rows}),9)
  self.assertTrue(all(not r['lesson'] and '/' not in r['word'] for r in rows))
  self.assertEqual({r['word'] for r in rows if r['nmf']=='TRUE'},{'Brush Hair','Brush Teeth'})
  words={r['word'].lower() for r in rows if r['topic']=='Home Life'}
  self.assertTrue({'dirty','happy'}.issubset(words))
  self.assertEqual(len({(r['topic'],r['category'],r['word'].lower()) for r in rows}),len(rows))
 def test_no_fabricated_videos(self):
  self.assertEqual(len(self.data['videos']),969)
  self.assertEqual({r['verification_status'] for r in self.data['videos']},{'Unverified'})
  original=json.loads((ROOT/'tests/fixtures/original_vocabulary.json').read_text(encoding='utf-8'))
  self.assertTrue({r['video_url'] for r in original}.issubset({v['url'] for v in self.data['videos']}))
  smap={s['sign_id']:s for s in self.data['signs']}
  vmap={v['video_id']:v for v in self.data['videos']}
  for r in self.data['lesson_vocabulary']:
   if r['selected_video_id']:
    self.assertEqual(vmap[r['selected_video_id']]['sign_id'],r['sign_id'])
    self.assertEqual(smap[r['sign_id']]['word'],r['word'])
 def test_new_video_provenance_and_v3_preservation(self):
  baseline=json.loads((ROOT/'tests/fixtures/v3_data.json').read_text(encoding='utf-8'))
  audit=json.loads((ROOT/'data/video_lookup_audit.json').read_text(encoding='utf-8'))
  self.assertEqual(len(audit),467)
  selected={a['video_id']:a for a in audit if a['video_id']}
  self.assertEqual(len(selected),406)
  basevideos={v['video_id']:v for v in baseline['videos']}
  allvideos={v['video_id']:v for v in self.data['videos']}
  for vid,row in basevideos.items():self.assertEqual(allvideos[vid],row)
  for vid,row in allvideos.items():
   if vid in basevideos:continue
   proof=selected[vid]
   self.assertEqual(row['url'],proof['mp4_url'])
   self.assertEqual(row['sign_id'],proof['sign_id'])
   self.assertIn(proof['http_status'],[200,206])
   self.assertTrue(proof['mp4_header_checked'])
   self.assertIn(proof['source_page'],row['source'])
  entries={r['entry_id']:r for r in self.data['lesson_vocabulary']}
  for original in baseline['lesson_vocabulary']:
   current=entries[original['entry_id']]
   for field,value in original.items():
    if field=='selected_video_id' and original['level']=='2' and not value:continue
    self.assertEqual(current[field],value)
  self.assertEqual(sum(r['level']=='2' and not r['selected_video_id'] for r in entries.values()),61)
 def test_all_existing_records_and_ids_preserved(self):
  baseline=json.loads((ROOT/'tests/fixtures/baseline_data.json').read_text(encoding='utf-8'))
  for name,key in [('signs','sign_id'),('videos','video_id'),('lesson_vocabulary','entry_id')]:
   lookup={r[key]:r for r in self.data[name]}
   for original in baseline[name]:
    self.assertIn(original[key],lookup)
    for field,value in original.items():self.assertEqual(lookup[original[key]][field],value)
 def test_invalid_inputs(self):
  level2=next(i for i,r in enumerate(self.data['lesson_vocabulary']) if r['level']=='2')
  mutations=[lambda d:d['signs'].append(copy.deepcopy(d['signs'][0])),lambda d:d['videos'][0].update(sign_id='missing'),lambda d:d['videos'][0].update(url='javascript:alert(1)'),lambda d:d['lesson_vocabulary'][0].update(selected_video_id='missing'),lambda d:d['lesson_vocabulary'][0].update(level='3'),lambda d:d['lesson_vocabulary'][0].update(lesson='15'),lambda d:d['lesson_vocabulary'][level2].update(topic='Imagined'),lambda d:d['lesson_vocabulary'][level2].update(lesson='1'),lambda d:d['lesson_vocabulary'][0].update(nmf='yes'),lambda d:d['lesson_vocabulary'][0].update(source_pages='not a page')]
  for mutate in mutations:
   data=copy.deepcopy(self.data);mutate(data)
   with self.assertRaises(ValueError):validate(data)
 def test_generated_and_three_csvs(self):
  self.assertEqual(json.loads((ROOT/'data/data.json').read_text(encoding='utf-8')),self.data)
  self.assertEqual(len(list((ROOT/'data').glob('*.csv'))),3)
if __name__=='__main__':unittest.main()
