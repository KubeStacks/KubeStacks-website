# Contributing to kubestacks.com

Thanks for helping! Fixes, polish and pull requests are all welcome.

## Before you start

- **The app or the website?** This repository is the website. Bugs and ideas for the app go
  to [its repository](https://github.com/KubeStacks/KubeStacks/issues).
- **Bigger changes:** open an [issue](https://github.com/KubeStacks/KubeStacks-website/issues)
  first for anything beyond a small fix (a new section, a new demo, a change in tone), so we
  can agree on the approach.
- **Security issues:** please don't open a public issue. See [SECURITY.md](SECURITY.md).

## Setting up

```sh
nvm use          # Node.js 26 (24 also works)
npm ci
npm run dev      # http://localhost:4321
```

## Making a change

1. Create a branch from `main`.
2. Keep the change focused, and match the style of the code around it.
3. Check it in both themes, on a phone and on a desktop. Nothing may scroll sideways, shift
   as the page loads, or move the page while the demos run.
4. Add or update the end-to-end tests in `tests/e2e/` for what you changed. They drive the
   built site like a visitor would; `tests/e2e/fixtures.ts` explains what's set up for them.
5. Run the checks:

   ```sh
   npx playwright install chromium webkit   # once
   npm run verify   # format check, lint, typecheck, e2e tests, 100% coverage
   ```

6. Open a pull request describing what changed and why, with screenshots for visual changes.

## Coverage

The project keeps **100% end-to-end coverage** of statements, branches, functions and lines
for the TypeScript in `src/`, enforced in CI. `npm run coverage` prints the report and writes
an HTML version to `coverage/index.html`, and `npm run coverage:check` lists every uncovered
line.

When a line is hard to reach, first ask whether it's needed: a fallback for something that
can't happen can usually go. Otherwise, set up the realistic situation in a test: a visitor's
computer with an init script, an answer from GitHub with `github()` from
`tests/support/releases.ts`, or time with `page.clock`.

## Code style

- TypeScript everywhere, `strict` mode. Prettier and ESLint are enforced in CI
  (`npm run format` fixes formatting).
- No UI framework on the page: components are `.astro` files, and behavior is a small script
  per section in `src/scripts/`, mounted on a `data-*` attribute.
- Colors come from the tokens in `src/styles/global.css`, which follow the app's. Use the
  status colors only for health, and always pair them with an icon and a label, as the app
  does.
- Words matter as much as pixels: plain, specific and friendly, the way the rest of the site
  reads.
