---
name: Filtered workspace installs
description: A reliable workaround for adding dependencies to one package in this pnpm monorepo.
---

When adding a dependency to a single workspace package, run `pnpm --filter @workspace/<package> add <dependency>` from the repository root. The package helper may target the root manifest, and passing `--filter` through it can be interpreted as a package name rather than a pnpm option.

**Why:** Dependencies belong in the package that imports them; the workspace guards against accidental root-level additions.

**How to apply:** Use the workspace filter for app-specific or library-specific dependencies instead of adding them to the root package.
