# Changelog

## [Unreleased]

### Changed

- Moved the source code to `src/`; `index.html` is now generated from it with `npm run build` and still opens directly from disk.

### Removed

- Removed the app's functions and state from the page's global scope (for example `addIX` or `setLang` in the browser console); the page now runs as one bundled script.

### Fixed

- Ignored IX catalog entries without a numeric id, so a malformed or tampered catalog can no longer inject markup through IX ids.

- Escaped IX names in status bar error messages, so HTML in a PeeringDB IX name is shown as text instead of running in the page.
- Escaped unknown peering policies in the table and ignored country codes from PeeringDB or RIPEstat that are not two capital letters, so HTML in those fields is no longer interpreted.
- Counted an IX's members in the totals, table and presence filters only once its network and organisation data had loaded, so an IX that fails to load no longer contributes an incomplete member list.
- Ended loading with a visible error when re-adding an IX fails, instead of leaving that IX, the table and the continent and country filters stuck on "loading".
- Fetched an IX's member list again when it is re-added after a failed load, instead of reusing the incomplete list from the failed attempt.
- Reset the presence filter to "All" when the IX of the active "Only X" filter is removed, or when "In all IXes" is active and only one IX remains, instead of leaving no presence filter selected.
- Reset the continent and the country to "All" before drawing the table when another filter leaves no network in them, so the table matches the filter controls instead of showing no rows.
- Honoured a Retry-After given as an HTTP date on HTTP 429 and fell back to 30 s when it is missing, invalid or negative, so the rate-limit countdown no longer shows "NaN" or runs forever.
- Gave up after 4 attempts when PeeringDB keeps answering HTTP 429, marking the IX with an "HTTP 429" error instead of retrying indefinitely.
- Kept the app starting and switching languages when browser storage is blocked or full (for example in private mode); the language and the IX catalog are then not remembered between visits.
- Fell back to Portuguese, with its button selected, when the stored language is not Portuguese, English or Spanish.
- Kept the error visible in the status bar when the IX catalog fails to load, also after switching language, instead of replacing it with a green "0 IXes" line.
- Listed networks whose ports at an IX all report a speed of 0 or none, with "—" as speed, instead of leaving them out of the comparison.
- Gave each newly added IX the first colour not in use, so two IXes no longer share a colour after one is removed and another is added.
- Skipped the RIPEstat country lookup for networks missing from PeeringDB (listed as "AS??"), which used to request AS0.
