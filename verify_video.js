(() => {
  const $ = selector => document.querySelector(selector);
  let data = window.BSL_DATA;
  const work = $('#work');
  const message = $('#message');
  let mode = 'unverified';
  let cursor = 0;
  let query = '';
  let levelFilter = 'all';
  let lessonFilter = 'all';

  const selected = entry => data.videos.find(video => video.video_id === entry.selected_video_id);
  const wordParts = word => Array.from(word.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu), match => match[0]);
  const sequenceFor = signId => (data.video_sequences || [])
    .filter(clip => clip.sign_id === signId)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const sequenceForWord = word => {
    const signIds = new Set(data.lesson_vocabulary.filter(entry => entry.word === word).map(entry => entry.sign_id));
    return (data.video_sequences || []).filter(clip => signIds.has(clip.sign_id));
  };
  const unresolved = () => data.lesson_vocabulary.filter(entry => {
    const video = selected(entry);
    return video && video.verification_status === 'Unverified';
  });
  const level3LessonNames = ['Home Life','Technology','Health and Wellbeing','Consumer Issues',
    'Social Recreation','Education and Training','Employment','Deaf History'];
  const level3LessonEmoji = ['🏠','💻','🏥','🛒','🎭','🎓','💼','🤟'];
  const lessonKey = entry => entry.level === '2'
    ? `2:topic:${entry.topic}` : `${entry.level}:lesson:${entry.lesson}`;
  const lessonName = entry => entry.level === '2' ? entry.topic : entry.level === '3'
    ? `Lesson ${entry.lesson}: ${level3LessonEmoji[Number(entry.lesson)-1]} ${level3LessonNames[Number(entry.lesson)-1]}` : `Lesson ${entry.lesson}`;
  const awaiting = () => data.lesson_vocabulary.filter(entry => !selected(entry));
  const isDirectMp4 = value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.pathname.toLowerCase().endsWith('.mp4');
    } catch {
      return false;
    }
  };
  const button = (label, handler, className = 'action') => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.textContent = label;
    element.addEventListener('click', handler);
    return element;
  };
  function status(text, className = '') {
    message.textContent = text;
    message.className = `status ${className}`;
  }
  function signBslVideo(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const id = decodeURIComponent(parsed.hash.slice(1));
      if (!['signbsl.com', 'www.signbsl.com'].includes(host)
          || !/^\/sign\/[^/]+$/.test(parsed.pathname)
          || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
      return {page: `${parsed.origin}${parsed.pathname}`, id};
    } catch {
      return null;
    }
  }
  function mountSignBslEmbed(url, word, parent) {
    const info = signBslVideo(url);
    if (!info) return false;
    const quote = document.createElement('blockquote');
    quote.className = 'signbsldata-embed';
    quote.dataset.vidref = info.id;
    const link = document.createElement('a');
    link.href = info.page;
    link.textContent = `Watch how to sign '${word}' in British Sign Language`;
    quote.append(link);
    parent.replaceChildren(quote);
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://embed.signbsl.com/widgets.js';
    script.charset = 'utf-8';
    parent.append(script);
    return true;
  }
  function previewSequence(urls, parent, autoplay = false) {
    parent.replaceChildren();
    const box = document.createElement('div');
    box.className = 'preview';
    const player = document.createElement('video');
    player.controls = true;
    player.playsInline = true;
    player.preload = 'auto';
    player.muted = true;
    player.loop = false;
    let clipIndex = 0;
    player.src = urls[clipIndex];
    player.addEventListener('ended', () => {
      clipIndex = (clipIndex + 1) % urls.length;
      player.src = urls[clipIndex];
      player.load();
      player.play().catch(() => {});
    });
    player.addEventListener('error', () => status('A sequence clip could not be loaded. Check its MP4 URL.', 'error'), {once: true});
    box.append(player);
    parent.append(box);
    if (autoplay) player.play().catch(() => {});
  }
  function preview(url, parent, autoplay = false, word = '') {
    parent.replaceChildren();
    if (!url) return;
    if (mountSignBslEmbed(url, word, parent)) {
      status('Loading the selected SignBSL video…');
      return;
    }
    const box = document.createElement('div');
    box.className = 'preview';
    const player = document.createElement('video');
    player.controls = true;
    player.playsInline = true;
    player.preload = 'auto';
    player.src = url;
    player.addEventListener('error', () => status('This MP4 could not be loaded. Check the URL and try another video.', 'error'), {once: true});
    if (autoplay) {
      player.autoplay = true;
      player.muted = true;
      player.loop = true;
      player.play().catch(() => {});
    }
    box.append(player);
    parent.append(box);
  }
  async function request(path, payload) {
    const response = await fetch(path, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Request failed');
    data = window.BSL_DATA = result.data;
    status(`${result.message || `Saved ${result.video_id}.`} CSV and generated dictionary data are updated.`, 'success');
    return result;
  }
  const save = payload => request('/api/save', payload);

  function urlEditor(entry, video, onDone) {
    const fields = document.createElement('div');
    fields.className = 'fields';
    const label = document.createElement('label');
    label.textContent = 'Video URL';
    const input = document.createElement('input');
    input.type = 'url';
    input.placeholder = 'SignBSL page#video-id or direct .mp4 URL';
    input.value = video?.url || '';
    let previewedUrl = '';
    label.append(input);
    const previewArea = document.createElement('div');
    fields.append(label);
    fields.append(button('Preview', () => {
      try {
        const url = new URL(input.value);
        if (url.protocol !== 'https:' || (!signBslVideo(url.href) && !url.pathname.toLowerCase().endsWith('.mp4'))) throw Error();
        previewedUrl = url.href;
        preview(url.href, previewArea, true, entry.word);
      } catch {
        status('Enter a SignBSL sign URL with #video-id, or a direct .mp4 URL.', 'error');
      }
    }));
    async function saveUrl(value = input.value) {
      const url = new URL(value);
      if (url.protocol !== 'https:' || (!signBslVideo(url.href) && !url.pathname.toLowerCase().endsWith('.mp4')))
        throw Error('Enter a SignBSL sign URL with #video-id, or a direct .mp4 URL.');
      const result = await save({entry_id: entry.entry_id, url: url.href, mode});
      onDone?.(result);
      return result;
    }
    const saveButton = button('Save URL', async () => {
      try {
        await saveUrl();
      } catch (error) {
        status(error.message || 'Enter a valid video URL.', 'error');
      }
    });
    fields.append(saveButton);
    return {fields, previewArea, previewedUrl: () => previewedUrl, saveUrl};
  }

  function sequenceEditor(entry, onDone) {
    const existing = sequenceFor(entry.sign_id).map(clip => clip.url);
    const details = document.createElement('details');
    details.className = 'sequence-editor';
    details.open = existing.length > 0;
    const summary = document.createElement('summary');
    const words = wordParts(entry.word);
    const clipCount = [2, 3].includes(words.length) ? words.length : (existing.length || 3);
    summary.textContent = existing.length
      ? `Edit ${clipCount}-clip sequence`
      : `Set up a ${clipCount}-clip sequence`;
    details.append(summary);
    const labels = words.length === clipCount ? words : Array.from({length: clipCount}, (_, index) => `Clip ${index + 1}`);
    const inputs = [];
    labels.forEach((name, index) => {
      const label = document.createElement('label');
      label.textContent = `${name} · clip ${index + 1}`;
      const input = document.createElement('input');
      input.type = 'url';
      input.placeholder = 'Direct HTTPS .mp4 URL';
      input.value = existing[index] || '';
      label.append(input);
      details.append(label);
      inputs.push(input);
    });
    const previewArea = document.createElement('div');
    const actions = document.createElement('div');
    actions.className = 'fields';
    actions.append(button('Preview sequence', () => {
      const urls = inputs.map(input => input.value.trim());
      if (![2, 3].includes(urls.length) || !urls.every(isDirectMp4)) {
        status('Enter two or three direct HTTPS .mp4 URLs to preview the sequence.', 'error');
        return;
      }
      previewSequence(urls, previewArea, true);
    }));
    actions.append(button('Save sequence', async () => {
      const urls = inputs.map(input => input.value.trim());
      if (![2, 3].includes(urls.length) || !urls.every(isDirectMp4)) {
        status('Enter two or three direct HTTPS .mp4 URLs to save the sequence.', 'error');
        return;
      }
      try {
        await request('/api/sequence', {entry_id: entry.entry_id, urls});
        onDone?.();
      } catch (error) {
        status(error.message, 'error');
      }
    }));
    details.append(actions, previewArea);
    return details;
  }

  function wordEditor(entry, onDone) {
    const details = document.createElement('details');
    details.className = 'word-editor';
    const summary = document.createElement('summary');
    summary.textContent = 'Correct word';
    const label = document.createElement('label');
    label.textContent = 'Dictionary word';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 100;
    input.value = entry.word;
    label.append(input);
    const actions = document.createElement('div');
    actions.className = 'fields';
    actions.append(button('Save word', async () => {
      const word = input.value.trim().replace(/\s+/g, ' ');
      if (!word) {
        status('Enter the corrected word.', 'error');
        return;
      }
      try {
        await request('/api/word', {entry_id: entry.entry_id, word});
        onDone?.();
      } catch (error) {
        status(error.message, 'error');
      }
    }));
    details.append(summary, label, actions);
    return details;
  }

  function renderUnverified() {
    const allRows = unresolved();
    const levelRows = allRows.filter(entry => levelFilter === 'all' || entry.level === levelFilter);
    const rows = levelRows.filter(entry => lessonFilter === 'all' || lessonKey(entry) === lessonFilter);
    if (cursor >= rows.length) cursor = Math.max(0, rows.length - 1);
    if (cursor < 0) cursor = 0;
    work.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = 'Fix Video - Individual';
    work.append(heading);

    const filters = document.createElement('div');
    filters.className = 'fields';
    const levelLabel = document.createElement('label');
    levelLabel.textContent = 'Level';
    const levelSelect = document.createElement('select');
    const levels = [
      ['all', `All levels (${allRows.length} unverified)`],
      ...[...new Set(data.lesson_vocabulary.map(entry => entry.level))]
        .sort((a, b) => Number(a) - Number(b))
        .map(level => [level, `Level ${level} (${allRows.filter(entry => entry.level === level).length} unverified)`])
    ];
    levels.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      levelSelect.append(option);
    });
    levelSelect.value = levelFilter;
    levelLabel.append(levelSelect);

    const lessonLabel = document.createElement('label');
    lessonLabel.textContent = 'Lesson or topic';
    const lessonSelect = document.createElement('select');
    const lessonOptions = data.lesson_vocabulary.filter(entry =>
      levelFilter === 'all' || entry.level === levelFilter);
    const lessonGroups = new Map();
    lessonOptions.forEach(entry => {
      const key = lessonKey(entry);
      if (!lessonGroups.has(key)) lessonGroups.set(key, {entry, count: 0});
    });
    allRows.forEach(entry => {
      const key = lessonKey(entry);
      if (lessonGroups.has(key)) lessonGroups.get(key).count++;
    });
    const options = [['all', `All lessons (${levelRows.length} unverified)`]];
    [...lessonGroups.entries()]
      .sort(([, a], [, b]) => lessonName(a.entry).localeCompare(lessonName(b.entry), undefined, {numeric: true}))
      .forEach(([key, group]) => {
        const prefix = levelFilter === 'all' ? `Level ${group.entry.level} · ` : '';
        options.push([key, `${prefix}${lessonName(group.entry)} (${group.count} unverified)`]);
      });
    options.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      lessonSelect.append(option);
    });
    if (![...lessonSelect.options].some(option => option.value === lessonFilter)) lessonFilter = 'all';
    lessonSelect.value = lessonFilter;
    levelSelect.addEventListener('change', () => {
      levelFilter = levelSelect.value;
      lessonFilter = 'all';
      cursor = 0;
      renderUnverified();
    });
    lessonSelect.addEventListener('change', () => {
      lessonFilter = lessonSelect.value;
      cursor = 0;
      renderUnverified();
    });
    lessonLabel.append(lessonSelect);
    filters.append(levelLabel, lessonLabel);
    work.append(filters);
    if (!rows.length) {
      const empty = document.createElement('p');
      empty.textContent = allRows.length
        ? 'No unverified videos in this Level and Lesson selection.'
        : 'All assigned videos verified. No unverified video candidates remain.';
      work.append(empty);
      return;
    }
    const entry = rows[cursor];
    const video = selected(entry);
    const clips = sequenceFor(entry.sign_id);
    const word = document.createElement('p');
    word.className = 'entry-title';
    word.textContent = entry.word;
    const titleRow = document.createElement('div');
    titleRow.className = 'entry-title-row';
    titleRow.append(word, wordEditor(entry, renderUnverified));
    const meta = document.createElement('p');
    meta.className = 'muted';
    meta.textContent = `Entry ${entry.entry_id} · ${entry.topic || `Lesson ${entry.lesson}`} · ${cursor + 1} of ${rows.length} · ${video.video_id} (${video.verification_status})`;
    work.append(titleRow, meta);
    if (video.problem_report) {
      const report = document.createElement('div');
      report.className = 'reported-problem';
      report.append(document.createElement('strong'));
      report.querySelector('strong').textContent = 'Reported problem';
      const reportText = document.createElement('p');
      reportText.textContent = video.problem_report;
      report.append(reportText);
      work.append(report);
    }
    const quickLabel = document.createElement('label');
    quickLabel.className = 'check-control';
    const quick = document.createElement('input');
    quick.type = 'checkbox';
    quick.id = 'quick-mode';
    quick.checked = localStorage.getItem('verifyQuickMode') === 'true';
    quick.addEventListener('change', () => localStorage.setItem('verifyQuickMode', String(quick.checked)));
    quickLabel.append(quick, document.createTextNode('Quick mode'));
    work.append(quickLabel);
    const playerArea = document.createElement('div');
    if (clips.length === 3) previewSequence(clips.map(clip => clip.url), playerArea, true);
    else preview(video.url, playerArea, true, entry.word);
    work.append(playerArea);
    const editor = urlEditor(entry, video, () => {
      if (quick.checked && cursor >= rows.length - 1) cursor = 0;
      renderUnverified();
    });
    work.append(editor.fields, editor.previewArea, sequenceEditor(entry, renderUnverified));
    const verifyButton = button('Verify Video', async () => {
      try {
        const previewedUrl = editor.previewedUrl();
        if (previewedUrl && previewedUrl !== video.url) {
          const usePreview = window.confirm(
            'You previewed a different video URL.\n\nPress OK to save and verify the previewed video. Press Cancel to verify the original video.'
          );
          if (usePreview) {
            await editor.saveUrl(previewedUrl);
            return;
          }
        }
        await request('/api/verify', {entry_id: entry.entry_id});
        if (quick.checked && cursor >= rows.length - 1) cursor = 0;
        renderUnverified();
      } catch (error) {
        status(error.message, 'error');
      }
    });
    const navigation = document.createElement('div');
    navigation.className = 'fields';
    navigation.append(
      verifyButton
    );
    if (sequenceForWord(entry.word).length) {
      navigation.append(button('Sequence not needed', async () => {
        try {
          await request('/api/sequence-not-needed', {entry_id: entry.entry_id});
          renderUnverified();
        } catch (error) {
          status(error.message, 'error');
        }
      }));
    }
    navigation.append(
      button('Previous', () => {cursor = (cursor - 1 + rows.length) % rows.length; renderUnverified();}),
      button('Next', () => {cursor = (cursor + 1) % rows.length; renderUnverified();})
    );
    work.append(navigation);
  }

  function renderFix() {
    work.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = 'Fix Video';
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search by entry ID, video ID or word';
    search.value = query;
    search.addEventListener('input', () => {query = search.value; populate();});
    work.append(heading, search);
    const list = document.createElement('div');
    list.className = 'entry-list';
    work.append(list);
    function populate() {
      list.replaceChildren();
      data.lesson_vocabulary.filter(entry => {
        const video = selected(entry);
        return `${entry.entry_id} ${entry.word} ${video?.video_id || ''} ${video?.url || ''}`
          .toLowerCase().includes(query.toLowerCase());
      }).slice(0, 100).forEach(entry => {
        const video = selected(entry);
        const card = document.createElement('article');
        card.className = 'entry-card';
        const title = document.createElement('h3');
        title.textContent = `${entry.word} · Entry ${entry.entry_id}`;
        const info = document.createElement('p');
        info.className = 'muted';
        info.textContent = video ? `${video.video_id} · ${video.verification_status}` : 'Awaiting video';
        card.append(title, info);
        card.append(wordEditor(entry, renderFix));
        if (video?.problem_report) {
          const report = document.createElement('div');
          report.className = 'reported-problem';
          const reportHeading = document.createElement('strong');
          reportHeading.textContent = 'Reported problem';
          const reportText = document.createElement('p');
          reportText.textContent = video.problem_report;
          report.append(reportHeading, reportText);
          card.append(report);
        }
        const editor = urlEditor(entry, video, renderFix);
        card.append(editor.fields, editor.previewArea, sequenceEditor(entry, renderFix));
        list.append(card);
      });
    }
    populate();
  }

  function renderAwaiting() {
    const rows = awaiting().filter(entry => `${entry.entry_id} ${entry.word}`.toLowerCase().includes(query.toLowerCase()));
    work.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = `Add New Video · ${rows.length} awaiting`;
    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Filter by word or entry ID';
    search.value = query;
    search.addEventListener('input', () => {query = search.value; renderAwaiting();});
    const list = document.createElement('div');
    list.className = 'entry-list';
    work.append(heading, search, list);
    rows.slice(0, 200).forEach(entry => {
      const card = document.createElement('article');
      card.className = 'entry-card';
      const title = document.createElement('h3');
      title.textContent = `${entry.word} · Entry ${entry.entry_id}`;
      const info = document.createElement('p');
      info.className = 'muted';
      info.textContent = `${entry.topic || `Lesson ${entry.lesson}`} · sign ${entry.sign_id}`;
      card.append(title, info);
      card.append(wordEditor(entry, renderAwaiting));
      const editor = urlEditor(entry, null, renderAwaiting);
      card.append(editor.fields, editor.previewArea, sequenceEditor(entry, renderAwaiting));
      list.append(card);
    });
    if (!rows.length) list.textContent = 'No awaiting video entries match this filter.';
  }

  function render() {
    status('');
    document.querySelectorAll('[data-mode]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    });
    ({unverified: renderUnverified, fix: renderFix, awaiting: renderAwaiting}[mode])();
  }
  document.querySelectorAll('[data-mode]').forEach(tab => tab.addEventListener('click', () => {
    mode = tab.dataset.mode;
    cursor = 0;
    query = '';
    render();
  }));
  render();
})();
