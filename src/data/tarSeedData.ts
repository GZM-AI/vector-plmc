/**
 * TAR™ (Trajectory Adjusting Rifle) — Canonical Seed Dataset
 * Vector · Product Lifecycle Management
 *
 * Vertical Integrators = per-subsystem candidates only (not shared).
 */
export type EntityType =
  | 'System'
  | 'Subsystem'
  | 'Component'
  | 'SoftwareItem'
  | 'Interface'
  | 'Capability';

export type EntityStatus =
  | 'concept'
  | 'in-design'
  | 'prototype'
  | 'qualified'
  | 'production'
  | 'obsolete';

export interface ResourceEntity {
  id: string;
  name: string;
  type: EntityType;
  description?: string;
  status: EntityStatus;
  revision: string;
  owner?: string;
  classification?: 'UNCLASSIFIED' | 'CUI' | 'ITAR' | 'SECRET';
  tags?: string[];
  metadata?: Record<string, any>;
  parentId: string | null;
  children?: ResourceEntity[];
  relatedIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

const now = new Date().toISOString();

function e(
  partial: Omit<ResourceEntity, 'createdAt' | 'updatedAt' | 'revision' | 'status'> & {
    status?: EntityStatus;
    revision?: string;
  }
): ResourceEntity {
  return {
    status: 'concept',
    revision: 'A',
    createdAt: now,
    updatedAt: now,
    classification: 'CUI',
    ...partial,
  };
}

function verticalIntegrators(parentId: string, subsystemLabel: string): ResourceEntity {
  return e({
    id: `${parentId}-vertical-integrators`,
    name: 'Vertical Integrators',
    type: 'Capability',
    description: `Candidate companies and products to integrate into ${subsystemLabel}. Local to this subsystem only.`,
    parentId,
    tags: ['vertical-integration', 'suppliers', 'sourcing'],
    metadata: { purpose: 'per-subsystem supplier & product candidates', scope: 'local-to-parent' },
  });
}

function withParent(parentId: string, nodes: ResourceEntity[]): ResourceEntity[] {
  return nodes.map((n) => ({
    ...n,
    parentId,
    children: n.children ? withParent(n.id, n.children) : n.children,
  }));
}

const SUB_SCOPE: ResourceEntity = e({
  id: 'sub-scope',
  name: 'Scope',
  type: 'Subsystem',
  description:
    'Primary optic / magnified sight: mount interface, zeroing, eye relief, and optical path relative to trajectory control.',
  parentId: 'sys-tar',
  tags: ['optics', 'sight', 'scope'],
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
    }),
    verticalIntegrators('sub-scope', 'Scope'),
  ]),
});

const SUB_OPTICAL: ResourceEntity = e({
  id: 'sub-optical',
  name: 'Sensor Integration',
  type: 'Subsystem',
  description: 'Sensors, ranging, and sightline sensing for TAR™.',
  parentId: 'sys-tar',
  tags: ['sensors', 'integration'],
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
    }),
    verticalIntegrators('sub-optical', 'Sensor Integration'),
  ]),
});

const SUB_MACHINE_VISION: ResourceEntity = e({
  id: 'sub-machine-vision',
  name: 'Machine Vision',
  type: 'Subsystem',
  description: 'Vision pipeline: cameras, detection, and image-derived measurements.',
  parentId: 'sys-tar',
  tags: ['vision', 'camera'],
  children: withParent('sub-machine-vision', [
    e({
      id: 'comp-mv-camera',
      name: 'Camera Configuration',
      type: 'Component',
      parentId: 'sub-machine-vision',
      description: 'Camera selection, lens, frame rate, and mounting geometry.',
    }),
    e({
      id: 'sw-mv-pipeline',
      name: 'Vision Pipeline Software',
      type: 'SoftwareItem',
      parentId: 'sub-machine-vision',
      description: 'Detection / tracking software path.',
    }),
    e({
      id: 'iface-mv-rt',
      name: 'Real-Time Vision Output',
      type: 'Interface',
      parentId: 'sub-machine-vision',
      description: 'Interface from vision into fusion / coordinate mapping.',
    }),
    verticalIntegrators('sub-machine-vision', 'Machine Vision'),
  ]),
});

const SUB_SENSOR_FUSION: ResourceEntity = e({
  id: 'sub-sensor-fusion',
  name: 'Sensor Fusion',
  type: 'Subsystem',
  description: 'State estimation fusing optical, IMU, and other sensing sources.',
  parentId: 'sys-tar',
  tags: ['fusion', 'estimation'],
  children: withParent('sub-sensor-fusion', [
    e({
      id: 'sw-sf-estimator',
      name: 'State Estimator',
      type: 'SoftwareItem',
      parentId: 'sub-sensor-fusion',
      description: 'Fusion filter / estimator implementation.',
    }),
    e({
      id: 'comp-sf-imu',
      name: 'IMU / Motion Sensing',
      type: 'Component',
      parentId: 'sub-sensor-fusion',
      description: 'Inertial sensing package and mounting.',
    }),
    verticalIntegrators('sub-sensor-fusion', 'Sensor Fusion'),
  ]),
});

const SUB_BALLISTICS: ResourceEntity = e({
  id: 'sub-ballistics',
  name: 'Ballistic Computation',
  type: 'Subsystem',
  description: 'Ballistic solution engine and fire-control computation.',
  parentId: 'sys-tar',
  tags: ['ballistics', 'fire-control'],
  children: withParent('sub-ballistics', [
    e({
      id: 'sw-bal-engine',
      name: 'Ballistics Engine',
      type: 'SoftwareItem',
      parentId: 'sub-ballistics',
      description: 'Core ballistic solver and solution outputs.',
    }),
    e({
      id: 'comp-bal-env',
      name: 'Environmental Inputs',
      type: 'Component',
      parentId: 'sub-ballistics',
      description: 'Atmosphere, ammo, and related input models.',
    }),
    verticalIntegrators('sub-ballistics', 'Ballistic Computation'),
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
  children: withParent('sub-pixel-to-position', [
    e({
      id: 'comp-ptp-calibration',
      name: 'Calibration Model',
      type: 'Component',
      parentId: 'sub-pixel-to-position',
      description: 'Intrinsic/extrinsic calibration and pixel-to-angle or pixel-to-world mapping.',
    }),
    e({
      id: 'sw-ptp-pipeline',
      name: 'Coordinate Pipeline',
      type: 'SoftwareItem',
      parentId: 'sub-pixel-to-position',
      description: 'Software path from pixels/detections to position estimates.',
    }),
    e({
      id: 'iface-ptp-output',
      name: 'Position Output Interface',
      type: 'Interface',
      parentId: 'sub-pixel-to-position',
      description: 'Output interface into ballistics / sensor fusion / closed loop / actuation.',
    }),
    verticalIntegrators('sub-pixel-to-position', 'Pixel to Position'),
  ]),
});

const SUB_BARREL_ACTUATION: ResourceEntity = e({
  id: 'sub-barrel-actuation',
  name: 'Barrel Actuation',
  type: 'Subsystem',
  description: 'Micro-actuation of barrel / aim vector for trajectory adjustment.',
  parentId: 'sys-tar',
  tags: ['actuation', 'mechanical'],
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
    }),
    e({
      id: 'iface-ba-cmd',
      name: 'Actuation Command Interface',
      type: 'Interface',
      parentId: 'sub-barrel-actuation',
      description: 'Command path from closed-loop control.',
    }),
    verticalIntegrators('sub-barrel-actuation', 'Barrel Actuation'),
  ]),
});

const SUB_CHASSIS: ResourceEntity = e({
  id: 'sub-chassis',
  name: 'Chassis',
  type: 'Subsystem',
  description: 'Chassis structure, ergonomics, and integration backbone.',
  parentId: 'sys-tar',
  tags: ['structure', 'mechanical'],
  children: withParent('sub-chassis', [
    e({
      id: 'comp-ch-frame',
      name: 'Primary Frame',
      type: 'Component',
      parentId: 'sub-chassis',
      description: 'Main structural chassis elements.',
    }),
    e({
      id: 'comp-ch-interfaces',
      name: 'Subsystem Mount Points',
      type: 'Component',
      parentId: 'sub-chassis',
      description: 'Mount geometry for optics, actuation, power, etc.',
    }),
    verticalIntegrators('sub-chassis', 'Chassis'),
  ]),
});

const SUB_RECEIVER: ResourceEntity = e({
  id: 'sub-receiver',
  name: 'Receiver Configuration',
  type: 'Subsystem',
  description: 'Receiver configuration, interfaces, and platform compatibility.',
  parentId: 'sys-tar',
  tags: ['receiver', 'mechanical'],
  children: withParent('sub-receiver', [
    e({
      id: 'comp-rx-body',
      name: 'Receiver Body',
      type: 'Component',
      parentId: 'sub-receiver',
      description: 'Receiver structure and baseline configuration.',
    }),
    e({
      id: 'comp-rx-rail',
      name: 'Rail / Accessory Interface',
      type: 'Component',
      parentId: 'sub-receiver',
      description: 'Rails and accessory attachment.',
    }),
    verticalIntegrators('sub-receiver', 'Receiver Configuration'),
  ]),
});

const SUB_TRIGGER: ResourceEntity = e({
  id: 'sub-trigger',
  name: 'Trigger',
  type: 'Subsystem',
  description: 'Trigger group, safety, and fire-control interface.',
  parentId: 'sys-tar',
  tags: ['trigger', 'fire-control'],
  children: withParent('sub-trigger', [
    e({
      id: 'comp-trg-group',
      name: 'Trigger Group',
      type: 'Component',
      parentId: 'sub-trigger',
      description: 'Trigger mechanism assembly.',
    }),
    e({
      id: 'comp-trg-safety',
      name: 'Safety',
      type: 'Component',
      parentId: 'sub-trigger',
      description: 'Safety selector / interlocks.',
    }),
    verticalIntegrators('sub-trigger', 'Trigger'),
  ]),
});

const SUB_POWER: ResourceEntity = e({
  id: 'sub-power',
  name: 'Power',
  type: 'Subsystem',
  description: 'Power generation, storage, distribution, and budgeting.',
  parentId: 'sys-tar',
  tags: ['power', 'electronics'],
  children: withParent('sub-power', [
    e({
      id: 'comp-pwr-source',
      name: 'Energy Source',
      type: 'Component',
      parentId: 'sub-power',
      description: 'Battery / primary energy package.',
    }),
    e({
      id: 'comp-pwr-dist',
      name: 'Power Distribution',
      type: 'Component',
      parentId: 'sub-power',
      description: 'Distribution, regulation, and protection.',
    }),
    verticalIntegrators('sub-power', 'Power'),
  ]),
});

const SUB_CLOSED_LOOP: ResourceEntity = e({
  id: 'sub-closed-loop',
  name: 'Closed Loop',
  type: 'Subsystem',
  description: 'Closed-loop control linking sensing, computation, and actuation.',
  parentId: 'sys-tar',
  tags: ['control', 'software'],
  children: withParent('sub-closed-loop', [
    e({
      id: 'sw-cl-controller',
      name: 'Control Law / Controller',
      type: 'SoftwareItem',
      parentId: 'sub-closed-loop',
      description: 'Real-time control implementation.',
    }),
    e({
      id: 'iface-cl-io',
      name: 'Sense / Actuate Interfaces',
      type: 'Interface',
      parentId: 'sub-closed-loop',
      description: 'I/O boundaries to fusion and actuation.',
    }),
    verticalIntegrators('sub-closed-loop', 'Closed Loop'),
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
  status: 'in-design',
  revision: '0.9',
  children: [
    SUB_SCOPE,                 // 1st
    SUB_OPTICAL,               // 2nd — Sensor Integration
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