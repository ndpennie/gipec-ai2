# Receiving-site changes (not applied remotely)

The connected GitHub integration can read GIPEC-AI2/gipec-ai2.github.io, but its create-tree write returned HTTP 403 "Resource not accessible by integration". These files preserve the reviewed receiving changes for an authorized maintainer. Do not deploy only the exporter and assume migration is fixed.

Based on receiving main 0b211b2380f973921f1ab464df6b46fa9db1d8e5.

In a checkout of GIPEC-AI2/gipec-ai2.github.io:

1. Review and apply index.patch with git apply --check followed by git apply. Resolve any upstream differences explicitly.
2. Copy migrate.html from this directory to the repository root.
3. Copy migration.js from the parent directory to the repository root.
4. Copy tests/migration.test.cjs from the parent directory and the two tests in this directory into the receiving tests/ directory.
5. Copy MIGRATION_REVIEW.md from the parent directory.
6. Run node --test tests/*.test.cjs. All 16 receiving tests passed locally on the patched copy with synthetic data.
7. Create a receiving PR, perform the browser acceptance checks in MIGRATION_REVIEW.md, and coordinate both sites' release.

The source repository has 14 passing synthetic tests. Browser/PWA end-to-end testing is still required. Nothing has been deployed or merged by this change.
