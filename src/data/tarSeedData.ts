/**
 * TAR™ (Trajectory Adjusting Rifle) — Canonical Seed Dataset
 * Vector · Product Lifecycle Management · Digital Thread
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
    owner: 'Zedekiah Morse',
    ...partial,
  };
}

function verticalIntegrators(parentId: string, subsystemLabel: string): ResourceEntity {
  return e({
    id: `${parentId}-vertical-integrators`,
    name: 'Vertical Integrators',
    type: 'Capability',
    description: `Candidate companies and products to vertically integrate into the ${subsystemLabel} subsystem. Track potential suppliers, make-vs-buy decisions, and integration readiness for this branch only.`,
    parentId,
    tags: ['vertical-integration', 'suppliers', 'sourcing', 'make-vs-buy'],
    metadata: { purpose: 'per-subsystem supplier & product candidates', scope: 'local-to-parent' },
  });
}

export const TAR_SYSTEM: ResourceEntity = e({
  id: 'sys-tar',
  name: 'TAR™',
  type: 'System',
  description:
    'Advanced Weapons Systems — Trajectory Adjusting Rifle (TAR™). Complete system-of-systems including sensing, computation, closed-loop control, and barrel actuation.',
  tags: ['platform', 'trajectory-adjustment', 'prototype'],
  parentId: null,
  status: 'in-design',
  revision: '0.9',
});

// 1. Optical Sensor Integration
const opticalChildren: ResourceEntity[] = [
  e({ id: 'comp-opt-architecture', name: 'Optical System Architecture', type: 'Component', description: 'Overall optical path design, including lenses, sensors, and protective elements.', parentId: 'sub-optical', tags: ['optical', 'architecture'] }),
  e({ id: 'comp-opt-sensor-config', name: 'Sensor Configuration', type: 'Component', description: 'Specific sensor selection, placement, and interface definition within the optical package.', parentId: 'sub-optical', tags: ['sensors', 'optical'] }),
  e({ id: 'comp-opt-form-factor', name: 'Form Factor Design', type: 'Component', description: 'Mechanical envelope, weight, and packaging constraints for the optical/sensor assembly.', parentId: 'sub-optical', tags: ['mechanical', 'packaging'] }),
  e({ id: 'comp-opt-electrical', name: 'Electrical Design', type: 'Component', description: 'Power, signal, and grounding design for optical and sensor electronics.', parentId: 'sub-optical', tags: ['electrical'] }),
  e({ id: 'comp-opt-power', name: 'Power Requirements & Supply', type: 'Component', description: 'Power budget, regulation, and supply path for the optical/sensor suite.', parentId: 'sub-optical', tags: ['power', 'electrical'] }),
  e({ id: 'comp-opt-mounting', name: 'Mounting Platform', type: 'Component', description: 'Mechanical interface that attaches the optical package to the weapon chassis.', parentId: 'sub-optical', tags: ['mechanical', 'interface'] }),
  verticalIntegrators('sub-optical', 'Optical Sensor Integration'),
];

export const SUB_OPTICAL: ResourceEntity = e({
  id: 'sub-optical',
  name: 'Optical Sensor Integration',
  type: 'Subsystem',
  description: 'Physical and electrical integration of optical and sensing elements into a coherent package.',
  parentId: 'sys-tar',
  tags: ['optical', 'integration'],
  children: opticalChildren,
});

// 2. Machine Vision
const machineVisionChildren: ResourceEntity[] = [
  e({ id: 'comp-mv-camera-config', name: 'Machine Vision Camera Configuration', type: 'Component', description: 'Camera selection, mounting geometry, resolution, frame-rate, and lens parameters for the vision pipeline.', parentId: 'sub-machine-vision', tags: ['vision', 'hardware'] }),
  e({ id: 'comp-mv-pixel-mapping', name: 'Sensor Area Pixel Mapping', type: 'Component', description: 'Calibration and mapping of sensor pixels to real-world coordinates.', parentId: 'sub-machine-vision', tags: ['vision', 'calibration'] }),
  e({ id: 'comp-mv-aoe-mapping', name: 'Area of Engagement Mapping', type: 'Component', description: 'Definition and dynamic update of the engagement zone in the coordinate frame.', parentId: 'sub-machine-vision', tags: ['vision', 'tactical'] }),
  e({ id: 'comp-mv-ranging-tables', name: 'Ranging Mapping Tables', type: 'Component', description: 'Lookup / computational tables converting sensor data to range estimates.', parentId: 'sub-machine-vision', tags: ['ranging', 'data'] }),
  e({ id: 'comp-mv-rt-loop-input', name: 'Real Time Loop Input', type: 'Interface', description: 'Real-time data feed from vision pipeline into the closed-loop control system.', parentId: 'sub-machine-vision', tags: ['interface', 'real-time'] }),
  e({ id: 'comp-mv-coord-output', name: 'Coordinate Positional Output', type: 'Interface', description: 'Output of absolute / relative target coordinates for downstream consumers.', parentId: 'sub-machine-vision', tags: ['interface', 'position'] }),
  e({ id: 'comp-mv-hud-integration', name: 'HUD Display Integration', type: 'Component', description: 'Overlay of targeting and status data onto the operator heads-up display.', parentId: 'sub-machine-vision', tags: ['hud', 'ui'] }),
  verticalIntegrators('sub-machine-vision', 'Machine Vision'),
];

export const SUB_MACHINE_VISION: ResourceEntity = e({
  id: 'sub-machine-vision',
  name: 'Machine Vision',
  type: 'Subsystem',
  description: 'Machine-vision sensing, pixel-to-world mapping, and coordinate generation for the trajectory-adjustment loop.',
  parentId: 'sys-tar',
  tags: ['sensing', 'vision'],
  children: machineVisionChildren,
});

// 3. Sensor Fusion
const sensorFusionChildren: ResourceEntity[] = [
  e({ id: 'comp-sf-platform-config', name: 'Sensor Platform Configuration', type: 'Component', description: 'Physical layout, orientation, and mounting of the multi-sensor package.', parentId: 'sub-sensor-fusion', tags: ['sensors', 'mechanical'] }),
  e({ id: 'comp-sf-env-sensors', name: 'Environmental Sensors', type: 'Component', description: 'Temperature, pressure, humidity, and other environmental inputs used by ballistics and state estimation.', parentId: 'sub-sensor-fusion', tags: ['sensors', 'environment'] }),
  e({ id: 'comp-sf-imu', name: 'Inertial Measurement Sensor', type: 'Component', description: 'IMU providing angular rate and linear acceleration for attitude and motion estimation.', parentId: 'sub-sensor-fusion', tags: ['sensors', 'imu'] }),
  e({ id: 'comp-sf-ranging', name: 'Ranging Measurements', type: 'Component', description: 'Laser or other ranging data fused into the state vector.', parentId: 'sub-sensor-fusion', tags: ['sensors', 'ranging'] }),
  e({ id: 'comp-sf-rt-processing', name: 'Real-Time Loop Processing', type: 'SoftwareItem', description: 'Deterministic real-time fusion algorithms running inside the control loop.', parentId: 'sub-sensor-fusion', tags: ['software', 'real-time'] }),
  e({ id: 'comp-sf-state-vector', name: 'Unified State Vector', type: 'SoftwareItem', description: 'Canonical state representation consumed by ballistics and control.', parentId: 'sub-sensor-fusion', tags: ['software', 'state'] }),
  verticalIntegrators('sub-sensor-fusion', 'Sensor Fusion'),
];

export const SUB_SENSOR_FUSION: ResourceEntity = e({
  id: 'sub-sensor-fusion',
  name: 'Sensor Fusion',
  type: 'Subsystem',
  description: 'Multi-sensor fusion producing a unified real-time state estimate for the platform.',
  parentId: 'sys-tar',
  tags: ['sensing', 'estimation'],
  children: sensorFusionChildren,
});

// 4. Ballistic Computation
const ballisticsChildren: ResourceEntity[] = [
  e({ id: 'comp-bc-engine-platform', name: 'Engine Platform Configuration', type: 'SoftwareItem', description: 'Runtime environment and configuration of the ballistics computation engine.', parentId: 'sub-ballistics', tags: ['software', 'platform'] }),
  e({ id: 'comp-bc-env-data', name: 'Environmental Sensor Data', type: 'Interface', description: 'Ingest of environmental measurements used by the ballistics solver.', parentId: 'sub-ballistics', tags: ['interface', 'environment'] }),
  e({ id: 'comp-bc-barrel-model', name: 'Rifle Barrel Modeling', type: 'SoftwareItem', description: 'Internal model of barrel geometry, harmonics, and wear characteristics.', parentId: 'sub-ballistics', tags: ['software', 'model'] }),
  e({ id: 'comp-bc-projectile-model', name: 'Caliber / Grain / Projectile Modeling', type: 'SoftwareItem', description: 'Ballistic coefficient, mass, and projectile-specific modeling parameters.', parentId: 'sub-ballistics', tags: ['software', 'ballistics'] }),
  e({ id: 'comp-bc-correction-loop', name: 'Continuous Angular Correction Loop', type: 'SoftwareItem', description: 'Real-time computation of angular corrections fed to the actuation system.', parentId: 'sub-ballistics', tags: ['software', 'control'] }),
  e({ id: 'comp-bc-transposition-output', name: 'Correctional Transpositioning Output', type: 'Interface', description: 'Output interface delivering computed corrections to Closed Loop Control.', parentId: 'sub-ballistics', tags: ['interface', 'control'] }),
  verticalIntegrators('sub-ballistics', 'Ballistic Computation'),
];

export const SUB_BALLISTICS: ResourceEntity = e({
  id: 'sub-ballistics',
  name: 'Ballistic Computation',
  type: 'Subsystem',
  description: 'Real-time ballistics solver that produces continuous angular corrections for the actuation system.',
  parentId: 'sys-tar',
  tags: ['computation', 'ballistics'],
  children: ballisticsChildren,
});

// 5. Barrel Actuation
const barrelActuationChildren: ResourceEntity[] = [
  e({ id: 'comp-ba-architecture', name: 'Actuation System Architecture', type: 'Component', description: 'Overall mechanical and control architecture of the barrel actuation assembly.', parentId: 'sub-barrel-actuation', tags: ['architecture', 'mechanical'] }),
  e({ id: 'comp-ba-barrel-mount', name: 'Barrel Mount & Positioning', type: 'Component', description: 'Mount that holds and precisely positions the barrel under actuation loads.', parentId: 'sub-barrel-actuation', tags: ['mechanical', 'mount'] }),
  e({ id: 'comp-ba-chassis-mount', name: 'Chassis Mount & Positioning', type: 'Component', description: 'Interface between the actuation package and the weapon chassis.', parentId: 'sub-barrel-actuation', tags: ['mechanical', 'mount'] }),
  e({ id: 'comp-ba-controller', name: 'Controller Integration', type: 'Component', description: 'Electronics and firmware that interpret closed-loop commands and drive the actuators.', parentId: 'sub-barrel-actuation', tags: ['electronics', 'control'] }),
  e({ id: 'comp-ba-neutralizing-factors', name: 'Neutralizing Factors', type: 'Component', description: 'Identification and characterization of forces that must be neutralized.', parentId: 'sub-barrel-actuation', tags: ['analysis', 'dynamics'] }),
  e({ id: 'comp-ba-neutralizing-action', name: 'Neutralizing Action/Positioning', type: 'Component', description: 'Active positioning and force application that counteracts neutralizing factors.', parentId: 'sub-barrel-actuation', tags: ['actuation', 'control'] }),
  e({ id: 'comp-ba-actuator-mfg', name: 'Actuator Manufacturing', type: 'Component', description: 'Manufacturing process, materials, and quality requirements for the micro-actuators.', parentId: 'sub-barrel-actuation', tags: ['manufacturing', 'actuator'] }),
  verticalIntegrators('sub-barrel-actuation', 'Barrel Actuation'),
];

export const SUB_BARREL_ACTUATION: ResourceEntity = e({
  id: 'sub-barrel-actuation',
  name: 'Barrel Actuation',
  type: 'Subsystem',
  description: 'Two-axis micro-actuation system that physically steers the barrel in response to closed-loop commands.',
  parentId: 'sys-tar',
  tags: ['actuation', 'mechanical'],
  children: barrelActuationChildren,
});

// 6. Chassis
const chassisChildren: ResourceEntity[] = [
  e({ id: 'comp-chassis-frame', name: 'Chassis Frame', type: 'Component', description: 'Primary structural frame, materials, and geometry for the TAR™.', parentId: 'sub-chassis', tags: ['mechanical', 'structure'] }),
  e({ id: 'comp-chassis-mounting', name: 'Subsystem Mounting Interfaces', type: 'Interface', description: 'Mounting points and interfaces for optics, actuation, electronics, and accessories.', parentId: 'sub-chassis', tags: ['interface', 'mounting'] }),
  e({ id: 'comp-chassis-ergonomics', name: 'Ergonomics & Stock Interface', type: 'Component', description: 'Stock, grip, and operator interface geometry tied to the chassis.', parentId: 'sub-chassis', tags: ['mechanical', 'ergonomics'] }),
  verticalIntegrators('sub-chassis', 'Chassis'),
];

export const SUB_CHASSIS: ResourceEntity = e({
  id: 'sub-chassis',
  name: 'Chassis',
  type: 'Subsystem',
  description: 'Structural chassis, mounting architecture, and mechanical backbone of the TAR™.',
  parentId: 'sys-tar',
  tags: ['mechanical', 'chassis'],
  children: chassisChildren,
});

// 7. Receiver Configuration
const receiverChildren: ResourceEntity[] = [
  e({ id: 'comp-rx-upper', name: 'Upper Receiver', type: 'Component', description: 'Upper receiver geometry, material, and interface definition for the TAR™.', parentId: 'sub-receiver', tags: ['mechanical', 'receiver'] }),
  e({ id: 'comp-rx-lower', name: 'Lower Receiver', type: 'Component', description: 'Lower receiver, fire-control pocket, and magazine well configuration.', parentId: 'sub-receiver', tags: ['mechanical', 'receiver'] }),
  e({ id: 'comp-rx-barrel-extension', name: 'Barrel Extension Interface', type: 'Interface', description: 'Mechanical interface between receiver and barrel / actuation package.', parentId: 'sub-receiver', tags: ['interface', 'mechanical'] }),
  e({ id: 'comp-rx-rail', name: 'Top Rail / Optic Mount Interface', type: 'Interface', description: 'Picatinny / STANAG rail geometry for optics and accessories.', parentId: 'sub-receiver', tags: ['interface', 'rail'] }),
  e({ id: 'comp-rx-controls', name: 'Controls & Safety Layout', type: 'Component', description: 'Selector, bolt catch, magazine release, and related control layout.', parentId: 'sub-receiver', tags: ['mechanical', 'controls'] }),
  verticalIntegrators('sub-receiver', 'Receiver Configuration'),
];

export const SUB_RECEIVER: ResourceEntity = e({
  id: 'sub-receiver',
  name: 'Receiver Configuration',
  type: 'Subsystem',
  description: 'Upper/lower receiver configuration, interfaces, and control layout for the TAR™.',
  parentId: 'sys-tar',
  tags: ['mechanical', 'receiver'],
  children: receiverChildren,
});

// 8. Trigger
const triggerChildren: ResourceEntity[] = [
  e({ id: 'comp-trg-group', name: 'Trigger Group', type: 'Component', description: 'Trigger mechanism assembly, geometry, and pull characteristics for the TAR™.', parentId: 'sub-trigger', tags: ['mechanical', 'trigger'] }),
  e({ id: 'comp-trg-safety', name: 'Safety / Selector Interface', type: 'Interface', description: 'Mechanical and logical interface between trigger group and safety/selector.', parentId: 'sub-trigger', tags: ['interface', 'safety'] }),
  e({ id: 'comp-trg-electronics', name: 'Electronic Trigger Interface', type: 'Interface', description: 'Optional electronic sensing / fire-control interface to closed-loop and fire-control logic.', parentId: 'sub-trigger', tags: ['interface', 'electronics'] }),
  e({ id: 'comp-trg-housing', name: 'Trigger Housing / Pocket', type: 'Component', description: 'Receiver pocket and housing geometry that retains the trigger group.', parentId: 'sub-trigger', tags: ['mechanical', 'receiver'] }),
  verticalIntegrators('sub-trigger', 'Trigger'),
];

export const SUB_TRIGGER: ResourceEntity = e({
  id: 'sub-trigger',
  name: 'Trigger',
  type: 'Subsystem',
  description: 'Trigger group, safety interface, and optional electronic fire-control linkage for the TAR™.',
  parentId: 'sys-tar',
  tags: ['mechanical', 'trigger'],
  children: triggerChildren,
});

// 9. Power
const powerChildren: ResourceEntity[] = [
  e({ id: 'comp-pwr-architecture', name: 'Power Architecture', type: 'Component', description: 'Overall power distribution architecture for the TAR™ platform.', parentId: 'sub-power', tags: ['power', 'architecture'] }),
  e({ id: 'comp-pwr-source', name: 'Primary Power Source', type: 'Component', description: 'Battery / power source selection, capacity, and packaging.', parentId: 'sub-power', tags: ['power', 'battery'] }),
  e({ id: 'comp-pwr-regulation', name: 'Power Regulation & Conversion', type: 'Component', description: 'Voltage regulation, conversion, and clean power delivery to subsystems.', parentId: 'sub-power', tags: ['power', 'electronics'] }),
  e({ id: 'comp-pwr-distribution', name: 'Power Distribution', type: 'Interface', description: 'Power rails and interconnects to optical, actuation, compute, and sensing loads.', parentId: 'sub-power', tags: ['power', 'interface'] }),
  e({ id: 'comp-pwr-budget', name: 'Power Budget & Thermal', type: 'Component', description: 'System-level power budget, duty cycles, and thermal constraints.', parentId: 'sub-power', tags: ['power', 'thermal'] }),
  verticalIntegrators('sub-power', 'Power'),
];

export const SUB_POWER: ResourceEntity = e({
  id: 'sub-power',
  name: 'Power',
  type: 'Subsystem',
  description: 'Power source, regulation, distribution, and budget for the TAR™ platform.',
  parentId: 'sys-tar',
  tags: ['power', 'electrical'],
  children: powerChildren,
});

// 10. Closed Loop
const closedLoopChildren: ResourceEntity[] = [
  e({ id: 'comp-cl-engine-platform', name: 'Engine Platform Configuration', type: 'SoftwareItem', description: 'Runtime and configuration of the closed-loop control engine.', parentId: 'sub-closed-loop', tags: ['software', 'platform'] }),
  e({ id: 'comp-cl-positional-input', name: 'Real-Time Positional Data Input', type: 'Interface', description: 'Ingest of fused state and ballistics corrections into the control loop.', parentId: 'sub-closed-loop', tags: ['interface', 'real-time'] }),
  e({ id: 'comp-cl-actuation-output', name: 'Two Axis Micro Actuation Command Output', type: 'Interface', description: 'Command stream driving the two-axis micro-actuation hardware.', parentId: 'sub-closed-loop', tags: ['interface', 'actuation'] }),
  e({ id: 'comp-cl-latency-comp', name: 'Integration of Latency Compensation', type: 'SoftwareItem', description: 'Algorithms that compensate for sensor, compute, and actuator latency.', parentId: 'sub-closed-loop', tags: ['software', 'control'] }),
  verticalIntegrators('sub-closed-loop', 'Closed Loop'),
];

export const SUB_CLOSED_LOOP: ResourceEntity = e({
  id: 'sub-closed-loop',
  name: 'Closed Loop',
  type: 'Subsystem',
  description: 'Real-time closed-loop controller that converts state estimates and ballistics solutions into actuation commands.',
  parentId: 'sys-tar',
  tags: ['control', 'real-time'],
  children: closedLoopChildren,
});

export const TAR_TREE: ResourceEntity = {
  ...TAR_SYSTEM,
  children: [
    SUB_OPTICAL,
    SUB_MACHINE_VISION,
    SUB_SENSOR_FUSION,
    SUB_BALLISTICS,
    SUB_BARREL_ACTUATION,
    SUB_CHASSIS,
    SUB_RECEIVER,
    SUB_TRIGGER,
    SUB_POWER,
    SUB_CLOSED_LOOP,
  ],
};

export const AWS_SMX_SYSTEM = TAR_SYSTEM;
export const AWS_SMX_TREE = TAR_TREE;

export function flattenTree(node: ResourceEntity): ResourceEntity[] {
  const result: ResourceEntity[] = [{ ...node, children: undefined }];
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenTree(child));
    }
  }
  return result;
}

export const ALL_ENTITIES: ResourceEntity[] = flattenTree(TAR_TREE);

export const ENTITY_BY_ID: Record<string, ResourceEntity> = Object.fromEntries(
  ALL_ENTITIES.map((ent) => [ent.id, ent])
);

export const SUBSYSTEM_COLORS: Record<string, string> = {
  'sub-optical': 'lime',
  'sub-machine-vision': 'amber',
  'sub-sensor-fusion': 'orange',
  'sub-ballistics': 'sky',
  'sub-barrel-actuation': 'red',
  'sub-chassis': 'teal',
  'sub-receiver': 'cyan',
  'sub-trigger': 'rose',
  'sub-power': 'yellow',
  'sub-closed-loop': 'violet',
};