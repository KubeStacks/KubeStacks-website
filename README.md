<div align="center">

<img src="public/favicon.svg" width="88" alt="KubeStacks icon" />

# kubestacks.com

The website for [KubeStacks](https://github.com/KubeStacks/KubeStacks), a Kubernetes app for the desktop,
and a dashboard served from the cluster for the whole team.

[![CI](https://github.com/KubeStacks/KubeStacks-website/actions/workflows/ci.yml/badge.svg)](https://github.com/KubeStacks/KubeStacks-website/actions/workflows/ci.yml)
[![E2E coverage](https://img.shields.io/badge/e2e%20coverage-100%25-3fb950)](#testing)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)
[![Hosted on Sevalla](https://img.shields.io/badge/hosted%20on-Sevalla-FF6900)](https://sevalla.com/?utm_source=kubestacks&utm_medium=referral&utm_campaign=website&utm_content=readme)

</div>

[![The site's hero: a live, isometric demo cluster next to the download button](public/og.png)](https://kubestacks.com)

A static site built with [Astro](https://astro.build), with no UI framework on the page. The
hero's cluster is a canvas, and the feature tiles are small scripts that rebuild pieces of
the app's UI from the app's demo cluster: a command palette you can search, logs that stream,
a scale dialog that shows its `kubectl`.

## Development

You need Node.js 26 (24 also works; see `.nvmrc`).

```sh
npm ci
npm run dev        # http://localhost:4321
npm run build      # the static site, in dist/
npm run preview    # serves dist/
```

| Command                  | What it does                                                  |
| ------------------------ | ------------------------------------------------------------- |
| `npm run typecheck`      | Type-checks the `.astro` and `.ts` files                      |
| `npm run lint`           | ESLint                                                        |
| `npm run format`         | Prettier (`format:check` only checks)                         |
| `npm run test:e2e`       | Builds the site with coverage, then runs the Playwright tests |
| `npm run coverage`       | The tests, then the coverage report (`coverage/index.html`)   |
| `npm run coverage:check` | Fails on anything uncovered, listing each line                |
| `npm run verify`         | All of the above, as CI runs it                               |

## Testing

The end-to-end tests in [`tests/e2e`](tests/e2e) drive the built site in desktop Chromium and
in WebKit as an iPhone, the way visitors use it. They cover every script on the page, at
**100% of statements, branches, functions and lines**, enforced in CI.

- **Real builds.** `npm run build:coverage` builds the site twice: as published, and as built
  while GitHub was down (so the browser has to find the release). Both talk to a stand-in for
  GitHub's API ([`tests/support/github-stub.ts`](tests/support/github-stub.ts)) that answers
  with [`tests/fixtures/release.json`](tests/fixtures/release.json), never the real API.
- **Repeatable.** `Math.random` is seeded and the tests move time themselves with Playwright's
  clock, so the cluster's life, the logs and the palette's typing play out the same on every
  run.
- **Coverage.** [`scripts/coverage.ts`](scripts/coverage.ts) instruments `src/` during the
  build. The build's own code (release data, icons) reports from the build; the page's from
  each test. [`scripts/check-coverage.ts`](scripts/check-coverage.ts) merges them and fails
  on any gap, including a file nothing loaded.

Visitors' computers are pretended with init scripts (`navigator.platform`, Chromium's
`userAgentData`, the WebGL renderer that gives away an Intel Mac), and GitHub's answers with
routes: a newer release, a release missing files, an outage.

When a line is hard to reach, first ask whether it's needed: a fallback for something that
can't happen can usually go.

## How it works

### Downloads

Download links always point at the latest GitHub release. The build reads it from GitHub's
API and writes direct links to each installer into the page (set `GITHUB_TOKEN` to avoid
GitHub's rate limit for anonymous requests). When the page loads, it asks GitHub again and
switches every link over if a newer release has been published since, so a release doesn't
need a redeploy. If GitHub can't be reached, the links go to the latest release's page.

The visitor's platform and chip pick the file: the hero offers that one `.dmg`, `.exe` or
AppImage, and the download section lists the rest. Files are matched by the names the app's
`electron-builder.yml` gives them (`KubeStacks-<version>-mac-arm64.dmg` and so on; see
[`src/lib/releases.ts`](src/lib/releases.ts)); if those names change, change the patterns
there too.

### Screenshots

The app's screenshots aren't kept here. They load from the app's repository
([`docs/screenshots`](https://github.com/KubeStacks/KubeStacks/tree/main/docs/screenshots)),
through jsDelivr, at 1440 × 900 and twice that: the app's `npm run screenshots` takes every
screen again and jsDelivr's copies are refreshed, so the site shows the app as it is now
without a redeploy. Each is picked by its name there (see
[`src/lib/screenshots.ts`](src/lib/screenshots.ts)), and names never change. The tests answer
every screenshot with one small stand-in, `tests/fixtures/screenshot.webp`.

### Light and dark

The page follows the system's theme, or the one picked in the switch at the top (System,
Light or Dark, like the app's Appearance menu). A script in `<head>` applies it before the
first paint. Every color is a token in [`src/styles/global.css`](src/styles/global.css), with
the app's light values under `[data-theme='light']`; the hero's canvas has its own pair of
palettes in [`src/scripts/cluster/palette.ts`](src/scripts/cluster/palette.ts).

### Holding still

Nothing on the page moves the page. The live demos have fixed heights and opt out of scroll
anchoring (`overflow-anchor: none`), and rows that re-sort glide into place rather than jump.
The demos only run while on screen, and not at all with reduced motion. `tests/e2e/layout.spec.ts`
checks for sideways scrolling at eight widths, layout shifts and scroll drift.

### Light on resources

The page should cost a visitor next to nothing while it's open:

- The hero draws only as often as it must: every frame for its intro and while it follows the
  pointer, 30 a second while pods come and go, 20 while only glows pulse. Its plates are
  painted once into a backdrop and copied each frame. With reduced motion, it draws only when
  something changes.
- Off screen, or in a hidden tab, nothing runs: not the hero, not its cluster's life, not the
  demos' timers.
- Animations move things with `transform` and `opacity`, so the browser never lays the page out
  for them.
- The screenshots of the app's other views download once its window is on screen, and the
  in-cluster one once it's near.

`tests/e2e/resources.spec.ts` counts the hero's frames and checks what runs where nobody's
looking.

## Where things are

```
src/
  pages/index.astro       The page, section by section
  layouts/Base.astro      <head> and the theme script that runs before the first paint
  components/             One file per section, top to bottom:
    Hero.astro              Headline and the live cluster
    Showcase.astro          The app window with real screenshots (G, then a letter)
    Features.astro          Six tiles, each with a working piece of the UI (features/)
    Cluster.astro           KubeStacks served from a cluster, and how people sign in
    More.astro              Custom resources and views, and the smaller features
    Themes.astro            Light and dark, side by side
    Story.astro             Why KubeStacks exists, and Sevalla
    Download.astro          Platforms, building from source, requirements; the chart and image
    logos/                  KubeStacks, GitHub and Sevalla marks
  scripts/                Each section's behavior, mounted on its data-* attribute
    cluster/                The hero: data, geometry, palettes and the renderer
    features/               The feature tiles
    downloads.ts            Picks the visitor's file, and checks for a newer release
    theme.ts                The theme switch
  lib/                    Shared by the build and the page
    releases.ts             The latest release and which file each platform gets
    icons.ts                Lucide icons (the app's set) as SVG strings, and the status pill
    screenshots.ts          The app's screenshots, from its repository
    site.ts                 Links to the repository, author and Sevalla; the chart and image
  styles/global.css       The app's tokens, type scale and shared pieces
tests/
  e2e/                    Playwright specs, by section
  support/, fixtures/     The GitHub stand-in, a release, a screenshot, the cluster's geometry
scripts/                  The coverage build and gate
```

The design follows the app: its tokens, Inter and JetBrains Mono, Lucide icons, the status
pill and colors, and the same demo cluster (`checkout-jzhdh6j29h-hqnnn` crash-loops here
too), with its screenshots taken from its repository (see [Screenshots](#screenshots)).

## Deploying

The site is hosted on [Sevalla](https://sevalla.com/?utm_source=kubestacks&utm_medium=referral&utm_campaign=website&utm_content=readme) as a static site: Sevalla runs
`npm run build` and serves `dist/`. Deploys come from CI. Once the checks and every test have
passed on `main`, the last job asks Sevalla to deploy that commit with
[sevalla-deploy](https://github.com/sevalla-hosting/sevalla-deploy), and waits until it's live.
It needs two settings in the repository:

- `SEVALLA_TOKEN`, a secret: a Sevalla API key, from
  [app.sevalla.com/api-keys](https://app.sevalla.com/api-keys)
- `SEVALLA_STATIC_SITE_ID`, a variable: the static site's ID in Sevalla (until it's set, CI
  doesn't deploy)

`npm run build` writes a plain static site, so any static host works too. `site` in
[`astro.config.ts`](astro.config.ts) builds the canonical and social-preview links.

## Hosted on Sevalla

KubeStacks exists because of [Sevalla](https://sevalla.com/?utm_source=kubestacks&utm_medium=referral&utm_campaign=website&utm_content=readme): it's where its author works, keeping
an eye on a lot of Kubernetes clusters. Sevalla runs apps, databases and static sites on
Kubernetes, and the whole point is that you never have to think about Kubernetes. Push your
code and Sevalla builds it, runs it and scales it, with databases, object storage and static
sites next to it. You pay for the resources you use, and you never write a manifest.

This site is one of those static sites. If you'd rather ship than run clusters,
[give Sevalla a try](https://sevalla.com/?utm_source=kubestacks&utm_medium=referral&utm_campaign=website&utm_content=readme).

## Contributing

Fixes and improvements are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md). Problems with
the app itself go to [its repository](https://github.com/KubeStacks/KubeStacks/issues).

## Credits

- [Lucide](https://lucide.dev) icons (ISC License)
- [Inter](https://rsms.me/inter/) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/),
  via Fontsource (SIL Open Font License 1.1)
- The GitHub mark is GitHub's, and the Sevalla logo is Sevalla's; both are their trademarks,
  used here to link to them.

## License

The code is under the [Apache License 2.0](LICENSE), like the app.
