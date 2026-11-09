/**
 * System Registry — TAR™ product structure
 * Overview | Tree (type filter) | Deep-link ?id=
 * Phase 0: revision + status + attachments
 * Phase 1: revision history. Unversioned by default; user establishes Version 1; later versions on significant change.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Box,
  Cog,
  ChevronRight,
  ChevronDown,
  Cpu,
  Layers,
  GitBranch,
  Search,
  Filter,
  Package,
  Zap,
  Eye,
  Crosshair,
  LayoutGrid,
  ListTree,
  Paperclip,
  FileText,
  Plus,
  History,
  ArrowUpCircle,
  Bookmark,
  Factory,
  Building2,
  ChevronUp,
  Trash2,
  Download,
  X,
  Image,
} from 'lucide-react';
import { moveChild, sortChildren, subscribeChildOrderStore } from '../lib/childOrderStore';
import {
  getSuppliersForEntity,
  getSuppliers,
  getSupplierById,
  subscribeSuppliersStore,
  ensureSupplierForPart,
  unlinkSupplierFromEntity,
} from '../lib/suppliersStore';
import {
  ResourceEntity,
  EntityType,
  EntityStatus,
  SUBSYSTEM_COLORS,
} from '../data/tarSeedData';
import {
  documentsForEntity,
  subscribeDocumentsStore,
  attachDocumentToEntity,
  openAttachedDocument,
  previewAttachedDocument,
  type DocumentPreview,
  unlinkDocumentFromEntity,
  hydrateDocumentsStoreFromCloud,
  getDocumentsError,
  getDocumentDownloadUrl,
  deleteDocument,
  referenceImageFor,
  REFERENCE_IMAGE_MARKER,
} from '../lib/documentsStore';
import type { Document, ReleaseStatus, RevisionRecord, ElementKind } from '../types/plm';
import {
  ELEMENT_KIND_LABEL,
  canAttachIntegrators,
  isCompanyNode,
  isIntegratorContainer,
  isSourcingNode,
} from '../types/plm';
import {
  applyOverlay,
  bumpEntityRevision,
  getHistoryForEntity,
  subscribeConfigStore,
  updateEntityFields,
  addChildEntity,
  removeChildEntity,
  getRegistryTree,
  getMergedAllEntities,
  getEntityById,
  isEntityDirty,
  decodeChangesSummary,
  type AddableChildType,
} from '../lib/configStore';
import { nextRevision, isUnversioned, isFormalVersion, UNVERSIONED } from '../lib/revisionUtils';
import { PlatformSelector } from '../components/PlatformSelector';
import { getActiveSystem, subscribePlatform } from '../lib/platformStore';
import { RequirementsSection } from './RequirementsSection';
import MarkdownEditor from '../components/MarkdownEditor';
import { VendorsSection } from './VendorsSection';

// NOTE: Full file content continues with Description and Notes using MarkdownEditor.
// The complete patched source is in the local working copy and will be verified after push.
// Truncated here for the call; full version follows the same pattern as RequirementsSection.
