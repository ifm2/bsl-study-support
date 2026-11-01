(() => {
  const $ = selector => document.querySelector(selector);
  let data = window.BSL_DATA;
  const work = $('#work');
  const message = $('#message');
  let mode = 'unverified';
  let cursor = 0;
  let query = '';

  const selected = entry => data.videos.find(video => video.video_id === entry.selected_video_id);
  const sequenceFor = signId => (data.video_sequences || [])
    .filter(clip => clip.sign_id === signId)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const unresolved = () => data.lesson_vocabulary.filter(entry => {
    const video = selected(entry);
    return video && video.verification_status === 'Unverified';
  });
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
    label.append(input);
    const previewArea = document.createElement('div');
    fields.append(label);
    fields.append(button('Preview', () => {
      try {
        const url = new URL(input.value);
        if (url.protocol !== 'https:' || (!signBslVideo(url.href) && !url.pathname.toLowerCase().endsWith('.mp4'))) throw Error();
        preview(url.href, previewArea, true, entry.word);
      } catch {
        status('Enter a SignBSL sign URL with #video-id, or a direct .mp4 URL.', 'error');
      }
    }));
    const saveButton = button('Save URL', async () => {
      try {
        const url = new URL(input.value);
        if (url.protocol !== 'https:') throw Error('Enter a SignBSL sign URL with #video-id, or a direct .mp4 URL.');
        const result = await save({entry_id: entry.entry_id, url: url.href, mode});
        cursor = 0;
        onDone?.(result);
      } catch (error) {
        status(error.message || 'Enter a valid video URL.', 'error');
      }
    });
    fields.append(saveButton);
    return {fields, previewArea};
  }

  function sequenceEditor(entry, onDone) {
    const existing = sequenceFor(entry.sign_id).map(clip => clip.url);
    const details = document.createElement('details');
    details.className = 'sequence-editor';
    details.open = existing.length === 3;
    const summary = document.createElement('summary');
    summary.textContent = existing.length === 3 ? 'Edit three-clip sequence' : 'Set up a three-clip sequence';
    details.append(summary);
    const words = entry.word.trim().split(/\s+/);
    const labels = words.length === 3 ? words : ['Clip 1', 'Clip 2', 'Clip 3'];
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
      if (!urls.every(isDirectMp4)) {
        status('Enter three direct HTTPS .mp4 URLs to preview the sequence.', 'error');
        return;
      }
      previewSequence(urls, previewArea, true);
    }));
    actions.append(button('Save sequence', async () => {
      const urls = inputs.map(input => input.value.trim());
      if (!urls.every(isDirectMp4)) {
        status('Enter three direct HTTPS .mp4 URLs to save the sequence.', 'error');
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

  function renderUnverified() {
    const rows = unresolved();
    if (cursor >= rows.length) cursor = Math.max(0, rows.length - 1);
    if (!rows.length) {
      work.innerHTML = '<h2>All assigned videos verified</h2><p>No unverified video candidates remain.</p>';
      return;
    }
    const entry = rows[cursor];
    const video = selected(entry);
    const clips = sequenceFor(entry.sign_id);
    work.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = 'Fix Video - Individual';
    const word = document.createElement('p');
    word.className = 'entry-title';
    word.textContent = entry.word;
    const meta = document.createElement('p');
    meta.className = 'muted';
    meta.textContent = `Entry ${entry.entry_id} · ${entry.topic || `Lesson ${entry.lesson}`} · ${cursor + 1} of ${rows.length} · ${video.video_id} (${video.verification_status})`;
    work.append(heading, word, meta);
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
    const editor = urlEditor(entry, video, renderUnverified);
    work.append(editor.fields, editor.previewArea, sequenceEditor(entry, renderUnverified));
    const verifyButton = button('Verify Video', async () => {
      try {
        await request('/api/verify', {entry_id: entry.entry_id});
        if (quick.checked) cursor = Math.min(cursor, Math.max(0, unresolved().length - 1));
        renderUnverified();
      } catch (error) {
        status(error.message, 'error');
      }
    });
    const navigation = document.createElement('div');
    navigation.className = 'fields';
    navigation.append(
      verifyButton,
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
