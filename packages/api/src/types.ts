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
