// Data generated from data/vocabulary.csv. Edit CSV then run tools/generate_data.py.
const content = document.getElementById('content');
const stats = document.getElementById('stats');
const categoryNav = document.getElementById('category-nav');
const allVocabulary = (window.BSL_VOCABULARY || []).sort((a,b) => Number(a.global_order)-Number(b.global_order));
const lessons = ['Alphabet & Greetings','Numbers & Everyday Living','Weather & Feelings','Days & Months','Sentence Structure & Gesturing','Pets, Colours & Placement','Transport & Directions','Family','Descriptions & Clothes','Recap','Food & Drink','Home & Hobbies','People, Animals & Objects','Final Recap & Conversations'];
let currentLesson = 1;
let vocabulary = [];
let categories = [];
const lessonNav = document.getElementById('lesson-nav');
function chooseLesson(n) {
 currentLesson = n;
 vocabulary = allVocabulary.filter(r => Number(r.lesson) === n);
 categories = [...new Set(vocabulary.map(r => r.category))];
 document.getElementById('lesson-title').textContent = `Lesson ${n}: ${lessons[n-1]}`;
 document.getElementById('lesson-description').textContent = '';
 document.getElementById('search').value = '';
 lessonNav.value = String(n);
 render();
}
const lessonEmoji = ['👋','🔢','🌦️','📅','💬','🐾','🚌','👨‍👩‍👧‍👦','👕','🔄','🍽️','🏠','🧑‍🤝‍🧑','🎓'];
lessons.forEach((name,i) => {const option=document.createElement('option');option.value=String(i+1);option.textContent=`${lessonEmoji[i]}  Lesson ${i+1}: ${name}`;lessonNav.append(option);});
lessonNav.addEventListener('change', () => chooseLesson(Number(lessonNav.value)));
let playbackMode = 'flashcard'; // Always start in flashcard mode on page load.
const flashButton = document.getElementById('mode-flashcard');
const autoButton = document.getElementById('mode-autoplay');
const modeHelp = document.getElementById('mode-help');
function setMode(mode) {
 playbackMode = mode;
 flashButton.classList.toggle('active', mode === 'flashcard');
 autoButton.classList.toggle('active', mode === 'autoplay');
 flashButton.setAttribute('aria-pressed', String(mode === 'flashcard'));
 autoButton.setAttribute('aria-pressed', String(mode === 'autoplay'));
 modeHelp.textContent = mode === 'flashcard'
  ? 'Videos load only when you press Play.'
  : 'All visible videos try to play automatically, muted and looping. Browsers may limit simultaneous playback.';
 // Rebuild players, stopping any previously playing videos.
 document.querySelectorAll('video').forEach(v => {v.pause(); v.removeAttribute('src'); v.replaceChildren(); v.load();});
 render();
}
function makeVideo(row, autoplay) {
 const video = document.createElement('video');
 video.controls = true;
 video.playsInline = true;
 video.loop = autoplay;
 video.muted = true; // Silent signing videos in both modes; required for autoplay.
 video.defaultMuted = true;
 video.autoplay = autoplay;
 video.preload = autoplay ? 'auto' : 'metadata';
 video.setAttribute('aria-label', `Candidate sign video for ${row.word}`);
 const source = document.createElement('source'); source.src = row.video_url; source.type = 'video/mp4';
 video.append(source);
 video.addEventListener('error', () => { const msg=document.createElement('div'); msg.className='video-error'; msg.textContent='Video unavailable — try the dictionary link below.'; video.replaceWith(msg); });
 if (autoplay) {
  video.addEventListener('canplay', () => {if (playbackMode === 'autoplay' && video.isConnected && video.paused) video.play().catch(() => {});}, {once:true});
 }
 return video;
}
const extraVideos = []; // Additional variants disabled for the initial release.
function videosFor(row) {
 const extras = extraVideos.filter(v => String(v.entry_id) === String(row.entry_id))
  .sort((a,b) => Number(a.variant_order) - Number(b.variant_order))
  .filter(v => v.video_url);
 // Existing CSV URL is the default first video; alternatives are separate rows.
 return [...(row.video_url ? [{video_url:row.video_url, source:'Default video'}] : []), ...extras];
}

function categoryId(category) { return 'category-' + categories.indexOf(category); }
function renderCategoryNav(q) {
 categoryNav.replaceChildren();
 for (const category of categories) {
  const hasMatches = vocabulary.some(r => r.category === category && r.word.toLowerCase().includes(q));
  if (!hasMatches) continue;
  const a = document.createElement('a');
  a.href = '#' + categoryId(category);
  a.textContent = category;
  categoryNav.append(a);
 }
}
function render() {
 const q = document.getElementById('search').value.toLowerCase().trim();
 document.querySelectorAll('#content video').forEach(v => { v.pause(); v.removeAttribute('src'); v.replaceChildren(); v.load(); });
 content.replaceChildren(); renderCategoryNav(q); let count = 0;
 for (const category of categories) {
  const matching = vocabulary.filter(r => r.category === category && r.word.toLowerCase().includes(q));
  if (!matching.length) continue;
  count += matching.length;
  const section = document.createElement('section'); section.className = 'group'; section.id = categoryId(category);
  const heading = document.createElement('h3'); heading.textContent = category; section.append(heading);
  const grid = document.createElement('div'); grid.className = 'grid';
  for (const r of matching) {
   const tile = document.createElement('article'); tile.className = 'tile';
   const title = document.createElement('h4'); title.textContent = r.word;
   const meta = document.createElement('small'); meta.textContent = `#${r.global_order} · Workbook page ${r.source_page}`;
   const titleRow = document.createElement('div'); titleRow.className = 'tile-heading'; titleRow.append(title,meta);
   const player = document.createElement('div'); player.className = 'player';
   const variants = videosFor(r);
   let currentVariant = 0;
   const carousel = document.createElement('div'); carousel.className = 'video-carousel';
   const showVariant = () => {
    player.querySelectorAll('video').forEach(v => {v.pause(); v.removeAttribute('src'); v.replaceChildren(); v.load();});
    player.replaceChildren();
    const selected = variants[currentVariant];
    if (!selected) {player.textContent = 'No video selected'; return;}
    const selectedRow = {...r, video_url:selected.video_url};
    if (playbackMode === 'autoplay') {
     const video = makeVideo(selectedRow, true); player.append(video);
     video.play().catch(() => {});
    } else {
     const launch = document.createElement('button'); launch.type = 'button';
     launch.className = 'flashcard-launch'; launch.setAttribute('aria-label', `Play ${r.word} sign video`);
     launch.innerHTML = '<span class="play-icon" aria-hidden="true">▶</span><span>Play sign</span>';
     launch.addEventListener('click', () => {
      const video = makeVideo(selectedRow, false); video.loop = true;
      player.replaceChildren(video); video.play().catch(() => {});
     }, {once:true});
     player.append(launch);
    }
    if (variants.length > 1) {
     counter.textContent = `${currentVariant+1} / ${variants.length} · ${selected.source || 'Alternative video'}`;
    }
   };
   let counter;
   if (variants.length > 1) {
    const previous = document.createElement('button'); previous.type='button'; previous.className='carousel-arrow';
    previous.textContent='‹'; previous.setAttribute('aria-label', `Previous ${r.word} video`);
    const next = document.createElement('button'); next.type='button'; next.className='carousel-arrow';
    next.textContent='›'; next.setAttribute('aria-label', `Next ${r.word} video`);
    counter = document.createElement('span'); counter.className='carousel-counter'; counter.setAttribute('aria-live','polite');
    previous.addEventListener('click', () => {currentVariant=(currentVariant-1+variants.length)%variants.length; showVariant();});
    next.addEventListener('click', () => {currentVariant=(currentVariant+1)%variants.length; showVariant();});
    carousel.append(previous,counter,next);
   }
   if (variants.length) {
    showVariant();
   } else {player.textContent = 'No video selected';}
   const playerWrap = document.createElement('div'); playerWrap.className='player-wrap'; playerWrap.append(player);
   if (variants.length > 1) playerWrap.append(carousel);
   const bottom = document.createElement('div'); bottom.className = 'bottom';
   const status = document.createElement('span'); status.textContent = r.status || 'Unverified';
   const link = document.createElement('a'); link.href = `https://www.signbsl.com/sign/${encodeURIComponent(r.word.toLowerCase())}`;
   link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Check dictionary ↗';
   bottom.append(status,link); tile.append(titleRow,playerWrap,bottom); grid.append(tile);
  }
  section.append(grid); content.append(section);
 }
 stats.textContent = `${count} of ${vocabulary.length} vocabulary entries`;
 if (!count) {const p = document.createElement('p'); p.className='empty'; p.textContent='No signs found. Try a different search.'; content.append(p);}
}
document.getElementById('search').addEventListener('input',render);
flashButton.addEventListener('click', () => setMode('flashcard'));
autoButton.addEventListener('click', () => setMode('autoplay'));
chooseLesson(1);
