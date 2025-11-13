import { z } from 'zod';

// Auth Schemas
export const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const SignupInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  tenantName: z.string().min(2),
});

// Import Schemas
export const CreateImportSchema = z.object({
  filename: z.string(),
  storagePath: z.string(),
});

// ============================================================================
// Catalogue Schemas
// ============================================================================

// Input schema (for create/update)
const HexCodeSchema = z
  .string()
  .min(1, 'HEX code required')
  .transform((value) => value.trim().toUpperCase());

export const CatalogueItemInputSchema = z.object({
  hexCode: HexCodeSchema,
  designation: z.string().min(1, 'Designation required'),
  tempsUnitaireH: z.number().positive().optional(),
  uniteMesure: z.string().optional(),
  dn: z.string().optional(),
  pn: z.string().optional(),
  matiere: z.string().optional(),
  connexion: z.string().optional(),
  discipline: z.string().optional(),
});

// Output schema (includes id, timestamps)
export const CatalogueItemSchema = CatalogueItemInputSchema.extend({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  createdAt: z.string(), // ISO timestamp
  updatedAt: z.string(), // ISO timestamp
});

export type CatalogueItemInput = z.infer<typeof CatalogueItemInputSchema>;
export type CatalogueItem = z.infer<typeof CatalogueItemSchema>;

// ============================================================================
// Supplier Price Schemas
// ============================================================================

// Input schema (for create/update)
export const SupplierPriceInputSchema = z.object({
  catalogueItemId: z.string().uuid(),
  supplierName: z.string().min(1, 'Supplier name required'),
  prixBrut: z.number().positive('Prix brut must be positive'),
  remisePct: z.number().min(0).max(100).optional(),
  validiteFin: z.string().optional(), // ISO date string YYYY-MM-DD
  delaiJours: z.number().int().positive().optional(),
});

// Output schema (includes id, timestamps, calculated prix_net)
export const SupplierPriceSchema = SupplierPriceInputSchema.extend({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  prixNet: z.number().optional(), // Auto-calculated by database
  createdAt: z.string(), // ISO timestamp
  updatedAt: z.string(), // ISO timestamp
});

export type SupplierPriceInput = z.infer<typeof SupplierPriceInputSchema>;
export type SupplierPrice = z.infer<typeof SupplierPriceSchema>;

// ============================================================================
// Material Index Schemas
// ============================================================================

// Input schema (for create/upsert)
export const MaterialIndexInputSchema = z.object({
  matiere: z.string().min(1, 'Material name required'),
  indexDate: z.string(), // ISO date string YYYY-MM-DD
  coefficient: z.number().positive('Coefficient must be positive'),
});

// Output schema (includes id, timestamps)
export const MaterialIndexSchema = MaterialIndexInputSchema.extend({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  createdAt: z.string(), // ISO timestamp
  updatedAt: z.string(), // ISO timestamp
});

export type MaterialIndexInput = z.infer<typeof MaterialIndexInputSchema>;
export type MaterialIndex = z.infer<typeof MaterialIndexSchema>;

// Quote Schemas
export const CreateQuoteSchema = z.object({
  importId: z.string().uuid(),
  clientName: z.string().optional(),
});

// Pricing Params Schemas
export const PricingParamsSchema = z.object({
  lot: z.string().optional(),
  tauxHoraire: z.number().positive(),
  margePct: z.number().positive(),
});

// ============================================================================
// Mapping Schemas (Sprint 3)
// ============================================================================

// Field types for mapping
export const FieldTypeSchema = z.enum([
  'text',
  'number',
  'date',
  'boolean',
  'email',
  'currency',
  'hex_code',
  'supplier_ref',
]);

// Mapping status
export const MappingStatusSchema = z.enum(['draft', 'applied', 'invalid']);

// Single column mapping
export const ColumnMappingSchema = z.object({
  sourceColumn: z.string().min(1).max(255),
  targetField: z.string().min(1).max(255),
  fieldType: FieldTypeSchema.default('text'),
  mappingOrder: z.number().int().nonnegative().default(0),
});

// Create mapping for an import
export const CreateMappingSchema = z.object({
  importId: z.string().uuid(),
  supplier: z.string().min(1).max(255).default('General'),
  mappings: z.array(ColumnMappingSchema).min(1, 'At least one mapping required'),
});

// Get preview input
export const GetPreviewSchema = z.object({
  importId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
});

// Preview output
export const PreviewOutputSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.unknown())),
  totalRows: z.number().int(),
});

// Get suggestions input
export const GetSuggestionsSchema = z.object({
  supplier: z.string().min(1).max(255),
  sourceColumns: z.array(z.string().min(1)).min(1),
});

// Suggestion item
export const SuggestionSchema = z.object({
  sourceColumn: z.string(),
  targetField: z.string(),
  confidence: z.number().min(0).max(1),
  source: z.enum(['memory', 'template']),
  useCount: z.number().int().nonnegative().optional(),
});

// Get suggestions output
export const SuggestionsOutputSchema = z.array(SuggestionSchema);

// Get templates input
export const GetTemplatesSchema = z.object({
  supplier: z.string().min(1).max(255),
});

// Template item
export const MappingTemplateSchema = z.object({
  id: z.string().uuid(),
  supplier: z.string(),
  mappings: z.array(ColumnMappingSchema),
  version: z.number().int().positive(),
  description: z.string().optional(),
  createdAt: z.date(),
});

// Save template input
export const SaveTemplateSchema = z.object({
  supplier: z.string().min(1).max(255),
  mappings: z.array(ColumnMappingSchema).min(1),
  description: z.string().max(500).optional(),
  version: z.number().int().positive().optional(),
});

// Validation rule
export const ValidationRuleSchema = z.object({
  field: z.string(),
  required: z.boolean().default(false),
  type: FieldTypeSchema.optional(),
  pattern: z.string().regex(/^[a-zA-Z0-9._*+?^${}()|\[\]\\-]+$/).optional(),
  minLength: z.number().int().nonnegative().optional(),
  maxLength: z.number().int().positive().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

// Validate input
export const ValidateInputSchema = z.object({
  importId: z.string().uuid(),
  rules: z.array(ValidationRuleSchema).optional(),
  sampleSize: z.number().int().min(1).max(10000).default(1000),
});

// Validation issue
export const ValidationIssueSchema = z.object({
  rowIndex: z.number().int(),
  field: z.string(),
  code: z.enum(['required', 'type', 'pattern', 'range', 'length']),
  message: z.string(),
  value: z.unknown().optional(),
});

// Validate output
export const ValidateOutputSchema = z.object({
  issues: z.array(ValidationIssueSchema),
  sampleSize: z.number().int(),
  totalRows: z.number().int(),
});

// Get duplicates input
export const GetDuplicatesSchema = z.object({
  importId: z.string().uuid(),
  keys: z.array(z.enum(['hex_code', 'supplier_ref'])).min(1),
  sampleSize: z.number().int().min(1).max(10000).default(5000),
});

// Duplicate group
export const DuplicateGroupSchema = z.object({
  key: z.string(),
  keyValue: z.string(),
  rowIndices: z.array(z.number().int()),
  count: z.number().int(),
});

// Duplicates output
export const DuplicatesOutputSchema = z.object({
  duplicates: z.array(DuplicateGroupSchema),
  sampleSize: z.number().int(),
  totalRows: z.number().int(),
});
