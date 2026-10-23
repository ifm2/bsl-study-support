const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let requests=0;await page.route('https://**/*',r=>{if(/\.mp4(?:\?|$)/i.test(r.request().url()))requests++;return r.abort();});
 const data=JSON.parse(fs.readFileSync(path.join(root,'data/data.json'),'utf8'));
 const eligible=r=>!!r.selected_video_id;
 const cardId=()=>page.locator('.tile').getAttribute('data-entry-id');
 const word=()=>page.locator('.tile h4').innerText();
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);
 assert.equal(await page.locator('#study-dictionary').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#mode-flashcard').getAttribute('aria-pressed'),'true');
 for(const id of ['show-details','random-order','hide-english'])assert.equal(await page.isChecked('#'+id),true);
 assert.equal(await page.locator('video').count(),0);assert.equal(requests,0);
 assert.equal(await page.locator('.support-link a').getAttribute('href'),'https://ko-fi.com/S6S24KS6O');
 assert.equal(await page.locator('.support-link a').getAttribute('target'),'_blank');
 assert.match(await page.locator('.support-link a').getAttribute('rel'),/noopener/);
 assert.equal(await page.locator('.support-link img').getAttribute('src'),'https://storage.ko-fi.com/cdn/kofi6.png?v=6');
 assert.equal(await page.locator('.support-link img').getAttribute('height'),'36');
 for(let lesson=1;lesson<=14;lesson++) {
  await page.selectOption('#lesson-nav',String(lesson));
  const expected=data.lesson_vocabulary.filter(r=>r.level==='1'&&Number(r.lesson)===lesson);
  assert.deepEqual(await page.locator('.tile h4').allTextContents(),expected.map(r=>r.word));
  assert.deepEqual(await page.locator('.tile small').allTextContents(),expected.map(r=>`#${r.entry_id} · Workbook page ${r.source_page}`));
 }
 await page.selectOption('#level-nav','2');
 const topics=[...new Set(data.lesson_vocabulary.filter(r=>r.level==='2').map(r=>r.topic))];
 assert.deepEqual(await page.locator('#lesson-nav option').allTextContents(),topics);
 assert.equal(await page.locator('label[for="lesson-nav"]').innerText(),'Choose topic');
 for(const topic of topics) {
  await page.selectOption('#lesson-nav',topic);
  const expected=data.lesson_vocabulary.filter(r=>r.level==='2'&&r.topic===topic);
  assert.deepEqual(await page.locator('.tile h4').allTextContents(),expected.map(r=>r.word));
  assert.equal(await page.locator('.flashcard-launch').count(),expected.filter(eligible).length);
 }
 await page.selectOption('#level-nav','1');
 await page.fill('#search','banana');assert.equal(await page.locator('.tile').count(),0);
 assert.equal(await page.locator('#other-matches').isVisible(),true);
 assert.ok((await page.locator('.search-destination').allTextContents()).some(t=>t.includes('Level 1')));
 await page.getByRole('button',{name:/Level 2 · Food and Drink/}).click();
 assert.equal(await page.inputValue('#level-nav'),'2');assert.equal(await page.inputValue('#lesson-nav'),'Food and Drink');
 assert.equal(await page.inputValue('#search'),'banana');assert.deepEqual(await page.locator('.tile h4').allTextContents(),['Banana']);
 await page.fill('#search','zzzz_no_match');assert.equal(await page.locator('#other-matches').isVisible(),false);
 await page.selectOption('#level-nav','1');
 await page.locator('#category-nav a').first().click();assert.match(new URL(page.url()).hash,/category-0/);
 await page.locator('.flashcard-launch').first().click();await page.waitForSelector('.video-error');
 const auto=await page.evaluate(()=>{document.getElementById('mode-autoplay').click();return [...document.querySelectorAll('video')].map(v=>({muted:v.muted,loop:v.loop,auto:v.autoplay,inline:v.playsInline,src:v.querySelector('source').getAttribute('src')}));});
 assert.equal(auto.length,39);assert.ok(auto.every(v=>v.muted&&v.loop&&v.auto&&v.inline));
 assert.equal(auto[0].src,'https://media.signbsl.com/videos/bsl/signstation/hello.mp4');
 await page.click('#mode-flashcard');assert.equal(await page.locator('video').count(),0);

 // Practice autoplay works even though Dictionary is set to Flashcard.
 const initial=await page.evaluate(()=>{
  document.getElementById('study-practice').click();const v=document.querySelector('video');
  let playCalls=0;v.play=()=>{playCalls++;return Promise.resolve();};v.dispatchEvent(new Event('canplay'));
  return {muted:v.muted,loop:v.loop,auto:v.autoplay,inline:v.playsInline,preload:v.preload,playCalls,label:v.getAttribute('aria-label')};
 });
 assert.deepEqual(initial,{muted:true,loop:true,auto:true,inline:true,preload:'auto',playCalls:1,label:'Practice sign video'});
 assert.equal(await page.locator('.tile').count(),1);assert.equal(await word(),'What is this sign?');
 assert.equal(await page.locator('#practice-next,#practice-prev').count(),0);
 const reveal=async()=>{if(await page.locator('#content .answer-button:visible').count())await page.locator('#content .answer-button').click();};
 const rate=async label=>{await reveal();await page.getByRole('button',{name:label,exact:true}).click();};
 const first=await cardId();await reveal();
 assert.equal(await page.locator('.revealed-answer').innerText(),await word());
 assert.equal(await page.locator('#content .answer-button:visible').count(),0);
 const nextProps=await page.evaluate(()=>{
  const old=document.querySelector('video');const retained=old;
  // Errors can remove the deliberately aborted player; test cleanup synchronously on a fresh render.
  document.getElementById('hide-english').click();
  const current=document.querySelector('video');
  document.querySelector('.confidence-button[data-score="1"]').click();
  const next=document.querySelector('video');
  return {released:current.paused&&!current.isConnected&&!current.children.length,auto:next.autoplay,muted:next.muted,loop:next.loop};
 });
 assert.deepEqual(nextProps,{released:true,auto:true,muted:true,loop:true});
 assert.notEqual(await cardId(),first);assert.match(await page.locator('#practice-progress').innerText(),/^1 of/);
 await page.check('#hide-english');assert.equal(await word(),'What is this sign?');
 const second=await cardId();await page.click('#study-dictionary');await page.click('#study-practice');
 assert.equal(await cardId(),second);assert.match(await page.locator('#practice-progress').innerText(),/^1 of/);
 await page.uncheck('#show-details');assert.equal(await cardId(),second);assert.equal(await page.locator('.entry-meta').isVisible(),false);
 await page.uncheck('#hide-english');assert.notEqual(await word(),'What is this sign?');
 await page.check('#hide-english');assert.equal(await cardId(),second);
 // Rate the rest of the stable random deck through buttons, with no card repeats or omissions.
 const deck=[first];
 for(let i=1;i<39;i++){deck.push(await cardId());await rate('Almost');}
 assert.equal(new Set(deck).size,39);
 assert.deepEqual([...deck].sort(),data.lesson_vocabulary.filter(r=>r.level==='1'&&r.lesson==='1').map(r=>r.entry_id).sort());
 assert.equal(await page.locator('.tile').count(),0);assert.equal(await page.locator('video').count(),0);
 assert.equal(await page.locator('#practice-score').isVisible(),true);
 assert.equal(await page.locator('#practice-position').isVisible(),false);
 assert.equal(await page.locator('.score-result[data-rating="0"] .score-percentage').innerText(),'0%');
 assert.equal(await page.locator('.score-result[data-rating="0.5"] .score-percentage').innerText(),'97.4%');
 assert.equal(await page.locator('.score-result[data-rating="1"] .score-percentage').innerText(),'2.6%');
 assert.equal((await page.locator('#practice-score').innerText()).includes('This is your confidence score'),false);
 assert.equal((await page.locator('#practice-score').innerText()).includes('Your score:'),false);
 await page.click('#study-dictionary');await page.click('#study-practice');
 assert.equal(await page.locator('.tile').count(),0);assert.equal(await page.locator('#practice-score').isVisible(),true);
 await page.getByRole('button',{name:'Restart practice'}).click();assert.equal(await cardId(),first);
 assert.match(await page.locator('#practice-progress').innerText(),/^0 of/);
 await page.uncheck('#random-order');assert.equal(await cardId(),'1');
 // One-card sets: each confidence button completes the set and reports a distribution.
 for(const label of ['Not Yet','Almost','Got it']) {
  await page.fill('#search','thank you');
  await rate(label);
  assert.equal(await page.locator('.tile').count(),0);
  const value={'Not Yet':0,Almost:.5,'Got it':1}[label];
  for(const score of [0,.5,1])assert.equal(await page.locator(`.score-result[data-rating="${score}"] .score-percentage`).innerText(),score===value?'100%':'0%');
  await page.getByRole('button',{name:'Restart practice'}).click();
 }
 // Requested Level 2 heading: topic with selected category, no overall score.
 await page.selectOption('#level-nav','2');await page.selectOption('#lesson-nav','Health and Fitness');
 await page.getByRole('button',{name:'Anatomy',exact:true}).click();
 const anatomy=data.lesson_vocabulary.filter(r=>r.level==='2'&&r.topic==='Health and Fitness'&&r.category==='Anatomy'&&eligible(r));
 const ratings=[0,0,0,.5,.5,1,1,1,1,1,1,1];
 let counts={0:0,'0.5':0,1:0};
 for(let i=0;i<anatomy.length;i++) {
  assert.equal(await cardId(),anatomy[i].entry_id);
  const score=ratings[i%ratings.length];counts[score]++;await rate({0:'Not Yet','0.5':'Almost',1:'Got it'}[score]);
 }
 assert.equal(await page.locator('#practice-score h3').innerText(),'Your Score for Health and Fitness: Anatomy');
 for(const score of [0,.5,1]) {
  const expected=Number((counts[score]/anatomy.length*100).toFixed(1))+'%';
  assert.equal(await page.locator(`.score-result[data-rating="${score}"] .score-percentage`).innerText(),expected);
 }
 await page.screenshot({path:path.join(root,'tests/practice-score.png'),fullPage:true});
 await page.getByRole('button',{name:'All categories',exact:true}).click();await page.fill('#search','arm');
 // Search resets the category and produces one matching Anatomy card.
 assert.equal(await page.locator('.tile').count(),1);await rate('Got it');
 assert.equal(await page.locator('#practice-score h3').innerText(),'Your Score for Health and Fitness');
 await page.selectOption('#lesson-nav','Work Life');await page.fill('#search','photographer');
 assert.equal(await page.locator('.tile').count(),0);assert.match(await page.locator('.empty').innerText(),/No practice videos/);
 assert.equal(await page.locator('#practice-score').isVisible(),false);
 await page.click('#study-dictionary');assert.deepEqual(await page.locator('.tile h4').allTextContents(),['Photographer']);
 await page.selectOption('#level-nav','1');await page.check('#show-details');
 await page.screenshot({path:path.join(root,'tests/desktop.png')});
 for(const width of [320,390,768,1280]) {
  await page.setViewportSize({width,height:950});
  for(const mode of ['dictionary','practice']) {
   await page.click('#study-'+mode);if(mode==='practice')await reveal();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width} ${mode}`);
   if(width===390)await page.screenshot({path:path.join(root,'tests/mobile-'+mode+'.png'),fullPage:mode==='practice'});
  }
  await page.fill('#search','thank you');await rate('Almost');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`result overflow ${width}`);
  if(width===390)await page.screenshot({path:path.join(root,'tests/mobile-score.png'),fullPage:true});
  await page.selectOption('#level-nav','2');await page.selectOption('#lesson-nav','People and Personalities');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.selectOption('#level-nav','1');
 }
 await page.click('#study-dictionary');
 const cleanup=await page.evaluate(()=>{
  document.getElementById('mode-autoplay').click();const old=[...document.querySelectorAll('video')];
  document.getElementById('study-practice').click();
  const stopped=old.length===39&&old.every(v=>v.paused&&!v.isConnected&&!v.children.length);
  const video=document.querySelector('video');
  document.querySelector('#content .answer-button').click();const retained=document.querySelector('video')===video;
  document.querySelector('.confidence-button[data-score="1"]').click();
  return {stopped,retained,released:video.paused&&!video.isConnected&&!video.children.length};
 });assert.deepEqual(cleanup,{stopped:true,retained:true,released:true});
 await page.reload();assert.equal(await page.locator('#study-dictionary').getAttribute('aria-pressed'),'true');
 for(const id of ['show-details','random-order','hide-english'])assert.equal(await page.isChecked('#'+id),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: all dictionary data/menus; defaults; MP4 and fallback; Dictionary modes; Practice autoplay/canplay; rating-only advance and cleanup; stable complete shuffle; reveal; independent settings; single/multi-card distributions; topic/category headings; restart/session behavior; cross-set search; responsive cards/results 320/390/768/1280; no JS errors. External media intentionally aborted.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
