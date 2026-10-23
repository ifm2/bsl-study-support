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
 await page.click('#study-practice');assert.equal(await page.locator('.tile').count(),1);assert.equal(await word(),'What is this sign?');
 const first=await cardId();await page.click('.answer-button');
 assert.notEqual(await word(),'What is this sign?');assert.equal(await page.locator('.revealed-answer').innerText(),await word());
 assert.equal(await page.locator('.revealed-answer').isVisible(),true);assert.equal(await page.locator('.answer-button:visible').count(),0);
 await page.getByRole('button',{name:'Almost',exact:true}).click();assert.match(await page.locator('#practice-progress').innerText(),/^1 of/);
 await page.click('#practice-next');assert.equal(await word(),'What is this sign?');assert.equal(await page.locator('.revealed-answer').isVisible(),false);
 await page.click('#practice-prev');assert.equal(await cardId(),first);await page.click('.answer-button');
 assert.equal(await page.getByRole('button',{name:'Almost',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Got it',exact:true}).click();assert.match(await page.locator('#practice-progress').innerText(),/^1 of/);
 await page.uncheck('#show-details');assert.equal(await cardId(),first);assert.equal(await page.locator('.entry-meta').isVisible(),false);
 await page.uncheck('#hide-english');assert.notEqual(await word(),'What is this sign?');
 await page.check('#hide-english');assert.equal(await cardId(),first);
 // Complete random deck in both directions; ratings don't reshuffle it.
 const deck=[first];for(let i=1;i<39;i++){await page.click('#practice-next');deck.push(await cardId());}
 assert.equal(new Set(deck).size,39);assert.equal(await page.locator('#practice-next').isDisabled(),true);
 assert.match(await page.locator('#practice-score').innerText(),/Finish rating/);
 await page.getByRole('button',{name:'Go to next unrated card'}).click();assert.equal(await cardId(),deck[1]);
 for(let i=2;i<39;i++)await page.click('#practice-next');
 for(let i=37;i>=0;i--){await page.click('#practice-prev');assert.equal(await cardId(),deck[i]);}
 await page.click('#study-dictionary');await page.click('#study-practice');assert.equal(await cardId(),first);
 await page.uncheck('#random-order');assert.equal(await cardId(),'1');assert.match(await page.locator('#practice-progress').innerText(),/^0 of/);
 await page.fill('#search','thank you');await page.click('.answer-button');await page.getByRole('button',{name:'Almost',exact:true}).click();
 assert.match(await page.locator('#practice-score').innerText(),/Your score: 0.5 \/ 1 \(50%\)/);
 await page.getByRole('button',{name:'Not yet',exact:true}).click();assert.match(await page.locator('#practice-score').innerText(),/0 \/ 1 \(0%\)/);
 await page.getByRole('button',{name:'Got it',exact:true}).click();assert.match(await page.locator('#practice-score').innerText(),/1 \/ 1 \(100%\)/);
 await page.getByRole('button',{name:'Restart practice'}).click();assert.match(await page.locator('#practice-progress').innerText(),/^0 of/);
 // Full multi-card mixed score, including skips and backward score edits.
 await page.selectOption('#lesson-nav','1');
 await page.locator('#category-nav button').nth(1).click();
 const count=Number((await page.locator('#practice-position').innerText()).split(' of ')[1]);let total=0;
 for(let i=0;i<count;i++) {
  await page.click('.answer-button');const index=i%3;
  await page.getByRole('button',{name:['Not yet','Almost','Got it'][index],exact:true}).click();total += [0,.5,1][index];
  if(i<count-1)await page.click('#practice-next');
 }
 assert.ok((await page.locator('#practice-score').innerText()).includes(`Your score: ${total} / ${count} (${Math.round(total/count*100)}%)`));
 await page.screenshot({path:path.join(root,'tests/practice-score.png'),fullPage:true});
 // Level 2 practice excludes entries without media and doesn't erase dictionary words.
 await page.selectOption('#level-nav','2');
 const work=data.lesson_vocabulary.filter(r=>r.level==='2'&&r.topic==='Work Life');
 assert.match(await page.locator('#stats').innerText(),new RegExp('^'+work.filter(eligible).length+' practice cards'));
 await page.fill('#search','photographer');
 assert.equal(await page.locator('.tile').count(),0);assert.match(await page.locator('.empty').innerText(),/No practice videos/);
 await page.click('#study-dictionary');assert.deepEqual(await page.locator('.tile h4').allTextContents(),['Photographer']);
 await page.selectOption('#level-nav','1');await page.check('#show-details');
 await page.screenshot({path:path.join(root,'tests/desktop.png')});
 for(const width of [320,390,768,1280]) {
  await page.setViewportSize({width,height:950});
  for(const mode of ['dictionary','practice']) {
   await page.click('#study-'+mode);
   if(mode==='practice'){await page.locator('.answer-button').first().click();}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width} ${mode}`);
   if(width===390)await page.screenshot({path:path.join(root,'tests/mobile-'+mode+'.png'),fullPage:mode==='practice'});
  }
  await page.selectOption('#level-nav','2');await page.selectOption('#lesson-nav','People and Personalities');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.selectOption('#level-nav','1');
 }
 await page.click('#study-dictionary');
 const cleanup=await page.evaluate(()=>{
  document.getElementById('mode-autoplay').click();const old=[...document.querySelectorAll('video')];
  document.getElementById('study-practice').click();
  const stopped=old.length===39&&old.every(v=>v.paused&&!v.isConnected&&!v.children.length);
  document.querySelector('.flashcard-launch').click();const video=document.querySelector('video');
  document.querySelector('.answer-button').click();const retained=document.querySelector('video')===video;
  document.getElementById('practice-next').click();return {stopped,retained,released:video.paused&&!video.isConnected&&!video.children.length};
 });assert.deepEqual(cleanup,{stopped:true,retained:true,released:true});
 await page.reload();assert.equal(await page.locator('#study-dictionary').getAttribute('aria-pressed'),'true');
 for(const id of ['show-details','random-order','hide-english'])assert.equal(await page.isChecked('#'+id),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: all Level 1/2 rows and topic menus; defaults; direct MP4 and fallback; playback cleanup; shuffle stability; one-way reveal; independent settings; scores 0/50/100 and mixed multi-card; skipped ratings; score edits/restart; cross-level search navigation; responsive 320/390/768/1280; no JS errors. Signing media intentionally aborted and remains Unverified.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
