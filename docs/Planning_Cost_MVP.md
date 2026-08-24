# Planning & Cost MVP

Part-level cost analysis under each TAR™ subsystem, grouped expand/collapse, system roll-ups.

## Install

Copy into `G:\Bedrock\PLMC`:

| File | Path |
|------|------|
| `src/lib/planningStore.ts` | new |
| `src/pages/PlanningCost.tsx` | new or replace |

Ensure App has:

```tsx
import PlanningCost from './pages/PlanningCost';
// ...
<Route path="/planning" element={<PlanningCost />} />
```

Sidebar should link `/planning` (enable if currently disabled).

## Behavior

- Reads product tree from `configStore.getRegistryTree()` when available (includes Add child), else `TAR_TREE`.
- Every leaf under each subsystem is a cost line (component / software / interface / …).
- Fields: NRE, unit, qty, lead days, confidence, status, start, end, note.
- Line total = NRE + unit × qty.
- Subsystem and system rows are roll-ups only.
- Filter: missing cost (no NRE and no unit).
- Link icon opens System Registry for that entity.

## Persistence

`localStorage` key `vector-plm-planning-v1` until Amplify product store.

## Push

```powershell
git add src/lib/planningStore.ts src/pages/PlanningCost.tsx src/App.tsx src/components/layout/Sidebar.tsx
git commit -m "Planning & Cost: part-level estimates under subsystems with roll-ups"
git push origin main
```
