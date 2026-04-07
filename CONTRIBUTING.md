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

### Submitting code

1. Fork the repository
2. Create a branch for your change: `git checkout -b my-improvement`
3. Make your changes
4. Test in the browser with at least 2 IXes (one small and one large like IX.br São Paulo)
5. Commit: `git commit -m "Clear description of the change"`
6. Push: `git push origin my-improvement`
7. Open a Pull Request

## Guidelines

- The project is a **single HTML file** with no external dependencies (except Google Fonts). Keep it that way.
- When changing API logic, **never** use the `depth=` parameter in PeeringDB calls — it activates a 250-result limit per request (see `docs/KNOWLEDGE_INDEX.md`).
- Keep all 3 languages (PT, EN, ES) in sync when changing UI text.
- Test with IXes of different sizes before submitting a PR.

## Code of conduct

Be respectful. Contributions are evaluated on technical merit. Collaborate constructively.
