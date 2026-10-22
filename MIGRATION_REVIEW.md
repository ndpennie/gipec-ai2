# Project Spear migration review and v2 rollout

Reviewed source main e9bb1bb3bf5c78432ca0b80d45511c5bfb8f3391 and receiving main 0b211b2380f973921f1ab464df6b46fa9db1d8e5. This is a source review with synthetic tests, not evidence that actual user records were lost.

## Findings

| Path / component | Omission or security condition |
| --- | --- |
| Original export fallback | More than 300 cases: only first 300 exported. Every case loses media and thumb; spear_refimgs is deleted. Malformed case JSON becomes an empty array. |
| Original fallback URL | Base64 is reversible, not encryption. The fragment contains the setup key and case data. Fragments are not included in ordinary HTTP requests, but are readable by destination scripts and may remain in browser history, synced URLs, screenshots or copied links. URL length/resource limits can break delivery. |
| Original popup | Sends persisted strings, without the 300 cap, to an exact target origin (good). Does not wait for receiver readiness or acknowledgment. Posting a message does not prove it was received or persisted. Closes with a premature success message. |
| Original receiver | Verified in GIPEC-AI2/gipec-ai2.github.io/index.html. Merges by url/captured/name; distinct cases with equal or missing fields can be skipped. Truncates merged results to 600; existing records can consume all slots. Reports incoming count, not saved count. |
| Original receiver writes | Replaces setup key before saving cases; quota/storage failure can leave partial state. Extra settings are ignored when destination keys already exist. Checks origin but not the specific opened window. Fragment import is not authenticated and accepts extra storage names without an allowlist. |
| Both paths | Require a setup key even when cases exist. Only transfer a fixed subset of settings, omitting optional service keys/preferences. Can only recover data persisted in this browser/profile at the old origin. |
| Pre-migration app persistence | itemsSave caps at 600 and strips thumbnails; quota fallback reduces to 120 and can remove the saved case key entirely. libSave truncates text/total size and removes images. refImgSave caps at 500. These are conditions in code, not proof of an incident. |

## Implemented design

- Copy every persisted spear_ setting as its original string, without slicing cases or stripping fields. Validate case JSON and counts; fail visibly on malformed data. No source deletion or credential-required gate.
- Explicit user actions on both pages. Popup v2 uses exact target origin and checks origin plus source window, transfer ID, digest and count before acknowledging. Receiver sends acknowledgment only after persistence/readback. Timeout is unconfirmed, not success.
- Blocked-popup fallback downloads AES-256-GCM encrypted JSON with fresh salt/IV and PBKDF2-SHA-256 (600,000 iterations). Passphrase is not placed in the file or URL. Minimum 16 characters; use a strong unique passphrase. Wrong password/tampering fail closed.
- Dedicated receiver page pauses before import, persists the complete incoming snapshot in IndexedDB, rejects any differing destination value, writes localStorage and compares every saved string. On write failure, attempts rollback and reports whether rollback failed. Identical retries are idempotent. No ambiguous deduplication or automatic credential replacement.
- No plaintext export, query, fragment, logging or network transport of credentials in the new migration pages. The intentional popup transfer and restored browser storage still contain plaintext credentials. Same-origin scripts/extensions with access remain a trust boundary; encryption protects the downloaded file, not a compromised browser.
- Receiving app case/library/reference-image saves preserve full records and retained attachments and report quota failures without shrinking/deleting prior saved data.

## Coordinated deployment

1. Deploy receiving migration.js, migrate.html and index.html together. Its old migration button opens the new page; legacy fragments are scrubbed and rejected rather than silently imported. Direct migrate.html also works on already-set-up devices.
2. Deploy source export.html and the identical migration.js together. Old receiver/new exporter or new receiver/old exporter is intentionally not silently compatible. During a staggered rollout, retry after both updates; do not claim migration completed.
3. Refresh both sites and installed PWAs. Existing service worker is network-first but can serve cached pages offline; confirm the v2 pages and scripts are actually loaded.
4. Run browser acceptance on both deployed origins using only synthetic records: blocked popups, delayed popup load, no opener, timeout, wrong origin/window, duplicate retry, existing destination, storage disabled/full, reload after import, encrypted download/reimport, wrong password and corrupted file.
5. Verify all fields and rendered attachments after reopening the dashboard and saving again. Keep the original data and encrypted backup until this passes.

## Limits and remaining work

- No real case records or credentials were accessed. Node tests cover the core and mocked page protocol; real browser/PWA, download, IndexedDB and deployed-origin end-to-end acceptance remains required before merging/releasing.
- Automatic merge is deliberately unavailable: different destination values stop the import. Use a separate empty browser profile with the encrypted file, or implement a reviewed conflict-resolution workflow. Do not clear an existing destination just to bypass the guard.
- localStorage multi-key writes are not crash-atomic. The IndexedDB recovery snapshot is committed first; a browser termination can still leave partial destination keys. Retrying the same snapshot completes identical partial writes. Other active tabs may race: close them. A future single-database transactional application storage design would remove this limitation.
- Recovery snapshots contain sensitive plaintext in browser IndexedDB under spear-migration-recovery/snapshots, keyed by digest. They are retained for recovery. Add a reviewed UI for recovery/retention cleanup once dashboard verification is complete; do not clear browser storage while relying on them.
- File importer refuses files over 100 MiB explicitly; no partial import. Browser storage/quota/memory can impose lower limits. Source data and encrypted backup remain the recovery paths.
- External URLs and blob: attachment references are preserved as strings, but do not embed the underlying files. Unsaved in-memory records, already stripped media, data in another profile/origin, and remote-only cases cannot be reconstructed by this exporter. Inventory/download external assets separately.
- The old application's persistence caps remain in its index.html; migrate saved data promptly and retain any unsaved old-app work separately. New receiver log/rule retention and backend sync remain outside this migration fix and need separate retention review.
- Historical fragment exposure is not established. If a real setup URL/fragment was shared or exposed, rotate that credential through the backend's established process.

## Synthetic validation

Run node --test tests/*.test.cjs with Node 24. Tests include 0/300/301/600/1001 cases, Unicode, media/thumbnails/reference images, optional keys, malformed JSON, missing setup key, conflicting values, quota rollback, repeat import, encryption round trip, wrong passphrase and tampering. Source tests also verify blocked popups, message origin/window/ID/count and acknowledgment timeout. Receiver tests verify confirm-before-import, stage-before-write, no acknowledgment on failure, and full case/library/reference persistence.
