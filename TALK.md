---
marp: true
theme: default
paginate: true
---

# Publishing Open Source Packages

Versioning with Changesets & GitHub Actions

By: Dan Cortes

<!--
Welcome! Today we're going to walk through the full lifecycle of publishing an open source npm package — from scaffolding the project to automated releases.

We'll build a small TypeScript utility library called `@dgca/result`, and along the way cover:
- Configuring Vite for library mode
- Writing the library code and tests
- Setting up Changesets for versioning
- Automating publishing with GitHub Actions and OIDC trusted publishing
-->

---

## Show of hands

- Who has contributed to open source?
- Who has published a library to NPM?
- Who is currently maintaining a library on NPM?

---

## Let's go 🤙

---

## Initial Setup

```bash
pnpm create vite
# Select: Vanilla + TypeScript
```

This gives us a standard Vite app scaffold — `index.html`, `main.ts`, `counter.ts`, etc.

We'll strip that down and reconfigure for a library.

<!--
We start with `pnpm create vite` and pick "Vanilla" + "TypeScript". This gives us a working app scaffold that we'll convert into a library.

Why Vite? It has excellent library mode built in — handles bundling, tree-shaking, and with a plugin, TypeScript declaration files. No need for a separate build tool.

Why pnpm? Honestly, personal preference, mostly, but it does seem to Just Work more than other package managers. Maybe except bun, hehe.
-->

---

## Vite Library Mode — What Changes

| App Mode (default)        | Library Mode                  |
| ------------------------- | ----------------------------- |
| `index.html` entry point  | `src/index.ts` entry point    |
| Outputs a website         | Outputs `.js` + `.d.ts` files |
| `dev` / `preview` scripts | Just a `build` script         |
| DOM types needed          | No DOM types                  |

<!--
The key mental shift: in app mode, Vite serves an HTML page. In library mode, there's no HTML — your entry point is a TypeScript file, and the output is a JavaScript module plus type declarations that other projects will import.

We remove everything app-related: index.html, the public folder, the CSS, the counter demo. What's left is a clean slate for our library code.
-->

---

## `vite.config.ts`

```ts
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
  },
});
```

<!--
Two key pieces here:

1. `build.lib` — tells Vite this is a library, not an app. We point it at our entry file, specify ESM-only output, and set the output filename.

2. `vite-plugin-dts` — generates `.d.ts` type declaration files from our TypeScript source. The `rollupTypes` option bundles all declarations into a single file, which is cleaner for consumers. Without this plugin, Vite only outputs JavaScript — no types.
-->

---

## `package.json` — Key Fields

```json
{
  "name": "@dgca/result",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/dgca/result.git"
  }
}
```

<!--
Let's walk through the important fields:

- `name`: Scoped under `@dgca` so it won't collide with existing packages on npm.
- `type: "module"`: This is an ES module package.
- `main` / `types`: The classic entry points — where to find the JavaScript and TypeScript declarations.
- `exports`: The modern replacement for `main`. The `types` condition goes first — TypeScript resolves it before `import`. This is the recommended pattern.
- `files`: Only ship the `dist` folder to npm. No source code, no config files.
- `repository`: Links back to GitHub. This is required later for provenance attestations.

We also removed `"private": true` (since we want to publish) and stripped out the `dev` and `preview` scripts (not useful for a library).
-->

---

## `tsconfig.json` — Changes

```diff
- "lib": ["ES2022", "DOM", "DOM.Iterable"],
+ "lib": ["ES2022"],

- "types": ["vite/client"],
  // removed — not needed for a library

- "allowImportingTsExtensions": true,
  // removed — incompatible with declaration emit
```

<!--
Three changes to the TypeScript config:

1. Remove DOM libs — this is a utility library, not a web app. It shouldn't depend on DOM types.
2. Remove `vite/client` types — those provide types for things like `import.meta.env` and CSS module imports, which are app-specific.
3. Remove `allowImportingTsExtensions` — this flag lets you write `import "./foo.ts"` with the extension, but it's incompatible with generating declaration files.

Everything else stays: strict mode, bundler module resolution, ESNext target.
-->

---

## What our library does

```ts
let data: SomeType | undefined;

try {
  data = await fetchSomething();
} catch (error) {
  console.error(error);
  return;
}

// Now use data...
```

The `try/catch` pattern is clunky — you often need to declare variables outside the block, handle scoping, and the control flow gets messy.

<!--
This is the pain point we're solving. try/catch has a few ergonomic issues:

1. Variable scoping — you have to declare `data` outside the try block with a wider type (often `| undefined`) so it's accessible after.
2. Control flow — you end up with early returns inside catch, or nested if/else chains.
3. Readability — the happy path and error path are split across separate blocks, making it harder to follow the logic.

Go and Rust have a nice pattern for this — they return errors as values. We can do something similar in TypeScript.
-->

---

## The Solution: `result()`

```ts
import { result } from "@dgca/result";

const { data, error } = await result(async () => {
  const response = await fetch("https://api.example.com/data");

  if (!response.ok) throw new Error("Request failed");

  return response.json();
});

if (error) {
  console.error(error.message);
  return;
}

// data is fully typed here — no `| undefined`
```

<!--
Wrap your potentially-throwing code in a callback passed to `result()`. You get back a discriminated union:

- `{ data: T, error: null }` on success
- `{ data: null, error: Error }` on failure

Once you check `error`, TypeScript narrows `data` to the correct type. No more `| undefined`, no awkward scoping.

This works with async functions too — if the callback is async, `result()` returns a Promise that you can await.
-->

---

## Sync Works Too

```ts
const { data, error } = result(() => {
  return JSON.parse(untrustedInput);
});
```

`result()` detects whether your callback returns a Promise. If it does, you get a Promise back. If not, it's fully synchronous.

<!--
The function uses TypeScript overloads to get the types right:

- `result(() => T)` returns `Result<T>` synchronously
- `result(() => Promise<T>)` returns `Promise<Result<T>>`

So you only need to `await` when your callback is actually async. The implementation checks `instanceof Promise` on the return value to decide which path to take.
-->

---

## Implementation

See: [/src/index.ts](/src/index.ts)

<!--
Let's walk through the implementation:

1. The `Result<T>` type is a discriminated union — `error` being `null` or not determines which branch you're in. TypeScript can narrow on this.

2. Two overload signatures give callers the right return type depending on whether their callback is sync or async.

3. The implementation wraps the callback in try/catch. If the callback returns a Promise, we chain `.then()` with both a success and error handler. If it's synchronous, we return directly.

4. Non-Error throws (like `throw "oops"`) get wrapped in `new Error(String(...))` so you always get a proper Error object.

That's the entire library — about 20 lines of code.
-->

---

## Adding Tests

```bash
pnpm add -D vitest
```

Vitest is the natural choice — it uses the same config and transform pipeline as Vite, so there's zero extra setup.

<!--
Since we're already using Vite, Vitest is the obvious testing tool. It understands our TypeScript config out of the box, runs fast, and needs no additional configuration files.

All we do is install it and add a `"test": "vitest run"` script to package.json.
-->

---

## Test Cases

See: [/src/index.test.ts](/src/index.test.ts)

<!--
We test both sync and async paths, covering:

- Success: the function returns a value, we get `{ data, error: null }`
- Error: the function throws an Error, we get `{ data: null, error }`
- Non-Error throw: something like `throw "string"` gets wrapped in `new Error()`
- Type narrowing: after checking `error`, TypeScript correctly narrows `data` to the expected type

Seven tests total. All passing.
-->

---

## Let's release v0.0.1

---

## Manually publish to npm

```
npm publish --access public
```

---

## Not so bad, right?

I really hope that worked 😬

---

## ...but does it scale?

- PRs come in, what changed?
- How do you generate changelogs?
- What semver version to pick?

---

## Versioning with Changesets

```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

Changesets is a tool for managing versioning and changelogs — especially useful for automated publishing.

<!--
Now that we have a working, tested library, we need a way to version and publish it.

You might be thinking: why not just bump the version in package.json and run `npm publish`? That works for a solo project, but it doesn't scale. You forget to update the changelog, you bump the wrong semver level, or you publish from a dirty working tree.

Changesets solves this by separating the "intent to release" from the actual version bump. You declare what changed and how significant it is, and changesets handles the rest.
-->

---

## How Changesets Work

1. **You make a change** to your code
2. **You create a changeset** — a markdown file describing the change
3. **When you're ready to release**, changesets consumes all pending changesets, bumps the version, and updates the changelog

Version bumps are **derived from changesets**, not manually decided at release time.

<!--
The workflow is:

1. You write code and commit it.
2. You run `pnpm changeset` and it asks you: is this a patch, minor, or major change? You write a short summary.
3. This creates a markdown file in the `.changeset/` directory — it's committed with your code.
4. When it's time to release, either you or CI runs `changeset version`, which reads all pending changeset files, determines the correct version bump (the highest wins — if any changeset says "major", it's a major bump), updates `package.json`, writes `CHANGELOG.md`, and deletes the consumed changeset files.
5. Then `changeset publish` runs `npm publish`.

We'll automate steps 4 and 5 with GitHub Actions in the next step.
-->

---

## `.changeset/config.json`

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.2/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

<!--
Let's look at the config that `changeset init` created:
- `changelog`: Which changelog format to use. The default generates a simple markdown list.
- `commit`: Whether changeset commands should auto-commit. We leave this false since CI handles it.
- `fixed` / `linked`: For monorepos — packages that should always be versioned together. Not relevant for us.
- `access`: Set to `"public"` — this is important for scoped packages like `@dgca/result`. Without this, npm would try to publish it as a private package.
- `baseBranch`: The branch that changesets compares against to detect what's changed.
- `ignore`: Packages to skip when versioning. Not relevant for a single package.
-->

---

## Changesets Accumulate

```
PR #1: fix(result): handle null throws     → patch changeset
PR #2: feat(result): add resultAll helper  → minor changeset
PR #3: fix(result): improve error messages  → patch changeset
```

At release time, changesets picks the **highest bump**:
`patch` + `minor` + `patch` = **minor** release

All three summaries end up in the CHANGELOG.

<!--
A key thing to understand: changesets accumulate between releases. You don't release after every PR — you batch them up.

Say you land three PRs, each with a changeset. One is a minor change, two are patches. When the version PR is created, changesets looks at all three and picks the highest bump level. Since one of them is minor, the release is a minor bump. All three summaries get concatenated into the CHANGELOG entry for that version.

This means individual contributors don't need to think about the overall version number. They just classify their own change, and changesets figures out the rest.
-->

---

## When NOT to Add a Changeset

Skip changesets for changes that **don't affect the published package**:

- Documentation updates (README, comments)
- CI/CD config changes
- Test-only changes
- Refactors with no public API impact
- Dev dependency updates

<!--
Not every commit needs a changeset. The rule of thumb: if a consumer of your package wouldn't notice the change, don't add a changeset.

Docs, tests, CI config, internal refactors — none of these change what gets published to npm. Adding changesets for them would create noise in your CHANGELOG and bump the version for no reason.

If you're using the changesets bot on GitHub, it'll comment on PRs that don't have a changeset. You can dismiss that with an empty changeset (changeset has a command for this), but usually it's fine to just not add one.
-->

---

## Automating Releases with GitHub Actions

We want pushing to `main` to automatically:

1. **If changesets exist** → Open a "Version Packages" PR
2. **If that PR is merged** → Publish to npm

<!--
This is where it all comes together. We're going to set up a GitHub Actions workflow that runs on every push to main.

The `changesets/action` does the heavy lifting. It checks if there are any pending changeset files. If there are, it runs `changeset version` to bump versions and update the changelog, then opens a PR with those changes. If there are no changesets (meaning the version PR was just merged), it runs `changeset publish` to publish to npm.

This means your release flow is: write code → add a changeset → push to main → review the version PR → merge it → package is published. Fully automated.
-->

---

## The Workflow File

```yaml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}
```

Runs on every push to `main`. The `concurrency` key ensures only one release job runs at a time.

<!--
The trigger is simple: push to main. We add a concurrency group so that if you push twice quickly, the second run waits for the first to finish rather than running in parallel. This prevents race conditions with version bumps.
-->

---

## Permissions — OIDC Trusted Publishing

```yaml
permissions:
  contents: write # Push version commits
  pull-requests: write # Open version PRs
  id-token: write # OIDC authentication with npm
```

No `NPM_TOKEN` secret needed!

<!--
This is the interesting part. Traditionally, you'd create a long-lived npm access token, store it as a GitHub secret, and pass it to the workflow. That token can leak, needs manual rotation, and has broad permissions.

Instead, we're using OIDC trusted publishing, which became generally available in July 2025. Here's how it works:

1. GitHub Actions mints a short-lived OIDC token for each workflow run
2. npm verifies that token against a trusted publisher configuration you set up on npmjs.com
3. If it matches — right repo, right workflow file — npm allows the publish
4. No secrets to store, no tokens to rotate, and you get provenance attestations for free

The `id-token: write` permission is what allows GitHub to generate that OIDC token. The other two permissions let the changesets action push commits and open PRs.
-->

---

## The Job

See: [/.github/workflows/release.yml](/.github/workflows/release.yml)

<!--
The job steps are straightforward:

1. Check out the code, set up pnpm and Node 24
2. The `registry-url` is required for OIDC to work — it tells the npm CLI which registry to authenticate with
3. Install, build, and test — we don't publish broken code
4. The changesets action handles the branching logic:
   - Pending changesets? → Run `changeset version`, commit the changes, open/update a PR
   - No pending changesets? → Run the `publish` command (`pnpm release`, which runs `changeset publish`)
   - `GITHUB_TOKEN` is provided automatically by GitHub — it's used for creating the PR, not for npm

Notice there's no `NPM_TOKEN` anywhere. The npm CLI automatically detects the OIDC environment and uses it for authentication.
-->

---

## Setting Up Trusted Publishing on npm

Before the first automated publish, you need to:

1. **Publish v0.0.1 manually** — `npm publish --access public`
2. **Configure trusted publisher** on npmjs.com:
   - Package settings → Trusted Publisher → GitHub Actions
   - Organization/user: `dgca`
   - Repository: `result`
   - Workflow filename: `release.yml`

<!--
There's a chicken-and-egg problem: you can't configure a trusted publisher for a package that doesn't exist on npm yet. So the first publish has to be done manually from your local machine.

After that, go to npmjs.com, find your package settings, and add a trusted publisher. You tell npm: "trust publishes from this specific GitHub Actions workflow in this specific repo." Fields are case-sensitive and must match exactly.

Once that's set up, you can optionally go to Publishing Access and select "Require 2FA and disallow tokens" for maximum security. This only blocks traditional token auth — OIDC continues to work.
-->

---

## Live Demo: Creating a Changeset

---

## Quick Semver Refresher

| Bump                        | When                               | Example                         |
| --------------------------- | ---------------------------------- | ------------------------------- |
| **Patch** `0.1.0` → `0.1.1` | Bug fixes, no API changes          | Fix edge case in error wrapping |
| **Minor** `0.1.0` → `0.2.0` | New features, backwards compatible | Add `resultAll()` helper        |
| **Major** `0.1.0` → `1.0.0` | Breaking changes                   | Rename `data` to `value`        |

<!--
Quick refresher on semantic versioning, since changesets will ask you to classify every change:

- Patch: you fixed something, but the API is identical. Consumers can upgrade without changing their code.
- Minor: you added something new, but existing code still works. New features, new exports, new options.
- Major: you changed or removed something that existing consumers depend on. They'll need to update their code.

The key rule: if someone upgrades and their code breaks, that should have been a major bump. Everything else is a judgment call between patch and minor.

For pre-1.0 packages (like ours at 0.x), the convention is looser — minor can include breaking changes. But once you hit 1.0, the contract is strict.
-->

---

## Making a change

Let's add some TSDoc comments to our function

## Adding a changeset

```bash
pnpm changeset
```

```
🦋 Which packages would you like to include?
  ◉ @dgca/result

🦋 What type of change is this for @dgca/result?
  ◉ patch
  ○ minor
  ○ major

🦋 Summary:
  > Add TSDoc comment to result function
```

<!--
Let's do it live. Running `pnpm changeset` starts an interactive prompt.

It asks three things:
1. Which packages are affected — in our case there's only one
2. Is this a patch, minor, or major change — since this is a new feature (the entire library), we'll pick minor
3. A summary of what changed — this goes directly into the CHANGELOG

After answering, it creates a markdown file in `.changeset/` with a random name.
-->

---

## The Generated Changeset File

```markdown
---
"@dgca/result": patch
---

Add TSDoc comment to result function
```

This file lives in `.changeset/` until it's consumed by a release.

<!--
The changeset file is simple markdown with YAML frontmatter. The frontmatter maps package names to semver bump types, and the body is the changelog entry.

This gets committed alongside your code. You can have multiple changeset files — one per change. When it's time to release, changesets reads all of them, picks the highest bump level (major > minor > patch), concatenates the summaries into the CHANGELOG, and deletes the consumed files.
-->

---

## The Release Flow

```
Push to main
    │
    ▼
GitHub Actions runs
    │
    ├── Changesets exist?
    │       │
    │       ▼
    │   Open "Version Packages" PR
    │       • Bumps version in package.json
    │       • Updates CHANGELOG.md
    │       • Deletes changeset files
    │
    └── No changesets? (PR was merged)
            │
            ▼
        Publish to npm via OIDC
```

<!--
Here's the full flow visualized:

1. You push code with a changeset file to main
2. GitHub Actions runs, sees pending changesets, and opens a "Version Packages" PR
3. That PR bumps the version in package.json, writes the CHANGELOG.md, and deletes the changeset files
4. You review the PR — does the version bump look right? Is the changelog accurate?
5. You merge the PR
6. GitHub Actions runs again — this time there are no changesets, so it runs `changeset publish`
7. npm publish happens via OIDC — no tokens needed
8. Your package is live on npm with a provenance badge

Let's see it happen.
-->

---

## What You Get on npm

- Versioned package on the registry
- Provenance badge — cryptographic proof of where it was built
- CHANGELOG.md — auto-generated from changeset summaries
- No tokens to manage or rotate

<!--
After the publish completes, your package page on npmjs.com shows a provenance badge. This tells consumers: this package was built from this exact commit, in this specific CI environment, and hasn't been tampered with.

The CHANGELOG is maintained automatically — every changeset summary becomes an entry. No more forgetting to update it.

And since we're using OIDC, there are no npm tokens sitting in GitHub secrets that could leak or expire.
-->

---

## Changesets in Monorepos

Everything we did today works for monorepos too — that's actually where Changesets shines most.

- Each package gets its own changeset entries and independent version bumps
- `linked` — packages that always share the same version number
- `fixed` — packages that always bump together, even if only one changed
- One `changeset version` run bumps all affected packages at once

<!--
We built a single-package library today, but Changesets was originally designed for monorepos. If you have a monorepo with multiple publishable packages, the workflow is the same — you just select which packages are affected when creating a changeset.

The `linked` and `fixed` config options we skipped earlier become important here. `linked` means packages always have the same version number — if one bumps to 2.0, they all do. `fixed` means they always bump together — even if a changeset only mentions one package, all fixed packages get a version bump.

The Version Packages PR will include version bumps and CHANGELOG updates for every affected package in a single PR. And `changeset publish` publishes all of them in sequence.

If you're maintaining a design system, a SDK with multiple entry points, or any multi-package project, this is where Changesets really pays for itself.
-->

---

## Resources

- [Vite Library Mode](https://vite.dev/guide/build.html#library-mode)
- [Changesets](https://github.com/changesets/changesets)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers)
- [`@dgca/result`](https://github.com/dgca/result)

---

# Thanks! 👋

Questions?

<!--
Links to everything we used today. The repo is public — feel free to clone it and use it as a template for your own packages.

Questions?
-->
