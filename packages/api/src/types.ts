import type { TypedSupabaseClient } from '@hex/db';

export type TenantRole = 'admin' | 'engineer' | 'viewer';

export interface TenantContext {
  userId: string;
  tenantId: string;
  role: TenantRole;
  email: string;
  supabase: TypedSupabaseClient;
}

export interface AnonymousContext {
  userId: null;
  tenantId: null;
  role: 'anonymous';
  email: null;
  supabase: TypedSupabaseClient;
}

export type RequestContext = TenantContext | AnonymousContext;

export interface User {
  id: string;
  email: string;
  fullName: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export interface CatalogueItem {
  id: string;
  tenantId: string;
  hexCode: string;
  designation: string;
  tempsUnitaireH?: number;
  uniteMesure?: string;
  dn?: string;
  pn?: string;
  matiere?: string;
  connexion?: string;
  discipline?: string;
  createdAt: Date;
}

export interface SupplierPrice {
  id: string;
  tenantId: string;
  catalogueItemId: string;
  supplierName: string;
  prixBrut: number;
  remisePct: number;
  prixNet: number;
  validiteFin?: Date;
  delaiJours?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MaterialIndex {
  id: string;
  tenantId: string;
  matiere: string;
  date: Date;
  coefficient: number;
  createdAt: Date;
}

export interface DPGFImport {
  id: string;
  tenantId: string;
  userId: string;
  filename: string;
  storagePath: string;
  status: 'pending' | 'parsing' | 'parsed' | 'mapping' | 'completed' | 'failed';
  parsedAt?: Date;
  rowCount?: number;
  createdAt: Date;
}

export interface Quote {
  id: string;
  tenantId: string;
  userId: string;
  importId: string;
  quoteNumber?: string;
  clientName?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingParams {
  id: string;
  tenantId: string;
  lot?: string;
  tauxHoraire: number;
  margePct: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  tableName: string;
  recordId: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Mapping types (Sprint 3)
 */

export type FieldType = 'text' | 'number' | 'date' | 'boolean' | 'email' | 'currency' | 'hex_code' | 'supplier_ref';
export type MappingStatus = 'draft' | 'applied' | 'invalid';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  fieldType: FieldType;
  mappingOrder: number;
}

export interface DPGFMapping {
  id: string;
  tenantId: string;
  importId: string;
  sourceColumn: string;
  targetField: string;
  fieldType: FieldType;
  mappingOrder: number;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export interface MappingMemory {
  id: string;
  tenantId: string;
  sourceColumnOriginal: string;
  sourceColumnNormalized: string;
  supplier: string;
  targetField: string;
  confidence: number; // 0-1
  useCount: number;
  lastUsedAt: Date;
  createdAt: Date;
}

export interface MappingTemplate {
  id: string;
  tenantId: string;
  supplierName: string;
  mappings: ColumnMapping[];
  version: number;
  description?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Suggestion {
  sourceColumn: string;
  targetField: string;
  confidence: number;
  source: 'memory' | 'template';
  useCount?: number;
}

export interface DataPreview {
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: FieldType;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface ValidationIssue {
  rowIndex: number;
  field: string;
  code: 'required' | 'type' | 'pattern' | 'range' | 'length';
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  sampleSize: number;
  totalRows: number;
}

export interface DuplicateGroup {
  key: string; // 'hex_code' or 'supplier_ref'
  keyValue: string;
  rowIndices: number[];
  count: number;
}

export interface DuplicatesResult {
  duplicates: DuplicateGroup[];
  sampleSize: number;
  totalRows: number;
}
