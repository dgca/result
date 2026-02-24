# Plan: `@dgca/result` Library + Changesets Talk

## Decisions

- **Package name**: `@dgca/result`
- **Tests**: Vitest
- **Build target**: ESM-only
- **Slides**: Marp format (`default` theme) with full speaker notes (trim later if needed)
- **README**: Ships with commit 3 alongside the `result` function
- **npm auth**: OIDC trusted publishing (no NPM_TOKEN)

---

## Commit Sequence

Each commit is a discrete demo step for the talk. After each commit, we update `TALK.md` with the corresponding Marp slide(s) + speaker notes.

### Commit 1 — Initial Vite scaffold ✅

Already done. Vanilla Vite + TypeScript via `pnpm create vite`.

### Commit 2 — Configure Vite for library mode

- Remove app scaffold (`index.html`, `src/main.ts`, `src/counter.ts`, `src/style.css`, `public/`, `src/typescript.svg`)
- Create `vite.config.ts`:
  - `build.lib` entry at `src/index.ts`, name `result`
  - ESM-only output (`formats: ['es']`)
- Install `vite-plugin-dts` to generate `.d.ts` declarations
- Update `package.json`:
  - Name → `@dgca/result`
  - Remove `"private": true`
  - Add `repository` field (required for provenance — `https://github.com/dgca/result`)
  - Add `exports`, `main`, `types`, `files`

  - Simplify `build` script to `vite build`
  - Remove `dev` and `preview` scripts (not applicable for a library)
- Update `tsconfig.json`:
  - Remove `DOM`, `DOM.Iterable` from `lib`
  - Remove `vite/client` from `types`
  - Remove `allowImportingTsExtensions` (incompatible with declaration emit)
- Create empty `src/index.ts` as library entry point

### Commit 3 — Write the `result` function + README

- Implement `result()` in `src/index.ts` with TypeScript overloads:
  - Sync callback → returns `Result<T>` synchronously
  - Async callback → returns `Promise<Result<T>>`
  - `Result<T>` = `{ data: T; error: null } | { data: null; error: Error }`
  - Non-Error throws wrapped in `new Error(String(thrown))`
- Export the function and the `Result<T>` type
- Add `README.md` with install instructions and usage examples (sync + async)

### Commit 4 — Add tests with Vitest

- `pnpm add -D vitest`
- Add `"test": "vitest run"` to `package.json`
- Create `src/index.test.ts` covering:
  - Sync: success, thrown Error, thrown non-Error
  - Async: success, rejected Error, rejected non-Error
  - Type narrowing works correctly after checking `error`

### Commit 5 — Install and configure Changesets

- `pnpm add -D @changesets/cli`
- `pnpm changeset init`
- Walk through `.changeset/config.json` — what each field means

### Commit 6 — Add GitHub Actions release workflow (OIDC trusted publishing)

- `.github/workflows/release.yml`:
  - Triggers on push to `main`
  - Permissions: `contents: write`, `pull-requests: write`, `id-token: write`
  - Steps: checkout → setup pnpm → setup node 24 (with `registry-url`) → install → build → test
  - Uses `changesets/action@v1` with:
    - `publish: pnpm release` (or equivalent)
    - `GITHUB_TOKEN` for PR creation
  - **No NPM_TOKEN needed** — OIDC handles auth automatically
  - Provenance attestations are generated automatically
#### Why OIDC instead of NPM_TOKEN?

Traditional approach: generate a long-lived npm access token, store it as a GitHub secret, reference it in the workflow. Problems: tokens can leak, need manual rotation, have broad permissions.

OIDC trusted publishing (GA since July 2025): GitHub Actions mints a short-lived OIDC token per workflow run. npm verifies it against the trusted publisher config you set on npmjs.com. No secrets to manage, no tokens to rotate, and you get provenance attestations for free.

#### Requirements

- Node 24 (ships with npm ≥ 11.5.1, which supports OIDC)
- `id-token: write` permission in workflow
- `registry-url: 'https://registry.npmjs.org'` in `setup-node`
- `--access public` on first manual publish (scoped packages default to private)
- `repository` field in `package.json` (required for provenance)
- Trusted publisher configured on npmjs.com (after first publish)

### Commit 7 — First publish + configure trusted publisher + demo

This is a multi-step demo. The package must exist on npm before you can configure a trusted publisher (chicken-and-egg).

**Before the talk (or as live setup):**
1. Manually publish v0.0.1 from local: `npm publish --access public`
   - This creates the package on npmjs.com
2. On npmjs.com → `@dgca/result` → Settings → Trusted Publisher:
   - Provider: GitHub Actions
   - Organization or user: `dgca`
   - Repository: `result`
   - Workflow filename: `release.yml`
3. (Optional hardening) Settings → Publishing access → "Require 2FA and disallow tokens"

**Live demo flow:**
1. `pnpm changeset` → generate a changeset file (pick patch/minor/major + write summary)
2. Show the generated `.changeset/*.md` file — explain the format
3. Commit + push → GitHub Actions runs → changesets/action opens a "Version Packages" PR
4. Show the PR: it bumps `version` in `package.json` and collapses changesets into `CHANGELOG.md`
5. Merge the PR → GitHub Actions runs again → `changeset publish` runs `npm publish` with OIDC → published to npm
6. Show the package on npmjs.com with the provenance badge

---

## TALK.md Format

Marp slide deck:

```markdown
---
marp: true
theme: default
paginate: true
---

# Slide Title

Content here

<!--
Speaker notes go here.
These won't show in the slides but appear in presenter view.
-->

---

# Next Slide
```

Each commit maps to 1-3 slides. We build out TALK.md incrementally after each commit lands.

---

## Pre-Talk Checklist

Before giving the talk, ensure:

- [ ] npm org/user scope `dgca` exists on npmjs.com
- [ ] `@dgca/result` has been published at least once (v0.0.1 manual publish)
- [ ] Trusted publisher configured on npmjs.com for `release.yml`
- [ ] GitHub repo is public (required for provenance attestations)
- [ ] Node ≥ 22.14.0 installed locally
- [ ] npm ≥ 11.5.1 installed locally (or in CI via `npm install -g npm@latest`)

## Open Questions

None — all resolved. Ready to implement when you say go.
