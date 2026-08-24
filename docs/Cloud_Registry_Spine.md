# Cloud Registry Spine

Shared Amplify Data for System Registry (team-wide), same pattern as zone `MapLayout`.

## Models (apiKey)

- `MapLayout` — existing hotspots
- `ProductOverlay` — revision/status/name/description/notes per entityId
- `ExtraEntity` — Add child nodes
- `RevisionEvent` — bump history
- `BaselineRecord` — baselines

## Install

1. Replace `amplify/data/resource.ts` with package version (includes MapLayout + new models).
2. Copy:
   - `src/lib/productAmplify.ts`
   - `src/lib/configStore.ts` (replace)
   - `src/main.tsx` (replace — keeps hotspot + adds product hydrate)
3. Ensure `revisionUtils.ts`, `revisionSeed.ts`, `baselinesSeed.ts`, `types/plm.ts` still present.

## Deploy backend

```powershell
cd G:\Bedrock\PLMC
npx ampx sandbox
# wait until ready + amplify_outputs.json written
copy amplify_outputs.json public\amplify_outputs.json
```

Confirm outputs contain `ProductOverlay` and `API_KEY`.

```powershell
git add amplify/data/resource.ts public/amplify_outputs.json src/lib/productAmplify.ts src/lib/configStore.ts src/main.tsx
git commit -m "Cloud Registry spine: ProductOverlay, ExtraEntity, RevisionEvent, BaselineRecord"
git push origin main
```

## Verify

1. Online app console: `Data client authMode: apiKey` and `[configStore] hydrated from cloud`
2. Edit description / bump / add child on workstation
3. Console: `overlay cloud ok` / `extraEntity cloud ok`
4. iPad hard refresh → same data

## Optional: migrate old localStorage once

In browser console on workstation (after client configured), you can expose later a button; for now from a temporary UI or:

If you had important local-only data, call `uploadLocalConfigToCloud()` from a one-off admin control (function is exported from configStore).

## Next

- Planning + Suppliers cloud models
- Change Control on Amplify from day one
