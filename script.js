// Three CSV masters; never shuffle their records in place.
'use strict';
const $ = id => document.getElementById(id);
const data = window.BSL_DATA;
if (!data) throw new Error('Missing generated data. Run tools/generate_data.py.');
const signsById = new Map(data.signs.map(s => [s.sign_id,s]));
const videosById = new Map(data.videos.map(v => [v.video_id,v]));
const allVocabulary = data.lesson_vocabulary.map(r => ({...r, meaning:signsById.get(r.sign_id).meaning,
 dictionary_url:videosById.get(r.selected_video_id)?.source.match(/https:\/\/www\.signbsl\.com\/[^\s]+/)?.[0] || `https://www.signbsl.com/sign/${encodeURIComponent(r.word.toLowerCase())}`,
 video_url:videosById.get(r.selected_video_id)?.url || '', status:videosById.get(r.selected_video_id)?.verification_status || 'Awaiting video'
})).sort((a,b) => Number(a.global_order)-Number(b.global_order));
const lessonsByLevel = {
 1:['Alphabet & Greetings','Numbers & Everyday Living','Weather & Feelings','Days & Months','Sentence Structure & Gesturing','Pets, Colours & Placement','Transport & Directions','Family','Descriptions & Clothes','Recap','Food & Drink','Home & Hobbies','People, Animals & Objects','Final Recap & Conversations'],
 2:[...new Set(allVocabulary.filter(r => r.level==='2').map(r => r.topic))]
};
const lessonEmoji = ['👋','🔢','🌦️','📅','💬','🐾','🚌','👨‍👩‍👧‍👦','👕','🔄','🍽️','🏠','🧑‍🤝‍🧑','🎓'];
let currentLevel=1, currentLesson=1, vocabulary=[], categories=[];
let studyMode='dictionary', playbackMode='flashcard';
let practiceCategory='', practiceRows=null, practiceIndex=0, answerRevealed=false;
let ratings=new Map();
const content=$('content');
function element(tag,cls,text) {
 const node=document.createElement(tag); if(cls) node.className=cls;
 if(text !== undefined) node.textContent=text; return node;
}
function stopPlayers(scope=content) {
 scope.querySelectorAll('video').forEach(v => {v.pause();v.removeAttribute('src');v.replaceChildren();v.load();});
}
function resetPractice() {practiceRows=null;practiceIndex=0;answerRevealed=false;ratings.clear();}
function groupKey(row) {return row.level==='1' ? Number(row.lesson) : row.topic;}
function groupName(level,key) {return level===1 ? `Lesson ${key}: ${lessonsByLevel[1][Number(key)-1]}` : key;}
function chooseLevel(level) {
 currentLevel=level; $('level-nav').value=String(level); $('lesson-nav').replaceChildren();
 lessonsByLevel[level].forEach((name,i) => {
  const prefix=level===1 ? `${lessonEmoji[i]}  ` : '';
  const option=element('option','',level===1 ? `${prefix}Lesson ${i+1}: ${name}` : name);
  option.value=level===1 ? String(i+1) : name; $('lesson-nav').append(option);
 });
 $('level-summary').textContent=`Level ${level} · Vocabulary library · ${lessonsByLevel[level].length} ${level===1 ? 'lessons' : 'topics'}`;
 document.querySelector('label[for="lesson-nav"]').textContent=level===1 ? 'Choose lesson' : 'Choose topic';
 $('lesson-nav').setAttribute('aria-label',level===1 ? 'Choose lesson' : 'Choose topic');
 chooseLesson(level===1 ? 1 : lessonsByLevel[2][0]);
}
function chooseLesson(lesson) {
 currentLesson=lesson;
 vocabulary=allVocabulary.filter(r => Number(r.level)===currentLevel && groupKey(r)===lesson);
 categories=[...new Set(vocabulary.map(r => r.category))]; $('lesson-nav').value=String(lesson);
 $('lesson-title').textContent=groupName(currentLevel,lesson);
 $('lesson-description').textContent=currentLevel===2 ? 'Vocabulary grouped by topic. Entries awaiting video remain available in Dictionary.' : '';
 $('search').value=''; practiceCategory=''; resetPractice(); render();
}
function setStudyMode(mode) {
 if(studyMode===mode) return;
 studyMode=mode; answerRevealed=false;
 for(const name of ['dictionary','practice']) {
  $('study-'+name).classList.toggle('active',name===mode);
  $('study-'+name).setAttribute('aria-pressed',String(name===mode));
 }
 $('dictionary-controls').hidden=mode!=='dictionary'; $('practice-controls').hidden=mode!=='practice'; render();
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
function makeVideo(row,autoplay,hiddenAnswer) {
 const video=document.createElement('video');
 video.controls=true;video.playsInline=true;video.loop=true;video.muted=true;video.defaultMuted=true;
 video.autoplay=autoplay;video.preload=autoplay ? 'auto' : 'metadata';
 video.setAttribute('aria-label',hiddenAnswer ? 'Practice sign video' : `Candidate sign video for ${row.word}`);
 const source=document.createElement('source'); source.src=row.video_url;source.type='video/mp4';video.append(source);
 const showError=() => {if(video.isConnected) video.replaceWith(element('div','video-error','Video unavailable — try the dictionary link below.'));};
 video.addEventListener('error',showError);source.addEventListener('error',showError);
 if(autoplay) video.addEventListener('canplay',() => {
  if(studyMode==='dictionary' && playbackMode==='autoplay' && video.isConnected) video.play().catch(() => {});
 },{once:true});
 return video;
}
function makeTile(row,practice=false) {
 const tile=element('article','tile');tile.dataset.entryId=row.entry_id;
 const hiddenAnswer=practice && $('hide-english').checked && !answerRevealed;
 const titleRow=element('div','tile-heading');
 const title=element('h4','',hiddenAnswer ? 'What is this sign?' : row.word);
 const pages=row.source_pages || row.source_page;
 const meta=element('small','entry-meta',`#${row.entry_id} · Workbook page${pages.includes(';') ? 's' : ''} ${pages}`);
 meta.hidden=!$('show-details').checked;titleRow.append(title,meta);
 const player=element('div','player');const autoplay=!practice && playbackMode==='autoplay';
 if(!row.video_url) player.append(element('p','video-error','Awaiting video'));
 else if(autoplay) player.append(makeVideo(row,true,false));
 else {
  const launch=element('button','flashcard-launch');launch.type='button';
  launch.setAttribute('aria-label',hiddenAnswer ? 'Play practice sign video' : `Play ${row.word} sign video`);
  const icon=element('span','play-icon','▶');icon.setAttribute('aria-hidden','true');
  launch.append(icon,element('span','','Play sign'));
  launch.addEventListener('click',() => {
   const video=makeVideo(row,false,practice && $('hide-english').checked && !answerRevealed);
   player.replaceChildren(video);video.play().catch(() => {});
  },{once:true});player.append(launch);
 }
 const bottom=element('div','bottom');bottom.append(element('span','',row.status));
 const dictionary=element('a','','Check dictionary ↗');
 dictionary.href=row.dictionary_url;
 dictionary.target='_blank';dictionary.rel='noopener noreferrer';dictionary.hidden=hiddenAnswer;bottom.append(dictionary);
 tile.append(titleRow,player);
 if(practice) {
  const reveal=element('button','answer-button');reveal.type='button';
  const answer=element('p','revealed-answer',row.word);answer.setAttribute('aria-live','polite');
  const confidence=element('fieldset','confidence');
  confidence.append(element('legend','','How did you do?'));
  const choices=element('div','confidence-choices');
  for(const [value,label] of [[0,'Not yet'],[0.5,'Almost'],[1,'Got it']]) {
   const button=element('button','confidence-button',label);button.type='button';
   button.dataset.score=String(value);
   button.addEventListener('click',() => {
    ratings.set(row.entry_id,value);updateRatings();renderScore();
   });choices.append(button);
  }
  confidence.append(choices);
  const updateRatings=() => {
   choices.querySelectorAll('button').forEach(button => {
    const selected=ratings.get(row.entry_id)===Number(button.dataset.score);
    button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
   });
  };
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
  updateRatings();updateAnswer();tile.append(answer,reveal,confidence);
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
function renderScore() {
 const panel=$('practice-score');panel.replaceChildren();panel.hidden=true;
 if(studyMode!=='practice' || !practiceRows?.length) return;
 const rated=practiceRows.filter(r => ratings.has(r.entry_id)).length;
 $('practice-progress').textContent=`${rated} of ${practiceRows.length} cards rated`;
 if(practiceIndex!==practiceRows.length-1) return;
 panel.hidden=false;
 if(rated===practiceRows.length) {
  const total=practiceRows.reduce((sum,row) => sum+ratings.get(row.entry_id),0);
  panel.append(element('h3','',`Your score: ${total} / ${practiceRows.length} (${Math.round(total/practiceRows.length*100)}%)`));
  panel.append(element('p','','Not yet = 0 · Almost = ½ · Got it = 1. This is your confidence score.'));
 } else {
  panel.append(element('h3','','Finish rating your cards'));
  panel.append(element('p','',`${practiceRows.length-rated} card${practiceRows.length-rated===1 ? '' : 's'} still need a rating before your score is ready.`));
  const missing=element('button','answer-button','Go to next unrated card');missing.type='button';
  missing.addEventListener('click',() => {
   practiceIndex=practiceRows.findIndex(r => !ratings.has(r.entry_id));answerRevealed=false;render();
  });panel.append(missing);
 }
 const restart=element('button','answer-button','Restart practice');restart.type='button';
 restart.addEventListener('click',() => {ratings.clear();practiceIndex=0;answerRevealed=false;render();});panel.append(restart);
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
function render() {
 stopPlayers();content.replaceChildren();const rows=searchRows();renderCategories(rows);
 $('practice-navigation').hidden=true;
 $('practice-progress').textContent='';
 if(studyMode==='practice') {
  if(practiceRows===null) startPractice(rows);
  const excluded=rows.filter(r => (!practiceCategory || r.category===practiceCategory) && !canPractice(r)).length;
  $('stats').textContent=`${practiceRows.length} practice cards${excluded ? ` · ${excluded} entries without an available video excluded` : ''}`;
  if(practiceRows.length) {
   const stage=element('div','practice-stage');stage.append(makeTile(practiceRows[practiceIndex],true));content.append(stage);
   $('practice-navigation').hidden=false;$('practice-position').textContent=`Card ${practiceIndex+1} of ${practiceRows.length}`;
   $('practice-prev').disabled=practiceIndex===0;$('practice-next').disabled=practiceIndex===practiceRows.length-1;
  }
 } else {
  $('stats').textContent=`${rows.length} of ${vocabulary.length} vocabulary entries`;
  for(const category of categories) {
   const matching=rows.filter(r => r.category===category);if(!matching.length) continue;
   const section=element('section','group');section.id=categoryId(category);section.append(element('h3','',category));
   const grid=element('div','grid');matching.forEach(r => grid.append(makeTile(r)));section.append(grid);content.append(section);
  }
 }
 if(!content.children.length) {
  const message=!vocabulary.length ? 'No vocabulary entries are provided for this lesson in the current dataset.'
   : studyMode==='practice' && rows.length ? 'No practice videos available in this set yet. View these entries in Dictionary.'
   : 'No signs found in this set. Try a different search or category.';
  content.append(element('p','empty',message));
 }
 renderOtherMatches(rows);renderScore();
}
function movePractice(delta) {
 const next=practiceIndex+delta;if(!practiceRows || next<0 || next>=practiceRows.length) return;
 practiceIndex=next;answerRevealed=false;render();
}
$('level-nav').addEventListener('change',() => chooseLevel(Number($('level-nav').value)));
$('lesson-nav').addEventListener('change',() => chooseLesson(currentLevel===1 ? Number($('lesson-nav').value) : $('lesson-nav').value));
$('search').addEventListener('input',() => {practiceCategory='';resetPractice();render();});
$('study-dictionary').addEventListener('click',() => setStudyMode('dictionary'));
$('study-practice').addEventListener('click',() => setStudyMode('practice'));
$('mode-flashcard').addEventListener('click',() => setPlaybackMode('flashcard'));
$('mode-autoplay').addEventListener('click',() => setPlaybackMode('autoplay'));
$('random-order').addEventListener('change',() => {resetPractice();render();});
$('hide-english').addEventListener('change',() => {answerRevealed=false;render();});
$('show-details').addEventListener('change',() => {document.querySelectorAll('.entry-meta').forEach(meta => {meta.hidden=!$('show-details').checked;});});
$('practice-prev').addEventListener('click',() => movePractice(-1));$('practice-next').addEventListener('click',() => movePractice(1));
// Reset restored browser form values on each page load.
$('show-details').checked=true;$('random-order').checked=true;$('hide-english').checked=true;
chooseLevel(1);
