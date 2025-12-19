# PR Request Template

Thank you for contributing to BitPay Bitcore!

Please fill out the sections below to help us review your pull request efficiently.

## Summary

- What does this PR do?
- Why is it needed?

### Title Conventions

Prefix the PR title with a component tag for clarity, following patterns seen in recent work (e.g., kajoseph’s PRs):
- Examples: [BWS], [BCN], [CLI], [CWC], [BCC], [Libs], [BWC]
- For broad repo-wide changes, use [*] or a suitable umbrella tag.

### Component(s)

Select one or more affected components:
- [ ] BWS (Bitcore Wallet Service)
- [ ] BCN (Bitcore Node)
- [ ] CLI (bitcore-cli)
- [ ] CWC (Crypto Wallet Core)
- [ ] BCC (bitcore-client)
- [ ] Libs (bitcore-libs)
- [ ] BWC (bitcore-wallet-client)
- [ ] Other: __________

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Performance improvement
- [ ] Test-related (tests/coverage)
- [ ] Docs update
- [ ] Build/CI
- [ ] Chore/Maintenance

## Changes

- List the key changes introduced by this PR.

## Breaking Changes

- [ ] No breaking changes
- [ ] Breaking changes (describe below)

If breaking, explain the impact and migration path:
- Impact:
- Migration steps:

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed

Describe the testing strategy and results:
- Steps to reproduce/verify:
- Environments tested:
- Relevant test cases:

## Screenshots or Logs (if applicable)

- Include any relevant output, screenshots, or logs.

## Security Considerations

- [ ] No security-related changes
- [ ] Security-related changes (describe below)

If security-related, explain risk and mitigation:
- Risk:
- Mitigation:
- Additional notes:

## Documentation

- [ ] README/Docs updated
- [ ] Not required

Links or notes for doc updates:
- Docs PR/Section:
- User-facing changes documented:

## Checklist

- [ ] Title follows component tag convention (e.g., [BWS], [BCN], [CLI], [CWC], [BCC], [Libs], [BWC], [*])
- [ ] Linked to an existing issue/discussion (e.g., closes #123)
- [ ] Code follows project style and lint rules
- [ ] Commit messages follow Conventional Commits
- [ ] All tests pass locally (`npm test` or applicable commands)
- [ ] CI checks pass (when applicable)
- [ ] Includes necessary configuration updates (if any)
- [ ] No sensitive information committed
- [ ] Reviewed performance implications (if relevant)
- [ ] Verified cross-platform compatibility (Linux/macOS/Windows if applicable)

## Additional Notes

- Anything reviewers should pay extra attention to?
- Dependencies or follow-ups required?