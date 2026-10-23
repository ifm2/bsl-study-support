# BSL Support Dictionary v4

Extract the ZIP and open `index.html`. No build or server is needed to browse. Direct signing videos require an internet connection.

## Changes in this version

- Level 1 keeps its original 14 lessons and all 852 vocabulary occurrences, IDs, ordering, page references, labels, notes and selected videos.
- Level 2 now uses nine topic options rather than lessons: Work Life, The Home, Education, People and Personalities, Hobbies and Activities, Health and Fitness, Home Life, Travel and Holidays, Food and Drink.
- Imported 813 Level 2 topic/category memberships from the reviewed workbook extraction. All slash-separated Level 2 labels were split into individual entries, then duplicate labels within the same topic/category merged. Words may belong to more than one topic/category while sharing a deduplicated sign record.
- NMF markers, source wording and all printed page references are retained as data. Display words omit the source's NMF/count/spelling reminders. The supplied blank pages are intentional, as confirmed by the user; they are not treated as missing content. No Shopping and Spending vocabulary list was extracted from those blank pages, and no entries or placeholder lessons have been invented.
- Practice reveals the answer at the top of the card and in larger text below the video, immediately above the confidence buttons. The Reveal button disappears once used; there is no per-card Hide button. Moving cards conceals English again when Hide English is enabled.
- Confidence choices are Not yet (0), Almost (0.5), Got it (1). Every card must have one rating. At the last card, a completed set shows total points and percentage; skipped cards are identified with a button to the next unrated card. Previous/Next allows rating corrections without double-counting. Restart clears ratings and keeps the same order.
- No local search match now shows buttons to matching lessons/topics in either level. Clicking one keeps the search query and opens that set.

## Video coverage and Ko-fi

A Ko-fi support button in the footer uses the requested image and https://ko-fi.com/S6S24KS6O. It opens a new tab with noopener/noreferrer. No donation is made automatically.

Every one of the 531 previously unassigned Level 2 memberships was included in the lookup: these represented 467 distinct sign records. Actual SignBSL pages supplied 406 new selected video records, reused across 470 memberships. Level 2 now has 752 memberships with candidates; 61 remain Awaiting video and are excluded from Practice.

For every newly assigned video, its URL was extracted from an actual source page and returned HTTP 200 or 206 with an MP4 file header. Its source-page URL, lookup word, check timestamp and HTTP result are recorded in `data/video_lookup_audit.json`. Dictionary links on new candidates open that source page, including context-specific lookups.

There are now 969 video records. All remain Unverified for correct signing: a responding MP4 is not a linguistic verification. Original video records, IDs and assignments are unchanged. No speculative URL patterns, composite phrases or unobserved alternative variants were added. One sourced candidate per resolved new sign was imported.

The 61 remaining entries include words whose dictionary page has no video, phrases/ranges and proper names without a suitable standalone clip, and cases where the available sign means something different. For example, the underground-railway video was not assigned to Subway in the food topic. Some equivalent-term follow-up requests returned HTTP 403. See `REMAINING_VIDEOS.md` for the word-by-word checklist and `VIDEO_LOOKUP_REPORT.md` for the method.

Remote availability can change. The checks read the MP4 header rather than playing every full clip. Signing accuracy, rights and uninterrupted playback have not been verified. Existing videos request direct MP4 playback, muted, looping and inline; actual playback and simultaneous Autoplay depend on the host/browser.

## Defaults and sessions

Level 1, Lesson 1, Dictionary and Flashcard are the defaults. Show entry ID & workbook page is ON. In Practice, Random order and Hide English start ON. The two practice settings remain independent.

A practice session is the selected level/set, search and category. Changing one of these or Random order starts a fresh deck and clears ratings. Revealing, rating, toggling details, switching playback modes, or visiting Dictionary preserves the current deck order and ratings. Reveal and confidence clicks do not stop the active video. Navigating cards or leaving the current view stops/releases its player. Refresh starts over; ratings are kept only in the current page session.

## Three CSV masters

`data/signs.csv` holds deduplicated word/meaning records with permanent sign_id.

`data/videos.csv` holds the existing candidates, permanent video_id, sign ownership, source, URL, priority and per-video verification status.

`data/lesson_vocabulary.csv` retains its existing filename for compatibility. Its new columns are:

- topic: blank for Level 1; the topic name for Level 2. Level 2 lesson is blank.
- nmf: TRUE where the source explicitly marks NMF, otherwise FALSE. FALSE does not imply a sign never uses a non-manual feature.
- source_pages: all printed page references, separated by semicolons. source_page remains the first page for backwards compatibility.

All original fields and IDs on Level 1 rows remain intact. New numeric entry/order IDs start at 853; do not renumber existing records. A blank selected_video_id means no candidate has been assigned. Do not invent a URL to fill that gap. Assign a sourced candidate to its sign in videos.csv, then select that video explicitly on the relevant occurrence rows.

After CSV edits run `python tools/generate_data.py`. It validates all three masters and regenerates `data/data.js` and `data/data.json`. The browser loads the generated JavaScript so local file browsing works. Generated files and test fixtures are not extra masters.

The split vocabulary review CSV is delivered separately from the website package so the website keeps exactly three CSV masters.

## Replace GitHub files when ready

1. Back up/download the current repository. Note its existing GitHub Pages publishing folder (root or docs).
2. Extract this ZIP and preview index.html from the inner bsl-support-dictionary-v4 folder.
3. On a review branch, copy the CONTENTS of that inner folder into the existing publishing folder. Replace index.html, script.js, style.css and the complete data folder together. Do not add an extra nested site folder. Preserve repository configuration, CNAME/custom domain and unrelated files.
4. Keep the three data CSVs and both generated data files together. tools, tests, README and reports can be included for maintenance. Test fixtures/screenshots are optional for the published page. Do not upload workbook PDFs or use the review CSV as a fourth master.
5. Review the diff and try Level 1, Level 2 topics, Practice reveal/scoring and a cross-set search. Merge/publish only when approved. After deployment, refresh and test remote MP4 playback on your device.

This task did not modify or publish the live GitHub repository.

## Tests

- `python -m unittest discover -s tests -v`
- `node tests/browser.cjs` (Playwright and installed Microsoft Edge required; set NODE_PATH to your Playwright packages if necessary).

Browser tests abort external media to exercise fallback behavior. They validate source selection, playback settings and cleanup, not successful remote signing playback. See VALIDATION_REPORT.md for coverage. The separate source lookup checked the new remote MP4 headers; UI regression tests still abort remote media.
