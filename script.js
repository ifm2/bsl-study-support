// CSV masters; never shuffle their records in place.
'use strict';
const $ = id => document.getElementById(id);
const data = window.BSL_DATA;
if (!data) throw new Error('Missing generated data. Run tools/generate_data.py.');
const signsById = new Map(data.signs.map(s => [s.sign_id,s]));
const videosById = new Map(data.videos.map(v => [v.video_id,v]));
const videoSequencesBySign = new Map();
for (const clip of data.video_sequences || []) {
 if (!videoSequencesBySign.has(clip.sign_id)) videoSequencesBySign.set(clip.sign_id,[]);
 videoSequencesBySign.get(clip.sign_id).push(clip);
}
for (const clips of videoSequencesBySign.values()) clips.sort((a,b) => Number(a.position)-Number(b.position));
function signBslVideoInfo(rawUrl) {
 try {
  const url=new URL(rawUrl),host=url.hostname.toLowerCase(),videoId=decodeURIComponent(url.hash.slice(1));
  if(!['signbsl.com','www.signbsl.com'].includes(host)||!/^\/sign\/[^/]+$/.test(url.pathname)||! /^[A-Za-z0-9_-]{1,64}$/.test(videoId)) return null;
  return {page:`${url.origin}${url.pathname}`,videoId};
 } catch { return null; }
}
const allVocabulary = data.lesson_vocabulary.map(r => ({...r, meaning:signsById.get(r.sign_id).meaning,
 dictionary_url:signBslVideoInfo(videosById.get(r.selected_video_id)?.url || '') ? videosById.get(r.selected_video_id).url : videosById.get(r.selected_video_id)?.source.match(/https:\/\/www\.signbsl\.com\/[^\s]+/)?.[0] || `https://www.signbsl.com/sign/${encodeURIComponent(r.word.toLowerCase())}`,
 video_url:videoSequencesBySign.get(r.sign_id)?.[0]?.url || videosById.get(r.selected_video_id)?.url || '',
 video_urls:videoSequencesBySign.get(r.sign_id)?.map(clip => clip.url) || (videosById.get(r.selected_video_id)?.url ? [videosById.get(r.selected_video_id).url] : []),
 video_id:videosById.get(r.selected_video_id)?.video_id || '',
 problem_report:videosById.get(r.selected_video_id)?.problem_report || '',
 status:videosById.get(r.selected_video_id)?.verification_status || (videoSequencesBySign.has(r.sign_id) ? 'Unverified' : 'Awaiting video')
})).sort((a,b) => Number(a.global_order)-Number(b.global_order));
const lessonsByLevel = {
 1:['Alphabet','Greetings','Numbers & Everyday Living','Weather & Feelings','Days & Months','Sentence Structure & Gesturing','Pets, Colours & Placement','Transport & Directions','Family','Descriptions & Clothes','Recap','Food & Drink','Home & Hobbies','People, Animals & Objects','Final Recap & Conversations'],
 2:[...new Set(allVocabulary.filter(r => r.level==='2').map(r => r.topic))],
 3:['Home Life','Technology','Health and Wellbeing','Consumer Issues','Social Recreation','Education and Training','Employment','Deaf History']
};
const level3LessonEmoji=['🏠','💻','🏥','🛒','🎭','🎓','💼','🤟'];
const lessonEmoji = ['👋','🔢','🌦️','📅','💬','🐾','🚌','👨‍👩‍👧‍👦','👕','🔄','🍽️','🏠','🧑‍🤝‍🧑','🎓'];
const topicEmoji = {'Work Life':'💼','The Home':'🏠','Education':'🎓','People and Personalities':'👥','Hobbies and Activities':'🎨','Health and Fitness':'💪','Home Life':'🧺','Travel and Holidays':'✈️','Food and Drink':'🍽️'};
let currentLevel=1, currentLesson=1, vocabulary=[], categories=[];
let studyMode='dictionary', playbackMode='flashcard';
let practiceCategory='', practiceRows=null, practiceIndex=0, answerRevealed=false;
let practiceQuestionStyle='self-rate', practiceChoiceResult=null;
let ratings=new Map();
let masterQuiz={rows:null,index:0,style:'choice',answers:[],requestedCount:10};
const content=$('content');
function element(tag,cls,text) {
 const node=document.createElement(tag); if(cls) node.className=cls;
 if(text !== undefined) node.textContent=text; return node;
}
let reportTarget=null;
const reportModal=element('div','report-modal');reportModal.hidden=true;
const reportPanel=element('section','report-modal-panel');reportPanel.setAttribute('role','dialog');reportPanel.setAttribute('aria-modal','true');reportPanel.setAttribute('aria-labelledby','report-modal-title');
const reportTitle=element('h2','','Report a video problem');reportTitle.id='report-modal-title';
const reportDescription=element('p','','Describe the problem. The video will be marked Unverified and the message will appear in VerifyVideo.');
const reportLabel=element('label','report-modal-label','Problem details');
const reportTextarea=document.createElement('textarea');reportTextarea.maxLength=1000;reportTextarea.rows=5;reportTextarea.setAttribute('aria-describedby','report-modal-error');reportLabel.append(reportTextarea);
const reportError=element('p','report-modal-error','');reportError.id='report-modal-error';reportError.setAttribute('role','status');
const reportActions=element('div','report-modal-actions');
const reportCancel=element('button','','Cancel');reportCancel.type='button';
const reportSubmit=element('button','','Send report');reportSubmit.type='button';
reportActions.append(reportCancel,reportSubmit);reportPanel.append(reportTitle,reportDescription,reportLabel,reportError,reportActions);reportModal.append(reportPanel);document.body.append(reportModal);
function closeReportModal() {
 reportModal.hidden=true;reportTarget?.button.focus();reportTarget=null;
}
function openReportModal(row,button) {
 reportTarget={row,button};reportTextarea.value=row.problem_report || '';reportError.textContent='';
 reportError.className='report-modal-error';reportSubmit.disabled=false;reportCancel.disabled=false;
 reportModal.hidden=false;reportTextarea.focus();
}
reportCancel.addEventListener('click',closeReportModal);
reportModal.addEventListener('click',event=>{if(event.target===reportModal)closeReportModal();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!reportModal.hidden)closeReportModal();});
reportSubmit.addEventListener('click',async()=>{
 if(!reportTarget)return;
 const message=reportTextarea.value.trim();
 if(!message){reportError.textContent='Please enter a short message describing the problem.';reportTextarea.focus();return;}
 reportSubmit.disabled=true;reportCancel.disabled=true;reportTarget.button.disabled=true;
 try {
  const response=await fetch('/api/report-problem',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({video_id:reportTarget.row.video_id,message})});
  const result=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(result?.error || 'Reports can only be saved when the dictionary is running with its local video server.');
  reportError.className='report-modal-error success';reportError.textContent=result.message || 'Problem reported. The video is marked Unverified.';
  window.setTimeout(()=>window.location.reload(),900);
 } catch(error) {
  reportError.textContent=error.message || 'Could not save the report. Please use the local video server.';
  reportSubmit.disabled=false;reportCancel.disabled=false;reportTarget.button.disabled=false;
 }
});
function makeSignBslEmbed(row,hideWord=false) {
 const info=signBslVideoInfo(row.video_url);if(!info)return null;
 const quote=element('blockquote','signbsldata-embed');quote.dataset.vidref=info.videoId;
 const link=element('a','',hideWord ? 'Open sign video' : `Watch how to sign '${row.word}' in British Sign Language`);link.href=info.page;quote.append(link);
 const container=element('div','signbsl-player');container.append(quote);
 const script=document.createElement('script');script.async=true;script.src='https://embed.signbsl.com/widgets.js';script.charset='utf-8';container.append(script);
 return container;
}
function stopPlayers(scope=content) {
 scope.querySelectorAll('video').forEach(v => {v.pause();v.removeAttribute('src');v.replaceChildren();v.load();});
}
function resetPractice() {practiceRows=null;practiceIndex=0;answerRevealed=false;practiceChoiceResult=null;ratings.clear();}
function groupKey(row) {return row.level==='2' ? row.topic : Number(row.lesson);}
function groupName(level,key) {
 if(level===2)return key;
 const lessonIndex=level===1 ? Number(key) : Number(key)-1;
 const emoji=level===3 ? `${level3LessonEmoji[lessonIndex]} ` : '';
 return `Lesson ${key}: ${emoji}${lessonsByLevel[level][lessonIndex]}`;
}
function resetMasterQuiz() {masterQuiz={rows:null,index:0,style:'choice',answers:[],requestedCount:10,notice:''};}
function shuffleRows(rows) {
 const shuffled=rows.slice();
 for(let i=shuffled.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 return shuffled;
}
function populateMasterQuizTopics() {
 const container=$('master-quiz-topics');container.replaceChildren();
 for(const level of [1,2,3]) {
  const fieldset=element('fieldset','master-level');
  fieldset.append(element('legend','',`Level ${level}`));
  const actions=element('div','master-level-actions');
  const selectAll=element('button','','Select all');selectAll.type='button';
  const clear=element('button','','Clear');clear.type='button';
  actions.append(selectAll,clear);fieldset.append(actions);
  lessonsByLevel[level].forEach((name,index)=>{
   const key=level===2 ? name : String(level===1 ? index : index+1);
   const matching=allVocabulary.filter(row=>row.level===String(level) && String(groupKey(row))===String(key));
   if(!matching.length)return;
   const playable=new Set(matching.filter(canPractice).map(row=>row.sign_id)).size;
   const label=element('label','master-topic');
   const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=`${level}|${key}`;
   label.append(checkbox,element('span','',`${level===2 ? name : groupName(level,key)} `),element('small','',`(${playable} signs)`));
   fieldset.append(label);
  });
  selectAll.addEventListener('click',()=>fieldset.querySelectorAll('.master-topic input').forEach(input=>{input.checked=true;}));
  clear.addEventListener('click',()=>fieldset.querySelectorAll('.master-topic input').forEach(input=>{input.checked=false;}));
  if(fieldset.querySelector('.master-topic'))container.append(fieldset);
 }
}
function chooseLevel(level) {
 currentLevel=level; $('level-nav').value=String(level); $('lesson-nav').replaceChildren();
 lessonsByLevel[level].forEach((name,i) => {
  const lessonNumber=level===1 ? i : i+1;
  const prefix=level===2 ? `${topicEmoji[name] || '📚'}  ` : level===1 ? (i===0 ? '🔤  ' : `${lessonEmoji[i-1]}  `) : `${level3LessonEmoji[i]}  `;
  const option=element('option','',level===2 ? `${prefix}${name}` : `${prefix}Lesson ${lessonNumber}: ${name}`);
  option.value=level===2 ? name : String(lessonNumber); $('lesson-nav').append(option);
 });
 $('level-summary').textContent=`Level ${level} · Vocabulary library · ${lessonsByLevel[level].length} ${level===2 ? 'topics' : 'lessons'}`;
 document.querySelector('label[for="lesson-nav"]').textContent=level===2 ? 'Choose topic' : 'Choose lesson';
 $('lesson-nav').setAttribute('aria-label',level===2 ? 'Choose topic' : 'Choose lesson');
 chooseLesson(level===1 ? 0 : level===2 ? lessonsByLevel[2][0] : 1);
}
function chooseLesson(lesson) {
 currentLesson=lesson;
 vocabulary=allVocabulary.filter(r => Number(r.level)===currentLevel && groupKey(r)===lesson);
 categories=[...new Set(vocabulary.map(r => r.category))]; $('lesson-nav').value=String(lesson);
 $('lesson-title').textContent=groupName(currentLevel,lesson);
 $('lesson-description').textContent=currentLevel===1 && currentLesson===0 ? 'Choose a section below. Left handed entries will be added as their videos are identified.' : currentLevel===2 ? 'Vocabulary grouped by topic. Entries awaiting video remain available in Dictionary.' : currentLevel===3 ? 'Full course vocabulary, grouped into lessons. Suggested videos are unverified.' : '';
 $('search').value=''; practiceCategory=''; resetPractice(); render();
}
function setStudyMode(mode) {
 if(studyMode===mode) return;
 const leavingMasterQuiz=studyMode==='master-quiz';
 if(leavingMasterQuiz && mode==='dictionary') {
  window.location.reload();
  return;
 }
 if(studyMode==='master-quiz')resetMasterQuiz();
 if(mode==='practice') {
  currentLevel=Number($('level-nav').value);
  currentLesson=currentLevel===2 ? $('lesson-nav').value : Number($('lesson-nav').value);
  practiceCategory='';
  $('search').value='';
  resetPractice();
 }
 studyMode=mode; answerRevealed=false;
 for(const name of ['dictionary','practice','master-quiz']) {
  $('study-'+name).classList.toggle('active',name===mode);
  $('study-'+name).setAttribute('aria-pressed',String(name===mode));
 }
 $('dictionary-controls').hidden=mode!=='dictionary';
 $('practice-controls').hidden=mode!=='practice';
 $('master-quiz-controls').hidden=mode!=='master-quiz';
 $('level-nav').closest('.level-picker').hidden=mode==='master-quiz';
 $('level-summary').hidden=mode==='master-quiz';
 $('lesson-nav').closest('.lesson-picker').hidden=mode==='master-quiz';
 $('intro').hidden=mode==='master-quiz';
 $('hide-details').closest('.check-control').hidden=mode==='master-quiz';
 $('category-nav').hidden=mode==='master-quiz';
 $('stats').hidden=mode==='master-quiz';
 if(mode!=='master-quiz')resetMasterQuiz();
 if(mode==='practice')chooseLesson(currentLesson);
 else render();
}
function setPlaybackMode(mode) {
 playbackMode=mode;
 for(const name of ['flashcard','autoplay']) {
  $('mode-'+name).classList.toggle('active',name===mode);
  $('mode-'+name).setAttribute('aria-pressed',String(name===mode));
 }
 $('mode-help').textContent=mode==='flashcard' ? 'Videos load only when you press Play.' : 'All visible videos try to play automatically, muted and looping. Browsers may limit simultaneous playback.';
 render();
}
function makeVideo(row,autoplay,hiddenAnswer,loadOnDemand=false) {
 const sequence=row.video_urls?.length>1 ? row.video_urls : null;
 if(!sequence) {const embed=makeSignBslEmbed(row,hiddenAnswer);if(embed)return embed;}
 const video=document.createElement('video');
 video.controls=true;video.playsInline=true;video.loop=true;video.muted=true;video.defaultMuted=true;
 if(sequence) video.loop=false;
 video.autoplay=autoplay;video.preload=autoplay ? 'auto' : loadOnDemand ? 'none' : 'metadata';
 video.setAttribute('aria-label',hiddenAnswer ? 'Practice sign video' : `Candidate sign video for ${row.word}`);
 video.src=sequence ? sequence[0] : row.video_url;
 if(sequence) {
  let clipIndex=0;
  video.addEventListener('ended',() => {
   clipIndex=(clipIndex+1)%sequence.length;
   video.src=sequence[clipIndex];video.load();video.play().catch(() => {});
  });
 }
 const showError=() => {if(video.isConnected) video.replaceWith(element('div','video-error','Video unavailable — try the dictionary link below.'));};
 video.addEventListener('error',showError);
 if(autoplay) video.addEventListener('canplay',() => {
  if((studyMode==='practice' || playbackMode==='autoplay') && video.isConnected) video.play().catch(() => {});
 },{once:true});
 return video;
}
function makeTile(row,practice=false) {
 const tile=element('article','tile');tile.dataset.entryId=row.entry_id;
 const choiceAnswered=practiceQuestionStyle==='choice' && practiceChoiceResult?.row.entry_id===row.entry_id;
 const hiddenAnswer=practice && (practiceQuestionStyle==='choice' ? !choiceAnswered : $('hide-english').checked && !answerRevealed);
 const titleRow=element('div','tile-heading');
 const title=element('h4','',hiddenAnswer ? 'What is this sign?' : row.word);
 const pages=row.source_pages || row.source_page;
 const pageLabel=row.level==='3' ? `PDF page${pages.includes(';') ? 's' : ''} ${pages}` : row.level==='1' && row.lesson==='0' ? 'Supplemental alphabet' : `Workbook page${pages.includes(';') ? 's' : ''} ${pages}`;
 const meta=element('small','entry-meta',`#${row.entry_id} · ${pageLabel}`);
 meta.hidden=$('hide-details').checked;titleRow.append(title,meta);
 const player=element('div','player');const autoplay=practice || playbackMode==='autoplay';
 if(!row.video_url) player.append(element('p','video-error','Awaiting video'));
 else if(autoplay) player.append(makeVideo(row,true,hiddenAnswer));
 else {
  const launch=element('button','flashcard-launch');launch.type='button';
  launch.setAttribute('aria-label',hiddenAnswer ? 'Play practice sign video' : `Play ${row.word} sign video`);
  const icon=element('span','play-icon','▶');icon.setAttribute('aria-hidden','true');
  launch.append(icon,element('span','','Play sign'));
  launch.addEventListener('click',() => {
   const video=makeVideo(row,false,practice && $('hide-english').checked && !answerRevealed);
   player.replaceChildren(video);if(video instanceof HTMLVideoElement) video.play().catch(() => {});
  },{once:true});player.append(launch);
 }
 const bottom=element('div','bottom');const videoStatus=element('span','',row.status);videoStatus.hidden=row.status==='Verified';bottom.append(videoStatus);
 if(row.status==='Verified' && row.video_id) {
  const report=element('button','report-problem','Feedback');report.type='button';
  report.addEventListener('click',() => openReportModal(row,report));bottom.append(report);
 }
 const dictionary=element('a','','Check dictionary ↗');
 dictionary.href=row.dictionary_url;
 dictionary.target='_blank';dictionary.rel='noopener noreferrer';dictionary.hidden=hiddenAnswer;bottom.append(dictionary);
 tile.append(titleRow,player);
 if(practice) {
  if(practiceQuestionStyle==='choice') {
   const prompt=element('p','practice-choice-prompt','Which word matches this sign?');
   const choices=element('div','practice-choice-options');
   const feedback=element('p','practice-choice-feedback','');feedback.setAttribute('aria-live','polite');
   const next=element('button','practice-choice-next',practiceIndex===practiceRows.length-1?'See score':'Next sign');next.type='button';next.hidden=!choiceAnswered;
   if(choiceAnswered) {
    const result=practiceChoiceResult;
    feedback.textContent=result.correct?`Correct — ${row.word}`:`Not quite — the answer is ${row.word}`;
    feedback.classList.toggle('incorrect',!result.correct);
   }
   for(const word of practiceChoiceWords(row)) {
    const option=element('button','practice-choice-option',word);option.type='button';
    if(choiceAnswered) {
     option.disabled=true;
     if(word===row.word)option.classList.add('correct');
     else if(word===practiceChoiceResult.selected)option.classList.add('incorrect');
    } else option.addEventListener('click',()=>answerPracticeChoice(row,word));
    choices.append(option);
   }
   next.addEventListener('click',advancePracticeChoice);
   tile.append(prompt,choices,feedback,next);
  } else {
   const reveal=element('button','answer-button');reveal.type='button';
   const answer=element('p','revealed-answer',row.word);answer.setAttribute('aria-live','polite');
   const confidence=element('fieldset','confidence');
   confidence.append(element('legend','','How did you do?'));
   const choices=element('div','confidence-choices');
   for(const [value,label] of [[0,'Not Yet'],[0.5,'Almost'],[1,'Got it']]) {
    const button=element('button','confidence-button',label);button.type='button';
    button.dataset.score=String(value);
    button.addEventListener('click',() => ratePractice(row,value),{once:true});choices.append(button);
   }
   confidence.append(choices);
   const updateAnswer=() => {
    const hidden=$('hide-english').checked && !answerRevealed;
    title.textContent=hidden ? 'What is this sign?' : row.word;dictionary.hidden=hidden;
    answer.hidden=hidden;confidence.hidden=hidden;
    reveal.hidden=!hidden;reveal.textContent='Reveal answer';
    reveal.setAttribute('aria-expanded',String(!hidden));
    player.querySelector('video')?.setAttribute('aria-label',hidden ? 'Practice sign video' : `Candidate sign video for ${row.word}`);
    player.querySelector('button')?.setAttribute('aria-label',hidden ? 'Play practice sign video' : `Play ${row.word} sign video`);
   };
   reveal.addEventListener('click',() => {answerRevealed=true;updateAnswer();});
   updateAnswer();tile.append(answer,reveal,confidence);
  }
 }
 tile.append(bottom);return tile;
}
function searchRows() {
 const q=$('search').value.toLowerCase().trim();return vocabulary.filter(r => r.word.toLowerCase().includes(q));
}
function categoryId(category) {return 'category-'+categories.indexOf(category);}
function renderCategories(rows) {
 const nav=$('category-nav');nav.replaceChildren();
 const addFilter=(label,value) => {
  const button=element('button',practiceCategory===value ? 'active' : '',label);button.type='button';
  button.setAttribute('aria-pressed',String(practiceCategory===value));
  button.addEventListener('click',() => {practiceCategory=value;resetPractice();render();});nav.append(button);
 };
 if(studyMode==='practice' && rows.length) addFilter('All categories','');
 for(const category of categories) {
  if(!rows.some(r => r.category===category)) continue;
  if(studyMode==='dictionary') {const a=element('a','',category);a.href='#'+categoryId(category);nav.append(a);}
  else addFilter(category,category);
 }
}
function startPractice(rows) {
 practiceRows=rows.filter(r => (!practiceCategory || r.category===practiceCategory) && canPractice(r));
 if($('random-order').checked) {
  // Fisher-Yates on a fresh array. Rendering and navigation never reshuffle.
  for(let i=practiceRows.length-1;i>0;i--) {const j=Math.floor(Math.random()*(i+1));[practiceRows[i],practiceRows[j]]=[practiceRows[j],practiceRows[i]];}
 }
 practiceIndex=0;answerRevealed=false;
}
function canPractice(row) {return !!row.video_url && !['Rejected','Unavailable'].includes(row.status);}
function practiceChoiceWords(row) {
 const wordKey=value=>value.trim().toLocaleLowerCase();
 const correctKey=wordKey(row.word), distractors=new Map();
 for(const candidate of [...shuffleRows(practiceRows || []),...shuffleRows(allVocabulary)]) {
  const key=wordKey(candidate.word);
  if(candidate.sign_id===row.sign_id || key===correctKey || distractors.has(key))continue;
  distractors.set(key,candidate.word);
  if(distractors.size===2)break;
 }
 return shuffleRows([row.word,...distractors.values()]);
}
function answerPracticeChoice(row,selected) {
 if(studyMode!=='practice' || practiceQuestionStyle!=='choice' || practiceRows?.[practiceIndex]?.entry_id!==row.entry_id || ratings.has(row.entry_id))return;
 const correct=selected===row.word;
 ratings.set(row.entry_id,correct?1:0);practiceChoiceResult={row,selected,correct};render();
}
function advancePracticeChoice() {
 if(!practiceChoiceResult)return;
 practiceIndex++;practiceChoiceResult=null;answerRevealed=false;render();
 content.querySelector('.practice-choice-option')?.focus({preventScroll:true});
}
function renderScore() {
 const panel=$('practice-score');panel.replaceChildren();panel.hidden=true;
 if(studyMode!=='practice' || !practiceRows?.length) return;
 const rated=practiceRows.filter(r => ratings.has(r.entry_id)).length;
 $('practice-progress').textContent=`${rated} of ${practiceRows.length} cards rated`;
 if(practiceIndex<practiceRows.length || rated!==practiceRows.length) return;
 panel.hidden=false;
 const label=groupName(currentLevel,currentLesson)+(practiceCategory ? ': '+practiceCategory : '');
 const heading=element('h3','',`Your Score for ${label}`);heading.tabIndex=-1;panel.append(heading);
 if(practiceQuestionStyle==='choice') {
  const correct=practiceRows.filter(row=>ratings.get(row.entry_id)===1).length;
  const percent=Math.round(correct/practiceRows.length*100);
  panel.append(element('p','practice-choice-score',`${correct} of ${practiceRows.length} correct · ${percent}%`));
 } else {
  const breakdown=element('dl','score-breakdown');
  for(const [value,label] of [[0,'Not Yet'],[0.5,'Almost'],[1,'Got it']]) {
   const count=practiceRows.filter(row => ratings.get(row.entry_id)===value).length;
   const percentage=Number((count/practiceRows.length*100).toFixed(1));
   const result=element('div','score-result');result.dataset.rating=String(value);
   result.append(element('dt','',label),element('dd','score-percentage',`${percentage}%`),element('dd','score-count',`${count} of ${practiceRows.length} ${practiceRows.length===1 ? 'card' : 'cards'}`));
   breakdown.append(result);
  }
  panel.append(breakdown);
 }
 const restart=element('button','answer-button','Restart practice');restart.type='button';
 restart.addEventListener('click',() => {ratings.clear();practiceIndex=0;answerRevealed=false;practiceChoiceResult=null;render();});panel.append(restart);
}
function renderOtherMatches(rows) {
 const panel=$('other-matches');panel.replaceChildren();panel.hidden=true;
 const q=$('search').value.toLowerCase().trim();
 if(!q || rows.length) return;
 const matches=allVocabulary.filter(r => r.word.toLowerCase().includes(q) && (Number(r.level)!==currentLevel || groupKey(r)!==currentLesson));
 if(!matches.length) return;
 panel.hidden=false;panel.append(element('p','','No match in this set. Found in:'));
 const groups=new Map();
 for(const row of matches) {
  const level=Number(row.level),key=groupKey(row),id=level+'|'+key;
  if(!groups.has(id)) groups.set(id,{level,key,count:0});groups.get(id).count++;
 }
 for(const {level,key,count} of groups.values()) {
  const button=element('button','search-destination',`Level ${level} · ${groupName(level,key)} (${count})`);button.type='button';
  button.addEventListener('click',() => {
   chooseLevel(level);chooseLesson(key);$('search').value=q;resetPractice();render();
  });panel.append(button);
 }
}
function startMasterQuiz() {
 const message=$('master-quiz-message');message.textContent='';message.className='master-quiz-message';
 const selected=new Set([...$('master-quiz-topics').querySelectorAll('input:checked')].map(input=>input.value));
 if(!selected.size){message.textContent='Select at least one lesson or topic.';return;}
 const requested=Number($('master-quiz-count').value);
 if(!Number.isInteger(requested)||requested<1||requested>999){message.textContent='Enter a question count between 1 and 999.';return;}
 const bySign=new Map();
 for(const row of allVocabulary) {
  if(!selected.has(`${row.level}|${groupKey(row)}`)||!canPractice(row)||bySign.has(row.sign_id))continue;
  bySign.set(row.sign_id,row);
 }
 const candidates=[...bySign.values()];
 if(!candidates.length){message.textContent='The selected lessons have no entries with an available video.';return;}
 const style=document.querySelector('input[name="master-quiz-style"]:checked')?.value || 'choice';
 const rows=shuffleRows(candidates).slice(0,Math.min(requested,candidates.length));
 const notice=rows.length<requested?`You asked for ${requested} questions, but only ${rows.length} playable signs are available. Each will be used once.`:'';
 masterQuiz={rows,index:0,style,answers:[],requestedCount:requested,optionPool:candidates,notice};
 if(notice)message.textContent=notice;
 $('master-quiz-controls').hidden=true;render();
}
function masterChoiceWords(row) {
 const wordKey=value=>value.trim().toLocaleLowerCase();
 const correctKey=wordKey(row.word);
 const distractors=new Map();
 for(const candidate of [...shuffleRows(masterQuiz.optionPool),...shuffleRows(allVocabulary)]) {
  const key=wordKey(candidate.word);
  if(candidate.sign_id===row.sign_id||key===correctKey||distractors.has(key))continue;
  distractors.set(key,candidate.word);
  if(distractors.size===2)break;
 }
 return shuffleRows([row.word,...distractors.values()]);
}
function advanceMasterQuiz() {masterQuiz.index++;render();}
function renderMasterQuestion() {
 const row=masterQuiz.rows[masterQuiz.index];
 const stage=element('section','master-quiz-stage');
 stage.append(element('h2','','Master Quiz'),element('p','master-progress',`Question ${masterQuiz.index+1} of ${masterQuiz.rows.length}`));
 if(masterQuiz.index===0&&masterQuiz.notice)stage.append(element('p','master-quiz-notice',masterQuiz.notice));
 const card=element('article','master-sign-player');const player=element('div','player');player.append(makeVideo(row,true,true));card.append(player);stage.append(card);
 if(masterQuiz.style==='choice') {
  stage.append(element('p','master-question','Which word matches this sign?'));
  const choices=element('div','master-options');
  const feedback=element('p','master-feedback','');feedback.setAttribute('aria-live','polite');
  const next=element('button','master-next',masterQuiz.index===masterQuiz.rows.length-1?'See results':'Next sign');next.type='button';next.hidden=true;
  next.addEventListener('click',advanceMasterQuiz);
  for(const word of masterChoiceWords(row)) {
   const option=element('button','master-option',word);option.type='button';
   option.addEventListener('click',()=>{
    if(masterQuiz.answers[masterQuiz.index])return;
    const correct=word===row.word;
    masterQuiz.answers[masterQuiz.index]={row,score:correct?1:0,correct};
    for(const button of choices.querySelectorAll('button')) {
     button.disabled=true;
     if(button.textContent===row.word)button.classList.add('correct');
     else if(button===option&&!correct)button.classList.add('incorrect');
    }
    feedback.textContent=correct?`Correct — ${row.word}`:`Not quite — the answer is ${row.word}`;
    feedback.classList.toggle('incorrect',!correct);next.hidden=false;next.focus();
   });
   choices.append(option);
  }
  stage.append(choices,feedback,next);
 } else {
  stage.append(element('p','master-question','Watch the sign, then reveal the answer when you are ready.'));
  const reveal=element('button','master-reveal','Reveal answer');reveal.type='button';
  const answer=element('p','master-answer','');answer.hidden=true;
  const rates=element('div','master-confidence');rates.hidden=true;
  reveal.addEventListener('click',()=>{answer.textContent=row.word;answer.hidden=false;rates.hidden=false;reveal.hidden=true;rates.querySelector('button')?.focus();});
  for(const [score,label] of [[0,'Not Yet'],[0.5,'Almost'],[1,'Got it']]) {
   const rate=element('button','',label);rate.type='button';
   rate.addEventListener('click',()=>{masterQuiz.answers[masterQuiz.index]={row,score,correct:score===1};advanceMasterQuiz();});
   rates.append(rate);
  }
  stage.append(reveal,answer,rates);
 }
 content.append(stage);
}
function renderMasterResults() {
 const results=element('section','master-quiz-results');results.append(element('h2','','Quiz complete'));
 const answers=masterQuiz.answers;
 const achieved=answers.reduce((total,answer)=>total+answer.score,0);
 const percent=answers.length?Math.round(achieved/answers.length*100):0;
 results.append(element('p','master-score',`${percent}%`));
 results.append(element('p','',masterQuiz.style==='choice'
  ? `${answers.filter(answer=>answer.correct).length} of ${answers.length} correct`
  : `Self-rated score across ${answers.length} signs · Got it = 1, Almost = 0.5, Not Yet = 0`));
 const missed=answers.filter(answer=>answer.score<1);
 results.append(element('h3','',missed.length?'Signs to review':'All signs marked Got it'));
 if(missed.length) {
  const list=element('div','master-review-list');
  for(const {row,score} of missed) {
   const item=element('article','master-review-card');
   item.append(element('h4','',row.word));
   item.append(element('p','master-review-rating',masterQuiz.style==='choice'?(score?'Correct':'Missed'):score===0?'Not Yet':'Almost'));
   const player=element('div','player');player.append(makeVideo(row,false,false,true));item.append(player);
   const link=element('a','master-review-dictionary','Open dictionary ↗');link.href=row.dictionary_url;link.target='_blank';link.rel='noopener noreferrer';item.append(link);
   list.append(item);
  }
  results.append(list);
 }
 const change=element('button','master-change-settings','Choose lessons and start another quiz');change.type='button';
 change.addEventListener('click',()=>{resetMasterQuiz();$('master-quiz-message').textContent='';$('master-quiz-controls').hidden=false;render();});
 results.append(change);content.append(results);
}
function render() {
 stopPlayers();content.replaceChildren();const rows=searchRows();
 $('practice-position').hidden=true;
 $('practice-progress').textContent='';
 if(studyMode==='master-quiz') {
  $('category-nav').hidden=true;$('stats').hidden=true;$('other-matches').hidden=true;
  $('practice-score').hidden=true;
  $('master-quiz-controls').hidden=masterQuiz.rows!==null;
  content.hidden=masterQuiz.rows===null;
  if(masterQuiz.rows!==null&&masterQuiz.index>=masterQuiz.rows.length)renderMasterResults();
  else if(masterQuiz.rows!==null)renderMasterQuestion();
  return;
 }
 content.hidden=false;
 $('category-nav').hidden=false;$('stats').hidden=false;
 renderCategories(rows);
 if(studyMode==='practice') {
  if(practiceRows===null) startPractice(rows);
  const excluded=rows.filter(r => (!practiceCategory || r.category===practiceCategory) && !canPractice(r)).length;
  $('stats').textContent=`${practiceRows.length} practice ${practiceRows.length===1 ? 'card' : 'cards'}${excluded ? ` · ${excluded} entries without an available video excluded` : ''}`;
  if(practiceRows.length && practiceIndex<practiceRows.length) {
   const stage=element('div','practice-stage');stage.append(makeTile(practiceRows[practiceIndex],true));content.append(stage);
   $('practice-position').hidden=false;$('practice-position').textContent=`Card ${practiceIndex+1} of ${practiceRows.length}`;
  }
 } else {
  $('stats').textContent=`${rows.length} of ${vocabulary.length} vocabulary entries`;
  for(const category of categories) {
   const matching=rows.filter(r => r.category===category);if(!matching.length) continue;
   const section=element('section','group');section.id=categoryId(category);section.append(element('h3','',category));
   const grid=element('div','grid');matching.forEach(r => grid.append(makeTile(r)));section.append(grid);content.append(section);
  }
 }
 const finished=studyMode==='practice' && practiceRows?.length && practiceIndex>=practiceRows.length;
 if(!content.children.length && !finished) {
  const message=!vocabulary.length ? 'No vocabulary entries are provided for this lesson in the current dataset.'
   : studyMode==='practice' && rows.length ? 'No practice videos available in this set yet. View these entries in Dictionary.'
   : 'No signs found in this set. Try a different search or category.';
  content.append(element('p','empty',message));
 }
 renderOtherMatches(rows);renderScore();
}
function ratePractice(row,value) {
 if(studyMode!=='practice' || practiceRows?.[practiceIndex]?.entry_id!==row.entry_id || ratings.has(row.entry_id)) return;
 ratings.set(row.entry_id,value);practiceIndex++;answerRevealed=false;render();
 const focusTarget=content.querySelector('.answer-button:not([hidden]),.confidence-button') || $('practice-score').querySelector('h3');
 focusTarget?.focus({preventScroll:true});
}
$('level-nav').addEventListener('change',() => chooseLevel(Number($('level-nav').value)));
$('lesson-nav').addEventListener('change',() => chooseLesson(currentLevel===2 ? $('lesson-nav').value : Number($('lesson-nav').value)));
$('search').addEventListener('input',() => {practiceCategory='';resetPractice();render();});
$('study-dictionary').addEventListener('click',() => setStudyMode('dictionary'));
$('study-practice').addEventListener('click',() => setStudyMode('practice'));
$('study-master-quiz').addEventListener('click',() => setStudyMode('master-quiz'));
$('master-quiz-start').addEventListener('click',startMasterQuiz);
$('mode-flashcard').addEventListener('click',() => setPlaybackMode('flashcard'));
$('mode-autoplay').addEventListener('click',() => setPlaybackMode('autoplay'));
$('random-order').addEventListener('change',() => {resetPractice();render();});
$('practice-controls').querySelectorAll('input[name="practice-question-style"]').forEach(input=>input.addEventListener('change',()=>{
 practiceQuestionStyle=input.value;
 $('practice-mode-help').textContent=practiceQuestionStyle==='choice'
  ? 'Choose the matching word. Your answer is shown before you move to the next sign.'
  : 'Watch the sign, reveal the answer, then choose Not Yet, Almost or Got it to move to the next card.';
 resetPractice();if(studyMode==='practice')render();
}));
$('hide-english').addEventListener('change',() => {answerRevealed=false;render();});
$('hide-details').addEventListener('change',() => {document.querySelectorAll('.entry-meta').forEach(meta => {meta.hidden=$('hide-details').checked;});});
// Reset restored browser form values on each page load.
$('hide-details').checked=true;$('random-order').checked=true;$('hide-english').checked=true;
populateMasterQuizTopics();
chooseLevel(1);
