/**
 * Add this model to amplify/data/resource.ts (inside a.schema({ ... }))
 *
 * Single shared record holds the designed zone map for TAR™ System Architecture.
 * id is fixed: "tar-system-architecture-v1" (see LAYOUT_RECORD_KEY in hotspotLayoutStore).
 */

/*
  HotspotLayout: a
    .model({
      // Use a stable string id — we always read/write LAYOUT_RECORD_KEY
      zonesJson: a.string().required(), // JSON.stringify(Hotspot[])
      updatedAt: a.datetime(),
      updatedBy: a.string(),
      note: a.string(), // optional human note e.g. "Aligned to Alpha Build 2 silhouette"
    })
    .identifier(['id']) // default; keep explicit if your schema style requires it
    .authorization((allow) => [
      allow.authenticated().to(['read']),
      // tighten write to a role later if needed; for now any authenticated user can publish
      allow.authenticated().to(['create', 'update', 'delete']),
    ]),
*/
