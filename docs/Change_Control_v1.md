# Change Control v1

Cloud-first Change Request (ECR/ECO) workflow on Amplify — same pattern as Registry spine.

## Locked design

| Item | Decision |
|------|----------|
| Object | Single **ChangeRequest** |
| Gating | Hybrid — free Registry edit while Draft; formal CR for Released / serious changes |
| Affected items | Subsystem → elements (same picker UX as Suppliers) |
| Status | `Draft → Submitted → In Review → Approved \| Rejected → Implemented → Closed` |
| Audit | Immutable **ChangeAuditEvent** rows (append-only) |
| Approve/reject | Simple action + optional comment |
| Bump link | Optional: `createChangeRequestFromBump` + `linkRevisionEventToChange` |
| Auth | Amplify **apiKey** (team-shared), identical to MapLayout / ProductOverlay |

## Models added

- `ChangeRequest` — id, title, summary, changeStatus, impact, affectedEntityIdsJson, requestedBy, approversJson, linkedRevisionEventIdsJson, createdAt, lastModified, modifiedBy
- `ChangeAuditEvent` — id, changeRequestId, at, by, action, detail

Existing Registry models are preserved in the package `amplify/data/resource.ts`.

## Files

```
amplify/data/resource.ts          ← replace (includes prior + Change models)
src/lib/changeStore.ts            ← new
src/pages/ChangeControl.tsx       ← new (route /changes already in App + Sidebar)
src/types/plm-change-snippet.ts   ← merge status + interfaces into types/plm.ts
src/main.tsx.snippet.ts           ← hydrateChangeStoreFromCloud after Registry hydrate
```

`productAmplify.ts` is reused as-is (same client exposes all models).

## Install (local: G:\Bedrock\PLMC)

1. **Schema** — replace `amplify/data/resource.ts` with package version.

2. **Copy sources**
   ```
   src/lib/changeStore.ts
   src/pages/ChangeControl.tsx
   ```
   Ensure App already has:
   ```tsx
   import ChangeControl from './pages/ChangeControl';
   // …
   <Route path="/changes" element={<ChangeControl />} />
   ```
   Sidebar already has Change Control → `/changes`.

3. **Types** — merge `plm-change-snippet.ts` into `src/types/plm.ts`:
   - Replace `ChangeRequestStatus` to include `Submitted`
   - Align `ChangeRequest` / `AuditEvent` shapes (or keep store-local types; page imports from changeStore)

4. **main.tsx** — after Registry hydrate:
   ```ts
   import { hydrateChangeStoreFromCloud } from './lib/changeStore'
   // …
   await hydrateConfigStoreFromCloud()
   await hydrateChangeStoreFromCloud()
   ```

5. **Sandbox + outputs**
   ```powershell
   cd G:\Bedrock\PLMC
   npx ampx sandbox
   # wait until ready + amplify_outputs.json written
   copy amplify_outputs.json public\amplify_outputs.json
   ```
   Confirm outputs contain `ChangeRequest`, `ChangeAuditEvent`, and `API_KEY`.

6. **Commit**
   ```powershell
   git add amplify/data/resource.ts public/amplify_outputs.json `
     src/lib/changeStore.ts src/pages/ChangeControl.tsx src/main.tsx
   git commit -m "Change Control v1: ChangeRequest + ChangeAuditEvent on Amplify"
   git push origin main
   ```

## Verify

1. Online app console: `[changeStore] hydrated from cloud`
2. `/changes` → New change request → add affected items → Submit → Start review → Approve
3. Audit trail shows immutable events
4. Second device (iPad) hard refresh → same CRs
5. Draft-only delete; free edit locked after Submit

## Optional: bump → CR

From System Registry bump UI (later polish):

```ts
import { createChangeRequestFromBump } from '../lib/changeStore';

const result = bumpEntityRevision(entityId, { comment });
if (result && /* user opted to open CR */) {
  createChangeRequestFromBump({
    title: `Rev ${result.record.revision}: ${entity.name}`,
    entityIds: [entityId],
    revisionEventId: result.record.id,
    summary: comment,
  });
}
```

## Next after deploy

- Soft prompt in Registry when bumping a **Released** entity (“Open CR?”)
- Suppliers cloud models (still localStorage)
- Phase 3 Requirements linking
