# Security

This project exposes write tools for Markdown vaults. Treat deployments as consequential systems.

## Required Controls

- Store API keys and GitHub tokens only in the serverless provider secret store.
- Use a fine-grained GitHub token scoped to one repository.
- Keep write access two-step: propose, review, commit.
- Reject non-Markdown paths, absolute paths, traversal, and backslashes.
- Treat stale base SHA, token mismatch, and digest mismatch as hard failures.
- Do not log secrets, token material, full request headers, or private vault content.

## Reporting

If you find a security issue, do not open a public issue with exploit details. Use GitHub private vulnerability reporting if enabled on the repository, or contact the repository owner through the configured GitHub security channel.
