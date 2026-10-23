# SignBSL video lookup report

23 October 2026.

| Measure | Result |
| --- | ---: |
| Level 2 entries previously without an assignment | 531 |
| Distinct sign records searched | 467 |
| Newly selected sourced video records | 406 |
| Previously unassigned entries now covered | 470 |
| Remaining unassigned entries/signs | 61 |
| Total Level 2 entries with a candidate | 752 of 813 |
| Video records across both levels | 969 |

All words were submitted through SignBSL's public search form. Direct MP4 source URLs were read from actual dictionary pages. Each imported candidate returned HTTP 200 or 206 and an MP4 ftyp header. These checks used byte-range requests rather than downloading/distributing the videos.

Returned singular headings were accepted for explicit dictionary plural normalisation. Pages with multiple definitions were checked against the workbook context, including body-part Arm, school Break, academic Course, building Detached, clothes Iron, sports Lose, cosmetics Makeup, treatment Medicine, educational Study and learning Target. Context-specific searches were used where the generic page gave an unrelated meaning. An equivalent-term link supplied the Organise candidate through Arrange.

No clip was assigned where a mismatch was evident: Costa as a rib, Subway as a railway, Pass as dying/passing by, and Step as a footstep were rejected for the corresponding workbook contexts. Compound phrases and range labels were not replaced with a video for only one component. Some pages explicitly report no video and some follow-up equivalent-term requests were rejected with HTTP 403.

`data/video_lookup_audit.json` records each of the 467 lookup outcomes, affected entry IDs and topics, selected candidate/source URL if available, HTTP result, check timestamp and remaining reason. `REMAINING_VIDEOS.md` is the readable checklist of all 61 outstanding words.

The Unverified status is intentionally retained for every video. Technical reachability and an appropriate dictionary label do not establish signing accuracy, regional suitability or rights. The lookup did not revalidate or replace the original 563 video records. All existing assignments and IDs remain intact.
