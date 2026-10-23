# v4 validation report

23 October 2026. New version based on v3.

Seven Python checks cover the original Level 1 migration comparison, preservation of all existing IDs and records, Level 2 topic/slash/NMF rules, invalid-data rejection, generated-data equality, exactly three CSV masters, and source evidence for each newly imported video. All 406 new candidate records have a recorded actual source URL, successful HTTP status (200/206) and positive MP4-header check. No previously assigned v3 video was changed. All 1,665 vocabulary memberships and 1,030 sign records are retained.

The headless Edge suite covers all Level 1/2 dictionary rows and menus, default/reload settings, direct MP4 selection and error fallback, player cleanup, stable shuffled practice decks, one-way reveal and prominent answer, confidence score calculation/corrections/skips/restart, cross-set search navigation, awaiting-video exclusions and responsive widths of 320/390/768/1280 pixels. It additionally checks the Ko-fi URL, image source/height, new-tab target and safe link relationship. Desktop/mobile/score screenshots are inspected for layout.

The browser regression suite deliberately aborts external media. The separate public-source lookup performs the real HTTP/MP4-header checks for new candidates. It does not establish full playback or signing accuracy; every video remains Unverified. Source availability may change later.

The output archive is integrity-checked and re-extracted for tests. It contains exactly three CSV masters, generated browser data, source evidence, instructions and tests; no workbook PDFs or Python caches. No live repository was changed or published.
