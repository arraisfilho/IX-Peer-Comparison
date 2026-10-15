# Contributing

Any contribution is welcome! Feel free to study the code, improve it, and send suggestions.

## How to contribute

### Reporting bugs

1. Open an [Issue](../../issues) describing the problem
2. Include: browser used, IXes selected, and expected vs. actual behavior
3. If possible, include screenshots or the browser console log (F12 → Console)

### Suggesting features

1. Open an [Issue](../../issues) with the `enhancement` label
2. Describe the desired feature and use case

## Guidelines

- The distributed artifact is the generated root `index.html`: a single self-contained file with no runtime dependencies (Google Fonts aside). Source lives in `src/`; after changing it, run `npm run build` and commit both. Never edit the root `index.html` by hand: CI checks that it is in sync with `src/`. Development tools go in `devDependencies` only.
- Every PeeringDB call goes through `api()` in `src/data/api.js`, the queue that spaces, limits and retries requests; build its path with `pdbPath()` and pass `fields=` with only the fields the app reads. **Never** use the `depth=` parameter: with `depth` ≥ 1 list results are truncated to 250 rows (verified 2026-10-15), `depth=0` gains nothing over leaving it out, and `api()` throws on it.
- Keep all 3 languages (PT, EN, ES) in sync when changing UI text; `npm run test:unit` checks that the dictionaries have the same keys and placeholders.
- Run `npm run check` before submitting a PR. Its Playwright tests load small and medium IXes and a 2000-member IX from a fake PeeringDB. Tests whose network behaviour differs on purpose from the legacy app (`tests/legacy/index.html`) are tagged `@api-v2`; the `legacy` project skips them.

## Code of conduct

Be respectful. Contributions are evaluated on technical merit. Collaborate constructively.
