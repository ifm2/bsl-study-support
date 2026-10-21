# BSL Level 1 — 14 lesson prototype

Open `index.html` in a browser. Select one of the 14 lessons at the top. Vocabulary is ordered by the permanent `global_order` and grouped by coursebook sections. Lesson 14 has no new explicit vocabulary list in the supplied 2026 booklet, so its page is empty.

## Playback
- Flashcard mode is the default: click Play to load and loop a video.
- Autoplay attempts to play every displayed video muted and looping. Browser and bandwidth limitations apply.
- The carousel is disabled until actual alternate URLs can be verified.

## Editing
Edit `data/vocabulary.csv` (the master). `data/vocabulary.xlsx` is a convenient snapshot, not the source of truth. After CSV edits, run `python tools/generate_data.py` to update the JSON/JS. To refresh the Excel snapshot, import the CSV into Excel.

## Video limitations
Only a single candidate SignStation MP4 URL is assigned to each vocabulary row, using the original naming convention. These URLs have **not** been live-checked and some will fail, especially multiword expressions and vocabulary not in SignStation. The website provides a SignBSL dictionary link on each card. The site is a functional navigation and playback prototype, **not** a verified video library. A later URL-resolution pass should test all candidates against other SignBSL sources and record missing matches before sharing with students.

## Source and ordering
Based on `L1 Booklet 2026.pdf` supplied separately. Explicit vocabulary lists and labelled recap vocabulary were transcribed, reading down the left column before moving right. Repeated words remain separate entries. Phrases joined by `/` are generally split. Source page numbers are the printed workbook page numbers. Classroom exercises are not fully converted into individual vocabulary entries. Lesson 1 preserves the previous 39-entry dataset. Review transcription against the PDF before release.

The PDF is deliberately excluded from this ZIP. Hosting can use GitHub Pages once video use and matching are confirmed.

UI update: compact header, lesson dropdown with emoji, lesson title combines number and name.
