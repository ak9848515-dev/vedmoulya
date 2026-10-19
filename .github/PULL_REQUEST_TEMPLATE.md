## Summary

<!-- A concise description of what this PR changes and why. -->

## Related issues / tickets

<!-- Closes #<issue>, refs #<issue>, or NONE -->
<!-- Link to relevant ARC, ENG, DES, BLP documents if applicable -->

## Type of change

- [ ] feat: New feature
- [ ] fix: Bug fix
- [ ] refactor: Code restructuring
- [ ] test: Adding tests
- [ ] docs: Documentation only
- [ ] style: Formatting, styling
- [ ] chore: Build process, tooling
- [ ] perf: Performance improvement
- [ ] security: Security fix

---

## Pre-merge checklist

### Code quality

- [ ] `npm run typecheck` exits 0 (0 TypeScript errors)
- [ ] `npm run lint` exits 0 (0 ESLint failures across all scopes)
- [ ] `npm run format` exits 0 (Prettier clean)
- [ ] `npm run deps:cycles` exits 0 (0 internal dependency cycles)

### Tests

- [ ] `npm run test` exits 0 (all tests pass, 0 failures)
- [ ] `npm run test:coverage` exits 0 (all workspaces ≥ 80% threshold)
- [ ] New code is covered by new or existing tests
- [ ] No test was weakened, skipped, or deleted to make this pass

### Security

- [ ] No credentials, tokens, API keys, or secrets are introduced
- [ ] `npm audit --omit=dev --audit-level=high` exits 0 (production audit clean)
- [ ] Authentication, session, or cryptographic changes reviewed by security owner
- [ ] I have read the CONTRIBUTING.md guide and my code follows BLP-001/D02

### Accessibility & performance

- [ ] `npm run test:a11y` exits 0 (all production routes pass WCAG checks)
- [ ] Bundle size budget not exceeded (`bash scripts/check-bundle-size.sh` exits 0)

### Documentation

- [ ] README or docs updated if public API or behaviour changed
- [ ] Governance / audit documents updated if this is a significant release item
- [ ] ADR created if this is an architecture decision

### Build

- [ ] `npm run build -w apps/web` exits 0 (Next.js production build succeeds)
- [ ] `npm run config:contract` exits 0 (production config contract satisfied)

---

## Screenshots

<!-- If UI changes, add screenshots or Storybook links -->

## Notes for reviewers

<!-- Anything the reviewer should know: edge cases, follow-up items, known limitations. -->
