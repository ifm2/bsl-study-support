# Validation report

## Current practice flow - 23 October 2026

All seven Python data/provenance tests pass. The vocabulary, CSV masters, video assignments and stable IDs are unchanged by this update.

The updated headless Edge suite passes: all dictionary rows and menus; defaults; direct MP4 selection and fallback; Dictionary playback; muted, looping, inline Practice autoplay and its canplay handler; rating-only advancement through the full 39-card shuffled deck without duplicates or omissions; playback cleanup and answer concealment on each advance; no Previous/Next controls; prominent one-way reveal; session persistence; restart; one-card distributions for each choice; mixed multi-card rating percentages; the exact Health and Fitness: Anatomy heading and the All categories heading without a suffix; empty sets and awaiting-video exclusion; cross-set search; responsive card and result layouts at 320/390/768/1280 pixels; no JavaScript errors.

Desktop and mobile results and Practice views were visually inspected. External media is deliberately aborted in the regression suite. This validates playback configuration and lifecycle, not successful live remote playback or signing accuracy.

## Previous v4 baseline

23 October 2026. New version based on v3.

Seven Python checks cover the original Level 1 migration comparison, preservation of all existing IDs and records, Level 2 topic/slash/NMF rules, invalid-data rejection, generated-data equality, exactly three CSV masters, and source evidence for each newly imported video. All 406 new candidate records have a recorded actual source URL, successful HTTP status (200/206) and positive MP4-header check. No previously assigned v3 video was changed. All 1,665 vocabulary memberships and 1,030 sign records are retained.

The headless Edge suite covers all Level 1/2 dictionary rows and menus, default/reload settings, direct MP4 selection and error fallback, player cleanup, stable shuffled practice decks, one-way reveal and prominent answer, confidence score calculation/corrections/skips/restart, cross-set search navigation, awaiting-video exclusions and responsive widths of 320/390/768/1280 pixels. It additionally checks the Ko-fi URL, image source/height, new-tab target and safe link relationship. Desktop/mobile/score screenshots are inspected for layout.

The browser regression suite deliberately aborts external media. The separate public-source lookup performs the real HTTP/MP4-header checks for new candidates. It does not establish full playback or signing accuracy; every video remains Unverified. Source availability may change later.

The output archive is integrity-checked and re-extracted for tests. It contains exactly three CSV masters, generated browser data, source evidence, instructions and tests; no workbook PDFs or Python caches. No live repository was changed or published.
