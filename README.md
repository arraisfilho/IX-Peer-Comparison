# IX Peer Comparison

A browser-based tool for visual comparison of peers across Internet Exchanges, powered by real-time data from [PeeringDB](https://www.peeringdb.com/).

Compare up to **6 IXes side by side** — see which networks are present at each exchange, filter by peering policy, continent or country, and export ASN lists.

![IX Peer Comparison — Screenshot](screenshot-1.png)

## Features

- Search and select from a catalog of ~800 IXes worldwide
- Side-by-side comparison of up to 6 IXes simultaneously
- Real-time data via PeeringDB API — no backend, runs 100% in the browser
- Filter by presence (all IXes, exclusive to one), peering policy (Open / Selective / Restrictive), continent and country
- Search by network name or ASN
- ASN export (clipboard or .txt download)
- Smart caching — re-adding a removed IX is instant (30-minute cache)
- 3 languages: English, Português, Español
- Dark UI with progressive loading

## Usage

1. Open `index.html` in any modern browser
2. Search for an IX (e.g. "IX.br São Paulo", "DE-CIX Frankfurt", "LINX")
3. Click to add — member data loads from PeeringDB
4. Add more IXes to compare
5. Use toolbar filters to refine the view

## ⚠️ PeeringDB API Limitations

The PeeringDB API enforces rate limiting. When selecting very large IXes (e.g. IX.br São Paulo with ~1850 members), the tool makes multiple API calls to fetch network details.

**Recommendations:**
- Avoid adding several large IXes at the same time
- If PeeringDB returns a 429 error (rate limit), the tool waits automatically and retries
- After the first load, data is cached for 30 minutes — re-adding is instant

## Project Structure

```
├── index.html              # The app: one self-contained file, generated from src/ (do not edit)
├── src/
│   ├── index.html          # HTML shell; the build inlines the CSS and JS into it
│   ├── styles/app.css
│   ├── main.js             # Entry point: start-up
│   ├── actions.js          # Add/remove IX, language, filters and sort
│   ├── state.js            # Mutable app state
│   ├── config.js           # Limits, API URLs, palette, cache TTLs
│   ├── i18n/               # pt/en/es dictionaries and t()
│   ├── core/               # Pure helpers: formatting, countries, IX search, colours, Retry-After
│   ├── data/               # localStorage, PeeringDB and RIPEstat
│   └── ui/                 # Rendering and DOM events
├── scripts/build.mjs       # Builds index.html from src/ (esbuild)
├── tests/
│   ├── unit/               # node:test
│   ├── e2e/                # Playwright, against a fake PeeringDB/RIPEstat (tests/fake-api)
│   └── legacy/index.html   # The app before src/ existed, also run by the e2e suite
├── screenshot-1.png, screenshot-2.png
├── LICENSE                 # GNU GPLv3
├── CONTRIBUTING.md
├── CHANGELOG.md
└── README.md
```

## Development

Requires Node.js 22 or later.

```sh
npm ci
npm run build    # regenerate index.html from src/
npm run dev      # rebuild on every change under src/; reload index.html in the browser
npm run check    # lint, typecheck, unit tests, index.html sync check, Playwright tests
```

The Playwright tests need a browser: `npx playwright install chromium`, or `PW_CHANNEL=chrome npm run check` to use the installed Google Chrome.

## Contributing

Any contribution is welcome — feel free to study the code, improve it, and send suggestions.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

## Author

**Filho Arrais**

---

*Data provided by [PeeringDB](https://www.peeringdb.com/). This project is not affiliated with PeeringDB.*
