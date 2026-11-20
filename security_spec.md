# Security Specification — Viral Video Pro (Firestore)

## 1. Data Invariants
1. **Default-Deny Baseline**: Every path not explicitly matched is denied for both `read` and `write`.
2. **Verified Admin Control**: Only verified Google accounts matching the bootstrapped administrator email (`abirislam202654@gmail.com`) or present in `/admins/{uid}` with `email_verified == true` may create, edit, delete, or read unpublished draft content, categories, homepage sections, or site settings.
3. **Public Draft Isolation**: Unauthenticated and non-admin visitors may ONLY `get` or `list` documents in `/videos/{videoId}` where `is_published == 1`. Querying unpublished videos as a non-admin returns `PERMISSION_DENIED`.
4. **PII Isolation**: `/admins/{adminUid}` stores administrator email addresses and is strictly restricted to admins (or a verified signed-in user reading only their own UID doc); public visitors cannot read `/admins`.
5. **Relational & Referential Integrity**: Creating a video with a non-null `category_id` requires that `/categories/{category_id}` exists.
6. **Strict Schema & Size Guards**: Every document write validates exact key allowlists (`hasAll` + `hasOnly`), string length bounds (preventing Denial-of-Wallet 1MB payloads), immutable `createdAt`, and server-enforced `request.time` timestamps.
7. **Controlled View Counter Action**: Public visitors watching a published video may ONLY increment `views` by exactly `+1` and update `updatedAt` to `request.time` — no other fields can be modified.

## 2. The "Dirty Dozen" Adversarial Payloads
Each payload below must return `PERMISSION_DENIED`:

1. **Unverified Admin Email Spoof**: User with `email: "abirislam202654@gmail.com"` and `email_verified: false` tries to create `/videos/v1`.
2. **Self-Promoted Admin**: Non-admin authenticated user tries to write `/admins/{theirUid}` with `{ role: "admin" }`.
3. **Unpublished Draft Leak (GET)**: Public/non-admin user calls `get` on `/videos/draft1` where `is_published == 0`.
4. **Unfiltered List Scrape**: Public/non-admin user queries `/videos` without `where("is_published", "==", 1)`.
5. **Shadow Field Injection on Video**: Admin sends `create` to `/videos/v2` containing extra ghost field `isVerified: true`.
6. **Document ID Poisoning**: Admin tries to create `/videos/bad$id..123` (invalid characters) or a 200-char doc ID.
7. **Client Timestamp Forgery**: Admin sends `create` on `/categories/c1` with a backdated `createdAt` instead of `request.time`.
8. **Immutable `createdAt` Mutation**: Admin sends `update` on `/videos/v1` attempting to alter `createdAt`.
9. **Public Title Tampering via View Action**: Public visitor sends `update` on published `/videos/v1` changing `views` +1 AND modifying `title` or `video_url`.
10. **View Inflation Attack**: Public visitor sends `update` on `/videos/v1` setting `views` to `existing.views + 999999`.
11. **Orphan Category Reference**: Admin creates `/videos/v3` with `category_id: "nonexistent-cat"`.
12. **PII Directory Scrape**: Public or non-admin user calls `list` or `get` on `/admins`.
