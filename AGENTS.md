# Build Verification Instructions

Before committing any changes:

1. Run `npm run typecheck; npm test; npm run build`
2. Ensure all checks pass (typecheck, 50 tests, clean build)
3. Commit with `git add -A; git commit -m "descriptive message"`

Do not skip verification steps. If tests fail, fix them before committing.
