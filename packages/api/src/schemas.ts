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

// Catalogue Schemas
export const CatalogueItemSchema = z.object({
  id: z.string().uuid().optional(),
  hexCode: z.string().min(1),
  designation: z.string().min(1),
  tempsUnitaireH: z.number().positive().optional(),
  uniteMesure: z.string().optional(),
  dn: z.string().optional(),
  pn: z.string().optional(),
  matiere: z.string().optional(),
  connexion: z.string().optional(),
  discipline: z.string().optional(),
});

// Supplier Price Schemas
export const SupplierPriceSchema = z.object({
  id: z.string().uuid().optional(),
  catalogueItemId: z.string().uuid(),
  supplierName: z.string().min(1),
  prixBrut: z.number().positive(),
  remisePct: z.number().min(0).max(100).default(0),
  validiteFin: z.date().optional(),
  delaiJours: z.number().int().positive().optional(),
});

// Material Index Schemas
export const MaterialIndexSchema = z.object({
  id: z.string().uuid().optional(),
  matiere: z.string().min(1),
  date: z.date(),
  coefficient: z.number().positive(),
});

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
