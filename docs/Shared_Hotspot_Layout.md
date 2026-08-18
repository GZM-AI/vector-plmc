# Shared Hotspot Layout (System Architecture zone map)

**Date:** 17 August 2026  
**Problem:** Zone positions lived only in browser localStorage. Opening Vector on iPad/Chrome (or any other device) fell back to `DEFAULT_HOTSPOTS` and ignored the layout designed on the workstation.  
**Goal:** One team-wide zone map so every device sees the same System Architecture.

---

## What this package does

| Piece | Role |
|-------|------|
| `src/lib/hotspotLayoutStore.ts` | Load / save abstraction. Cloud → local cache → defaults. |
| `src/pages/SystemArchitecture.tsx` | Uses the store. Drag = draft. **Save layout** = publish. |
| `amplify/data/HotspotLayout.snippet.ts` | Schema fragment to add when Amplify Data is wired. |

### Behavior

1. **On open** — tries Amplify Data first, then localStorage cache, then code defaults.
2. **While editing** — changes stay in React state (draft). Nothing is published until you click **Save layout**.
3. **Save layout** — writes local cache always; writes Amplify when the client is configured.
4. **Reset to defaults** — restores `DEFAULT_HOTSPOTS` and marks the view dirty so you can re-publish if desired.

Show/hide zones and last-selected subsystem remain local UI preferences (not shared).

---

## How to apply on the live machine

Live root: `G:\Bedrock\PLMC` (GitHub: `GZM-AI/vector-plmc`).

### 1. Copy files

```
src/lib/hotspotLayoutStore.ts          ← NEW
src/pages/SystemArchitecture.tsx       ← REPLACE
```

(Optional reference)  
`amplify/data/HotspotLayout.snippet.ts` — paste the model into your real `amplify/data/resource.ts` when ready.

### 2. Remove old localStorage-only helpers

The previous `DEFAULT_HOTSPOTS`, `STORAGE_KEY`, and `loadHotspots()` lived inside `SystemArchitecture.tsx`. They are now owned by the store. Do not leave duplicate definitions.

### 3. Run

```bash
npm run dev
```

- Open System Architecture → zones still default to hidden (previous change).
- **Edit zones** → drag/resize → **Save layout**.
- Subtitle shows source: `Team layout (cloud)` | `Layout from this device cache` | `Default layout`.

Until Amplify Data is live, Save still works: it updates the device cache and shows a clear message that cloud sync will activate when the model is deployed.

---

## Wiring Amplify Data (when ready)

1. Add the `HotspotLayout` model from the snippet into `amplify/data/resource.ts`.
2. Deploy / sandbox so the model exists.
3. At app boot (e.g. in `main.tsx` or a small `amplify.ts` helper), after the Amplify client is created:

```ts
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource'; // your path
import { configureHotspotAmplify } from './lib/hotspotLayoutStore';

const client = generateClient<Schema>();
configureHotspotAmplify(client as any);
```

After that, **Save layout** writes the shared record (`id = tar-system-architecture-v1`) and every device that loads the page gets the same map.

---

## Interim: lock designed positions into the repo (optional)

If you want every deploy to ship your current designed map *before* Amplify Data is live:

1. On the workstation, open System Architecture → Edit zones → arrange → Save layout.
2. In DevTools → Application → Local Storage → copy the JSON from `vector-tar-hotspots-v3`.
3. Paste those `left/top/width/height` values into `DEFAULT_HOTSPOTS` inside `hotspotLayoutStore.ts`.
4. Commit + push + redeploy.

New browsers and the iPad will then load that layout from the bundle even with an empty localStorage. Later, cloud overrides the defaults when present.

---

## What stays local on purpose

- Show / hide zones toggle  
- Active subsystem selection  
- Edit mode on/off  

These are session UI state, not product architecture.

---

## Success criteria

| Check | Expected |
|-------|----------|
| Workstation: design zones → Save layout | Message confirms save |
| iPad / other browser: open System Architecture → Show all zones | Same positions as workstation (after cloud is live, or after DEFAULT_HOTSPOTS update) |
| New browser with empty storage | Defaults, or cloud layout if published |
| Drag without Save | Other devices unchanged |

---

## Next related work

This is the pattern to reuse when moving Phase 1 `configStore` (revisions + baselines) from localStorage to Amplify Data: same load order, explicit publish/save, local cache for offline.
