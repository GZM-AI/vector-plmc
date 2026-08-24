/**
 * TAR™ (Trajectory Adjusting Rifle) — Canonical Seed Dataset
 * Vector · Product Lifecycle Management
 *
 * Hierarchy (strict four levels):
 *   TAR™ (System)
 *    └── Subsystem
 *         └── Component
 *              └── Element  (kind: hardware | software | interface | integrator | other)
 *
 * Vertical Integrators = per-subsystem candidates only (not shared),
 * modeled as Element + kind: 'integrator' under each subsystem's Core Elements component.
 *
 * Phase 0: every entity carries revision + ReleaseStatus + lastModified/modifiedBy
 * and optional attachmentIds linking to Document records (see documentsSeed.ts).
 */
import type {
  ResourceEntity,
  StructuralEntityType,
  ReleaseStatus,
  LifecycleStage,
  Classification,
  ElementKind,
} from '../types/plm';
import { DOCUMENTS } from './documentsSeed';

// Re-export types used by pages so existing imports from this module keep working
export type { ResourceEntity, StructuralEntityType as EntityType, ReleaseStatus, ElementKind };
export type EntityStatus = ReleaseStatus; // alias for gradual migration of STATUS_STYLE maps

/** @deprecated Prefer ReleaseStatus; kept for any residual maturity display */
export type { LifecycleStage };

const now = new Date().toISOString();

function e(
  partial: Omit<
    ResourceEntity,
    'createdAt' | 'lastModified' | 'revision' | 'status' | 'attachmentIds'
  > & {
    status?: ReleaseStatus;
    revision?: string;
    lifecycleStage?: LifecycleStage;
    lastModified?: string;
    modifiedBy?: string;
    attachmentIds?: string[];
    classification?: Classification;
    kind?: ElementKind;
  }
): ResourceEntity {
  return {
    status: 'Draft',
    revision: 'A',
    createdAt: now,
    lastModified: partial.lastModified ?? now,
    modifiedBy: partial.modifiedBy ?? 'Zedekiah',
    classification: partial.classification ?? 'CUI',
    attachmentIds: partial.attachmentIds ?? [],
    ...partial,
  };
}

/** Vertical Integrators — Element under the subsystem's Core Elements component */
function verticalIntegrators(coreElementsId: string, subsystemLabel: string): ResourceEntity {
  return e({
    id: `${coreElementsId.replace(/-core-elements$/, '')}-vertical-integrators`,
    name: 'Vertical Integrators',
    type: 'Element',
    kind: 'integrator',
    description: `Candidate companies and products to integrate into ${subsystemLabel}. Local to this subsystem only.`,
    parentId: coreElementsId,
    tags: ['vertical-integration', 'suppliers', 'sourcing'],
    metadata: { purpose: 'per-subsystem supplier & product candidates', scope: 'local-to-parent' },
  });
}

/** Auto-created Component that holds former SoftwareItem / Interface / Capability leaves */
function coreElements(
  subsystemId: string,
  subsystemLabel: string,
  elements: ResourceEntity[]
): ResourceEntity {
  const id = `${subsystemId}-core-elements`;
  return e({
    id,
    name: 'Core Elements',
    type: 'Component',
    parentId: subsystemId,
    description: `Software, interfaces, integrators, and other leaf elements for ${subsystemLabel}.`,
    tags: ['core-elements'],
    children: withParent(id, elements),
  });
}

function withParent(parentId: string, nodes: ResourceEntity[]): ResourceEntity[] {
  return nodes.map((n) => ({
    ...n,
    parentId,
    children: n.children ? withParent(n.id, n.children) : n.children,
  }));
}

// ─── Subsystems ──────────────────────────────────────────────────────────────

const SUB_SCOPE: ResourceEntity = e({
  id: 'sub-scope',
  name: 'Scope',
  type: 'Subsystem',
  description:
    'Primary optic / magnified sight: mount interface, zeroing, eye relief, and optical path relative to trajectory control.',
  parentId: 'sys-tar',
  tags: ['optics', 'sight', 'scope'],
  lifecycleStage: 'in-design',
  children: withParent('sub-scope', [
    e({
      id: 'comp-scope-optic',
      name: 'Optic Assembly',
      type: 'Component',
      parentId: 'sub-scope',
      description: 'Magnified or hybrid optic selected for the platform.',
    }),
    e({
      id: 'comp-scope-mount',
      name: 'Mount / Rail Interface',
      type: 'Component',
      parentId: 'sub-scope',
      description: 'Mechanical interface to receiver/rail; return-to-zero.',
    }),
    e({
      id: 'comp-scope-zero',
      name: 'Zeroing & Retention',
      type: 'Component',
      parentId: 'sub-scope',
      description: 'Zero procedures, retention under recoil, and adjustment interfaces.',
      attachmentIds: ['doc-scope-zero-proc'],
      status: 'Released',
    }),
    coreElements('sub-scope', 'Scope', [
      verticalIntegrators('sub-scope-core-elements', 'Scope'),
    ]),
  ]),
});

const SUB_OPTICAL: ResourceEntity = e({
  id: 'sub-optical',
  name: 'Sensor Integration',
  type: 'Subsystem',
  description: 'Sensors, ranging, and sightline sensing for TAR™.',
  parentId: 'sys-tar',
  tags: ['sensors', 'integration'],
  lifecycleStage: 'in-design',
  attachmentIds: ['doc-opt-form-factor-spec'],
  children: withParent('sub-optical', [
    e({
      id: 'comp-opt-architecture',
      name: 'Sensor System Architecture',
      type: 'Component',
      parentId: 'sub-optical',
      description: 'Overall sensor stack architecture and packaging.',
    }),
    e({
      id: 'comp-opt-sensor-config',
      name: 'Sensor Configuration',
      type: 'Component',
      parentId: 'sub-optical',
      description: 'Sensor selection, FOV, resolution, and mounting.',
    }),
    e({
      id: 'comp-opt-form-factor',
      name: 'Form Factor Design',
      type: 'Component',
      parentId: 'sub-optical',
      description: 'Mechanical envelope for sensor packages on the rifle.',
      attachmentIds: ['doc-opt-form-factor-spec'],
      status: 'In Review',
    }),
    coreElements('sub-optical', 'Sensor Integration', [
      verticalIntegrators('sub-optical-core-elements', 'Sensor Integration'),
    ]),
  ]),
});

const SUB_MACHINE_VISION: ResourceEntity = e({
  id: 'sub-machine-vision',
  name: 'Machine Vision',
  type: 'Subsystem',
  description: 'Vision pipeline: cameras, detection, and image-derived measurements.',
  parentId: 'sys-tar',
  tags: ['vision', 'camera'],
  lifecycleStage: 'concept',
  children: withParent('sub-machine-vision', [
    e({
      id: 'comp-mv-camera',
      name: 'Camera Configuration',
      type: 'Component',
      parentId: 'sub-machine-vision',
      description: 'Camera selection, lens, frame rate, and mounting geometry.',
    }),
    coreElements('sub-machine-vision', 'Machine Vision', [
      e({
        id: 'sw-mv-pipeline',
        name: 'Vision Pipeline Software',
        type: 'Element',
        kind: 'software',
        description: 'Detection / tracking software path.',
        attachmentIds: ['doc-mv-pipeline-arch'],
      }),
      e({
        id: 'iface-mv-rt',
        name: 'Real-Time Vision Output',
        type: 'Element',
        kind: 'interface',
        description: 'Interface from vision into fusion / coordinate mapping.',
      }),
      verticalIntegrators('sub-machine-vision-core-elements', 'Machine Vision'),
    ]),
  ]),
});

const SUB_SENSOR_FUSION: ResourceEntity = e({
  id: 'sub-sensor-fusion',
  name: 'Sensor Fusion',
  type: 'Subsystem',
  description: 'State estimation fusing optical, IMU, and other sensing sources.',
  parentId: 'sys-tar',
  tags: ['fusion', 'estimation'],
  lifecycleStage: 'concept',
  children: withParent('sub-sensor-fusion', [
    e({
      id: 'comp-sf-imu',
      name: 'IMU / Motion Sensing',
      type: 'Component',
      parentId: 'sub-sensor-fusion',
      description: 'Inertial sensing package and mounting.',
    }),
    coreElements('sub-sensor-fusion', 'Sensor Fusion', [
      e({
        id: 'sw-sf-estimator',
        name: 'State Estimator',
        type: 'Element',
        kind: 'software',
        description: 'Fusion filter / estimator implementation.',
      }),
      verticalIntegrators('sub-sensor-fusion-core-elements', 'Sensor Fusion'),
    ]),
  ]),
});

const SUB_BALLISTICS: ResourceEntity = e({
  id: 'sub-ballistics',
  name: 'Ballistic Computation',
  type: 'Subsystem',
  description: 'Ballistic solution engine and fire-control computation.',
  parentId: 'sys-tar',
  tags: ['ballistics', 'fire-control'],
  lifecycleStage: 'concept',
  children: withParent('sub-ballistics', [
    e({
      id: 'comp-bal-env',
      name: 'Environmental Inputs',
      type: 'Component',
      parentId: 'sub-ballistics',
      description: 'Atmosphere, ammo, and related input models.',
    }),
    coreElements('sub-ballistics', 'Ballistic Computation', [
      e({
        id: 'sw-bal-engine',
        name: 'Ballistics Engine',
        type: 'Element',
        kind: 'software',
        description: 'Core ballistic solver and solution outputs.',
      }),
      verticalIntegrators('sub-ballistics-core-elements', 'Ballistic Computation'),
    ]),
  ]),
});

const SUB_PIXEL_TO_POSITION: ResourceEntity = e({
  id: 'sub-pixel-to-position',
  name: 'Pixel to Position',
  type: 'Subsystem',
  description:
    'Map image-plane pixels and sensor measurements into weapon/world coordinates for aiming and trajectory adjustment.',
  parentId: 'sys-tar',
  tags: ['vision', 'coordinates', 'calibration'],
  lifecycleStage: 'concept',
  children: withParent('sub-pixel-to-position', [
    e({
      id: 'comp-ptp-calibration',
      name: 'Calibration Model',
      type: 'Component',
      parentId: 'sub-pixel-to-position',
      description: 'Intrinsic/extrinsic calibration and pixel-to-angle or pixel-to-world mapping.',
    }),
    coreElements('sub-pixel-to-position', 'Pixel to Position', [
      e({
        id: 'sw-ptp-pipeline',
        name: 'Coordinate Pipeline',
        type: 'Element',
        kind: 'software',
        description: 'Software path from pixels/detections to position estimates.',
      }),
      e({
        id: 'iface-ptp-output',
        name: 'Position Output Interface',
        type: 'Element',
        kind: 'interface',
        description: 'Output interface into ballistics / sensor fusion / closed loop / actuation.',
      }),
      verticalIntegrators('sub-pixel-to-position-core-elements', 'Pixel to Position'),
    ]),
  ]),
});

const SUB_BARREL_ACTUATION: ResourceEntity = e({
  id: 'sub-barrel-actuation',
  name: 'Barrel Actuation',
  type: 'Subsystem',
  description: 'Micro-actuation of barrel / aim vector for trajectory adjustment.',
  parentId: 'sys-tar',
  tags: ['actuation', 'mechanical'],
  lifecycleStage: 'in-design',
  attachmentIds: ['doc-ba-mount-drawing'],
  children: withParent('sub-barrel-actuation', [
    e({
      id: 'comp-ba-actuator',
      name: 'Actuator Assembly',
      type: 'Component',
      parentId: 'sub-barrel-actuation',
      description: 'Actuator hardware and drive.',
    }),
    e({
      id: 'comp-ba-mount',
      name: 'Chassis Mount Interface',
      type: 'Component',
      parentId: 'sub-barrel-actuation',
      description: 'Structural interface to chassis/receiver.',
      attachmentIds: ['doc-ba-mount-drawing'],
      status: 'Draft',
    }),
    coreElements('sub-barrel-actuation', 'Barrel Actuation', [
      e({
        id: 'iface-ba-cmd',
        name: 'Actuation Command Interface',
        type: 'Element',
        kind: 'interface',
        description: 'Command path from closed-loop control.',
      }),
      verticalIntegrators('sub-barrel-actuation-core-elements', 'Barrel Actuation'),
    ]),
  ]),
});

const SUB_CHASSIS: ResourceEntity = e({
  id: 'sub-chassis',
  name: 'Chassis',
  type: 'Subsystem',
  description: 'Primary structural chassis, ergonomics, and mounting rails.',
  parentId: 'sys-tar',
  tags: ['structure', 'mechanical'],
  lifecycleStage: 'in-design',
  children: withParent('sub-chassis', [
    e({
      id: 'comp-ch-frame',
      name: 'Chassis Frame',
      type: 'Component',
      parentId: 'sub-chassis',
      description: 'Main structural member and rail geometry.',
    }),
    e({
      id: 'comp-ch-interfaces',
      name: 'Subsystem Interfaces',
      type: 'Component',
      parentId: 'sub-chassis',
      description: 'Mechanical interfaces for optics, actuation, power, and receiver.',
    }),
    coreElements('sub-chassis', 'Chassis', [
      verticalIntegrators('sub-chassis-core-elements', 'Chassis'),
    ]),
  ]),
});

const SUB_RECEIVER: ResourceEntity = e({
  id: 'sub-receiver',
  name: 'Receiver Configuration',
  type: 'Subsystem',
  description: 'Receiver configuration, interfaces, and platform compatibility.',
  parentId: 'sys-tar',
  tags: ['receiver', 'mechanical'],
  lifecycleStage: 'concept',
  children: withParent('sub-receiver', [
    e({
      id: 'comp-rc-upper',
      name: 'Upper / Action Interface',
      type: 'Component',
      parentId: 'sub-receiver',
      description: 'Receiver geometry and barrel/action interface.',
    }),
    e({
      id: 'comp-rc-compat',
      name: 'Platform Compatibility',
      type: 'Component',
      parentId: 'sub-receiver',
      description: 'Compatibility with host platforms and standards.',
    }),
    coreElements('sub-receiver', 'Receiver Configuration', [
      verticalIntegrators('sub-receiver-core-elements', 'Receiver Configuration'),
    ]),
  ]),
});

const SUB_TRIGGER: ResourceEntity = e({
  id: 'sub-trigger',
  name: 'Trigger',
  type: 'Subsystem',
  description: 'Trigger group, safety, and fire-control interface.',
  parentId: 'sys-tar',
  tags: ['trigger', 'fire-control'],
  lifecycleStage: 'concept',
  children: withParent('sub-trigger', [
    e({
      id: 'comp-tr-group',
      name: 'Trigger Group',
      type: 'Component',
      parentId: 'sub-trigger',
      description: 'Mechanical trigger assembly and safety.',
    }),
    e({
      id: 'comp-tr-fc-iface',
      name: 'Fire-Control Interface',
      type: 'Component',
      parentId: 'sub-trigger',
      description: 'Interface between trigger and electronic fire control if present.',
    }),
    coreElements('sub-trigger', 'Trigger', [
      verticalIntegrators('sub-trigger-core-elements', 'Trigger'),
    ]),
  ]),
});

const SUB_POWER: ResourceEntity = e({
  id: 'sub-power',
  name: 'Power',
  type: 'Subsystem',
  description: 'Power generation, storage, distribution, and budget for electronics and actuation.',
  parentId: 'sys-tar',
  tags: ['power', 'electrical'],
  lifecycleStage: 'concept',
  children: withParent('sub-power', [
    e({
      id: 'comp-pw-source',
      name: 'Power Source',
      type: 'Component',
      parentId: 'sub-power',
      description: 'Battery or other energy source packaging.',
    }),
    e({
      id: 'comp-pw-distribution',
      name: 'Power Distribution',
      type: 'Component',
      parentId: 'sub-power',
      description: 'Rails, regulation, and distribution to subsystems.',
    }),
    coreElements('sub-power', 'Power', [
      verticalIntegrators('sub-power-core-elements', 'Power'),
    ]),
  ]),
});

const SUB_CLOSED_LOOP: ResourceEntity = e({
  id: 'sub-closed-loop',
  name: 'Closed Loop',
  type: 'Subsystem',
  description: 'Closed-loop control linking sensing, computation, and actuation.',
  parentId: 'sys-tar',
  tags: ['control', 'software'],
  lifecycleStage: 'concept',
  children: withParent('sub-closed-loop', [
    coreElements('sub-closed-loop', 'Closed Loop', [
      e({
        id: 'sw-cl-controller',
        name: 'Control Law / Controller',
        type: 'Element',
        kind: 'software',
        description: 'Real-time control implementation.',
        attachmentIds: ['doc-cl-control-law'],
      }),
      e({
        id: 'iface-cl-io',
        name: 'Sense / Actuate Interfaces',
        type: 'Element',
        kind: 'interface',
        description: 'I/O boundaries to fusion and actuation.',
      }),
      verticalIntegrators('sub-closed-loop-core-elements', 'Closed Loop'),
    ]),
  ]),
});

export const TAR_SYSTEM: ResourceEntity = e({
  id: 'sys-tar',
  name: 'TAR™',
  type: 'System',
  description:
    'Trajectory Adjusting Rifle — system-of-systems spanning sensing, computation, closed-loop control, and actuation.',
  tags: ['platform', 'TAR', 'prototype'],
  parentId: null,
  status: 'In Review',
  revision: '0.9',
  lifecycleStage: 'in-design',
  attachmentIds: ['doc-sys-tar-overview'],
  children: [
    SUB_SCOPE,
    SUB_OPTICAL,
    SUB_MACHINE_VISION,
    SUB_SENSOR_FUSION,
    SUB_BALLISTICS,
    SUB_PIXEL_TO_POSITION,
    SUB_BARREL_ACTUATION,
    SUB_CHASSIS,
    SUB_RECEIVER,
    SUB_TRIGGER,
    SUB_POWER,
    SUB_CLOSED_LOOP,
  ],
});

export const TAR_TREE = TAR_SYSTEM;

export const SUBSYSTEM_COLORS: Record<string, string> = {
  'sub-scope': 'rose',
  'sub-optical': 'lime',
  'sub-machine-vision': 'sky',
  'sub-sensor-fusion': 'orange',
  'sub-ballistics': 'violet',
  'sub-pixel-to-position': 'teal',
  'sub-barrel-actuation': 'red',
  'sub-chassis': 'yellow',
  'sub-receiver': 'cyan',
  'sub-trigger': 'pink',
  'sub-power': 'amber',
  'sub-closed-loop': 'indigo',
};

function flattenTree(node: ResourceEntity, acc: ResourceEntity[] = []): ResourceEntity[] {
  acc.push(node);
  (node.children || []).forEach((c) => flattenTree(c, acc));
  return acc;
}

export const ALL_ENTITIES: ResourceEntity[] = flattenTree(TAR_TREE);

/**
 * Ensure every Document.linkedEntityIds has a reciprocal attachmentIds entry
 * (seed already sets both; this is a safety net for future edits).
 */
export function syncAttachmentLinks(): void {
  for (const d of DOCUMENTS) {
    for (const eid of d.linkedEntityIds) {
      const ent = ALL_ENTITIES.find((x) => x.id === eid);
      if (ent && !(ent.attachmentIds || []).includes(d.id)) {
        ent.attachmentIds = [...(ent.attachmentIds || []), d.id];
      }
    }
  }
}
syncAttachmentLinks();