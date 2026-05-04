# Submissions, evaluations, and cleanup

Wires the submission/evaluation flow end-to-end, removes the leftover frontend mock layer, and tightens per-team authorization for students.

## What's in it

### Frontend
- **Submission files tab** is grouped by team. Students see only their own team; teachers/admins see all teams.
- **File upload** for students (10 MB cap, with helper text and client-side validation that surfaces a precise message before sending).
- **Per-team Download** plus **Download all** for teachers/admins, wired via the streaming `DownloadSubmission` RPC.
- **Inline evaluation form** per team (numeric score + feedback) with **Save** and **Save all evaluations (N)**, hitting `Create`/`UpdateProjectEvaluation` automatically depending on whether one already exists.
- **Mock API removed** entirely. `api.js` rewritten as direct gateway calls — backend errors now surface instead of being silently swallowed by the hybrid-mode fallback. `mockApi.js` and `config.js` deleted.
- New gRPC-web wiring for `getTeam`, `downloadSubmission`, `submitProject`, `deleteSubmission`, and the three evaluation RPCs.
- **`resolveKnownUser` no longer falls back to "any user with the same role"** — that fallback was making the team-membership UI disagree with the backend (UI said "you're not in a team", backend said "you already are").
- **Dialog-blind error fix** in AdminUsers, Notifications, and Subjects dialogs: validation errors and save failures now render inside the modal with a submitting state, instead of being set on a page-level Alert hidden behind the modal.
- **Subjects pages**: project cards back to one-per-line with a fixed-width chip column so the text/tag split is consistent across cards.

### Router (Rust)
- **Per-team auth scoping for students** on `GetTeam`, `DownloadSubmission`, `SubmitProject`, and `DeleteSubmission`. A new `ensure_student_can_view_team` helper fetches the `TeamDetail` once and reuses it (so `GetTeam` for students costs no extra round-trip).
- **`RemoveStudentFromSubject`** moved from `ADMIN_ONLY` to `TEACHER_OR_ADMIN` so subject teachers can unenroll students.
- **gRPC max message size raised to 12 MiB** on the server (browser → router) and on the project-service client (router → project-service), giving ~2 MiB of headroom over the 10 MB user-facing cap for protobuf framing.

### Project-service (Java / Spring)
- `ProjectEntity.submissionSizeLimit` gains `columnDefinition = "BIGINT NOT NULL DEFAULT 10485760"` so Hibernate's `update` mode can `ALTER TABLE ADD COLUMN` against existing rows, and legacy rows backfill to 10 MB.
- `ProjectService.createProject` defaults the field to 10 MB when the request doesn't supply one.
- `ProjectSubmissionService.submit` treats `null`/`<= 0` as the 10 MB default before unboxing — fixes the `"An unexpected internal error occurred: null"` NPE.
- `spring.grpc.server.max-inbound-message-size = 12 MiB`.

## How downstream services use the forwarded user context

The router (`gateway::ForwardContext`) attaches the original `authorization: Bearer <jwt>` header to every downstream gRPC call. The JWT already carries `sub` (user id) and `role`, so downstream services can identify the caller without a round-trip to auth-service.

### tonic example (Rust)

`Cargo.toml`:
```toml
[dependencies]
tonic = "0.14"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
base64 = "0.22"
```

```rust
use base64::Engine;
use serde::Deserialize;
use tonic::{Request, Status};

#[derive(Clone, Debug, Deserialize)]
pub struct CallerContext {
    pub sub: String,        // user id
    pub role: String,       // "student" | "teacher" | "admin"
    #[serde(default)]
    pub exp: i64,
}

/// Decode-only (no signature check): the router has already validated the JWT
/// before forwarding. If you need re-validation, swap this for `jsonwebtoken::decode`
/// with the shared signing key from auth-service.
pub fn caller_from_request<T>(request: &Request<T>) -> Result<CallerContext, Status> {
    let raw = request
        .metadata()
        .get("authorization")
        .ok_or_else(|| Status::unauthenticated("missing authorization metadata"))?
        .to_str()
        .map_err(|_| Status::unauthenticated("authorization is not ASCII"))?;

    let token = raw
        .strip_prefix("Bearer ")
        .ok_or_else(|| Status::unauthenticated("authorization is not a Bearer token"))?;

    let payload_b64 = token
        .split('.')
        .nth(1)
        .ok_or_else(|| Status::unauthenticated("malformed JWT"))?;
    let payload = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|_| Status::unauthenticated("malformed JWT payload"))?;
    serde_json::from_slice::<CallerContext>(&payload)
        .map_err(|_| Status::unauthenticated("malformed JWT claims"))
}
```

Usage inside any tonic handler:

```rust
async fn list_my_things(
    &self,
    request: Request<ListMyThingsRequest>,
) -> Result<Response<ListMyThingsResponse>, Status> {
    let caller = caller_from_request(&request)?;

    if caller.role != "admin" && caller.role != "teacher" {
        return Err(Status::permission_denied("teachers/admins only"));
    }

    let things = self.repo.list_for(&caller.sub).await?;
    Ok(Response::new(ListMyThingsResponse { things }))
}
```

For language-agnostic reference, the existing services do the same on their side:
- `services/project-service/.../utils/JwtUtils.java` — Java/Auth0 JWT decode, also no signature check (router-validated).

If you need authoritative validation in your service (e.g., you don't trust the upstream), validate the JWT against auth-service's signing key with `jsonwebtoken::decode::<CallerContext>(token, &DecodingKey::from_secret(secret), &Validation::new(Algorithm::HS256))`.

### evaluation-service: strip `Bearer ` before base64-decoding the JWT

Saving an evaluation was returning `"Invalid JWT: Base64 error: Invalid symbol 32, offset 6"` from **evaluation-service**. Both frontend and router were correctly forwarding `authorization: Bearer <jwt>`; the problem was that `services/evaluation-service-rust/src/infrastructure/api/grpc.rs::get_user_id` passed the *full* header value into `jsonwebtoken::dangerous::insecure_decode`, so the base64 decoder hit the space inside `"Bearer "` (ASCII 32 at byte 6).

Fixed in this PR by stripping the prefix inside the helper:

```rust
fn get_user_id(authorization: &str) -> Result<String, anyhow::Error> {
    let token = authorization
        .strip_prefix("Bearer ")
        .unwrap_or(authorization);
    let data = jsonwebtoken::dangerous::insecure_decode::<Claims>(token)?;
    Ok(data.claims.sub)
}
```

`unwrap_or` keeps it tolerant of clients that send a bare token. Per-team **Save** and **Save all evaluations** in the Files tab now succeed.

## Deploy notes

```bash
docker compose build router-rust project-service
docker compose up -d router-rust project-service
```

On first boot the project-service `ALTER TABLE` adds the `submission_size_limit` column with the 10 MB default to any existing rows. No manual migration step required.

## Test plan

- [ ] Open Dashboard as student/teacher/admin — no error, project counts populate.
- [ ] As a student in a team: Submission files tab shows only own team. Submit a file → it appears with size + content type. Submit again → previous file is replaced.
- [ ] As a teacher: Submission files tab shows every team. Per-team Download works. Save / Save all evaluations work; reopening the page shows the saved score and feedback.
- [ ] Submitting a > 10 MB file is blocked with a readable client-side message, no upload attempted.
- [ ] Try `grpcurl` to call `DownloadSubmission` with another team's id while logged in as a student → `permission_denied`.
- [ ] Admin/teacher can unenroll a student from a subject; non-admin teacher can only do so on subjects they're assigned to.
- [ ] Admin Users / Notifications / Subjects dialogs: invalid input keeps the dialog open with an error inside; save failures show inside the dialog; success closes the dialog and shows a page-level toast.
