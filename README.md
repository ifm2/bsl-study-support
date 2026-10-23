# BSL Study Support

BSL Study Support is a video dictionary and revision tool for learners of British Sign Language. It brings vocabulary into one place so you can look up signs, revisit course material and practise recognising signs at your own pace.

Currently the site works on vocabulary from a Level 1 and Level 2 course. Each week Level is broken down into topics. Each topic is divided into smaller categories so you can focus on what you want to study.

## Getting started

Download or clone this repository and open `index.html` in your browser. There is no build step, account or installation required to browse the dictionary. An internet connection is needed to load the signing videos and Ko-fi image.

Choose a level, then a lesson or topic. Use the category links to find a section, or search for an English word. If the current set has no match, the site shows links to matching lessons and topics elsewhere in the dictionary.

The site is also hosted on https://ifm2.github.io/bsl-study-support/

## Dictionary mode

Dictionary is the starting view. It shows vocabulary cards grouped by category, with each entry's English word, selected video, source link and verification status.

- **Flashcard** loads a video when you press Play.
- **Autoplay** plays the visible videos muted and looping, subject to your browser's playback limits.
- **Show entry ID & workbook page** is off by default for a less cluttered view. Switch it on when you want to see reference details.

## Practice mode

Practice shows one sign at a time. Select a category or leave **All categories** selected to practise the whole lesson or topic. Search can also narrow the set.

1. Watch the video, which plays automatically and looping. If your browser blocks autoplay, use its Play control.
2. With **Hide English** enabled, guess the word and press **Reveal answer**. The answer appears above and below the video.
3. Choose **Not Yet**, **Almost** or **Got it**. Each choice records your rating and automatically moves to the next card.
4. After the final card, see your results. 

**Random order** and **Hide English** start on and can be changed independently. The shuffled order stays fixed while you work through the set. Changing the lesson, topic, category, search or Random order starts a fresh practice session. Switching between Dictionary and Practice keeps your place and recorded ratings. Refreshing the page clears the session.

Entries without an assigned video remain visible in Dictionary but are excluded from Practice. If a remote video fails to load, the card provides a dictionary source link after its answer is revealed.

## Vocabulary organisation

| Level | Organisation |
| --- | --- |
| Level 1 | 14 course lessons, with vocabulary kept in permanent workbook order. Lesson 14 has no explicit vocabulary entries in the supplied dataset. |
| Level 2 | Work Life; The Home; Education; People and Personalities; Hobbies and Activities; Health and Fitness; Home Life; Travel and Holidays; Food and Drink. |

Words can appear in more than one lesson, topic or category. These are separate study memberships that can share the same sign and video record.

Workbook page references and original wording are retained for checking. Level 2 display words omit variation counts and fingerspelling reminders. Explicit Non-Manual Feature (NMF) reminders are stored in an `nmf` field rather than included in the displayed word. Slash-separated Level 2 labels are stored as individual entries.

## Video sources and limitations

The dictionary uses direct MP4 links from [SignBSL](https://www.signbsl.com/) and credits the selected source through each card's dictionary link. Video rights remain with their respective owners. This project is an independent study aid to use alongside your course and tutor.

Videos marked **Unverified** have not been confirmed for signing accuracy or regional suitability. A successful URL check does not establish that the clip is the correct sign for every context. Entries marked **Awaiting video** do not yet have a suitable selected candidate.

See [remaining video lookups](REMAINING_VIDEOS.md) for unresolved entries and [the lookup report](VIDEO_LOOKUP_REPORT.md) for source-checking details. Recorded technical checks are in `data/video_lookup_audit.json`. Workbook PDFs are not distributed with the project.

## Maintaining the data

The three editable CSV masters are:

| File | Purpose |
| --- | --- |
| `data/signs.csv` | Deduplicated words/meanings, identified by permanent `sign_id`. |
| `data/videos.csv` | Sourced video candidates, sign ownership, permanent `video_id`, priority and per-video verification status. |
| `data/lesson_vocabulary.csv` | Study memberships, linking an entry to a sign, selected video, level, lesson/topic, category, source wording and pages. |

The vocabulary file keeps its original name for compatibility. Level 1 rows use `lesson` and leave `topic` blank; Level 2 rows use `topic` and leave `lesson` blank. `source_pages` records all printed page references, while `source_page` retains the first reference. `nmf` is TRUE only where explicitly marked in the source; FALSE does not mean the sign never uses a non-manual feature.

Keep all existing IDs permanent. A blank `selected_video_id` means no candidate is assigned. Add only sourced video URLs and keep their verification status accurate.

After editing the CSVs, run:

```text
python tools/generate_data.py
```

The generator validates keys, references and fields, then updates `data/data.js` and `data/data.json`. These generated files support browsing directly from disk and must be published with the CSVs. They and the test fixtures are not additional data masters.

The site consists of plain HTML, CSS and JavaScript. GitHub Pages can serve it directly from the repository root.

### Local video verification

Use `VerifyVideo.html` to review unverified videos, replace a selected video URL, or assign a candidate to an entry awaiting video. Run the local editor server from the repository root:

```text
python tools/verify_video_server.py
```

Then open `http://127.0.0.1:8000/VerifyVideo.html`. Saving updates the affected row in the CSV master and regenerates `data/data.js` and `data/data.json`. Keep this local tool off a public server. The preview supports direct video URLs such as MP4; some hosts block playback when embedded.

## Development checks

```text
python -m unittest discover -s tests -v
node tests/browser.cjs
```

The browser suite requires Playwright and Microsoft Edge. Set `NODE_PATH` to the Playwright package location if needed. It covers the vocabulary, navigation, playback settings, practice flow, rating percentages and responsive layout. External media requests are deliberately aborted during UI tests, so these checks do not establish live video availability or signing accuracy.

## Support and project history

If you find the project useful, you can [support it on Ko-fi](https://ko-fi.com/S6S24KS6O).

Release history is recorded in [CHANGELOG.md](CHANGELOG.md).
