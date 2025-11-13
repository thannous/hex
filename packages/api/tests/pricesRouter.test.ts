/**
 * Unit tests for pricesRouter
 *
 * Tests basic structure and validation logic.
 * E2E tests with real Supabase will be in Sprint 4 Day 7.
 */

import { describe, it, expect } from 'vitest';
import { SupplierPriceInputSchema, SupplierPriceSchema } from '../src/schemas';

describe('pricesRouter schemas', () => {
  describe('SupplierPriceInputSchema', () => {
    it('validates a valid supplier price input', () => {
      const validInput = {
        catalogueItemId: '550e8400-e29b-41d4-a716-446655440000',
        supplierName: 'Supplier ABC',
        prixBrut: 150.5,
        remisePct: 10,
        validiteFin: '2025-12-31',
        delaiJours: 15,
      };

      const result = SupplierPriceInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.catalogueItemId).toBe('550e8400-e29b-41d4-a716-446655440000');
        expect(result.data.supplierName).toBe('Supplier ABC');
        expect(result.data.prixBrut).toBe(150.5);
      }
    });

    it('requires catalogueItemId', () => {
      const invalidInput = {
        supplierName: 'Supplier ABC',
        prixBrut: 150.5,
      };

      const result = SupplierPriceInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('requires supplierName', () => {
      const invalidInput = {
        catalogueItemId: '550e8400-e29b-41d4-a716-446655440000',
        prixBrut: 150.5,
      };

      const result = SupplierPriceInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('requires positive prixBrut', () => {
      const invalidInput = {
        catalogueItemId: '550e8400-e29b-41d4-a716-446655440000',
        supplierName: 'Supplier ABC',
        prixBrut: -10,
      };

      const result = SupplierPriceInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('requires zero prixBrut fails', () => {
      const invalidInput = {
        catalogueItemId: '550e8400-e29b-41d4-a716-446655440000',
        supplierName: 'Supplier ABC',
        prixBrut: 0,
      };

      const result = SupplierPriceInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('validates remisePct range (0-100)', () => {
      const invalidInput = {
        catalogueItemId: '550e8400-e29b-41d4-a716-446655440000',
        supplierName: 'Supplier ABC',
        prixBrut: 100,
        remisePct: 101,
      };

      const result = SupplierPriceInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('accepts minimal valid input', () => {
      const minimalInput = {
        catalogueItemId: '550e8400-e29b-41d4-a716-446655440000',
        supplierName: 'Min Supplier',
        prixBrut: 1.0,
      };

      const result = SupplierPriceInputSchema.safeParse(minimalInput);
      expect(result.success).toBe(true);
    });

    it('requires valid UUID for catalogueItemId', () => {
      const invalidInput = {
        catalogueItemId: 'not-a-uuid',
        supplierName: 'Supplier ABC',
        prixBrut: 100,
      };

      const result = SupplierPriceInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('validates positive delaiJours', () => {
      const invalidInput = {
        catalogueItemId: '550e8400-e29b-41d4-a716-446655440000',
        supplierName: 'Supplier ABC',
        prixBrut: 100,
        delaiJours: -5,
      };

      const result = SupplierPriceInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('SupplierPriceSchema (output)', () => {
    it('validates complete supplier price with metadata', () => {
      const validOutput = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        catalogueItemId: '550e8400-e29b-41d4-a716-446655440002',
        supplierName: 'Supplier ABC',
        prixBrut: 150.5,
        remisePct: 10,
        prixNet: 135.45, // Calculated: 150.5 * (1 - 0.1)
        validiteFin: '2025-12-31',
        delaiJours: 15,
        createdAt: '2025-11-13T10:00:00Z',
        updatedAt: '2025-11-13T10:00:00Z',
      };

      const result = SupplierPriceSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('requires id and tenantId', () => {
      const invalidOutput = {
        catalogueItemId: '550e8400-e29b-41d4-a716-446655440002',
        supplierName: 'Supplier ABC',
        prixBrut: 150.5,
        createdAt: '2025-11-13T10:00:00Z',
        updatedAt: '2025-11-13T10:00:00Z',
      };

      const result = SupplierPriceSchema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });

    it('allows prixNet to be optional (calculated by database)', () => {
      const validOutput = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        catalogueItemId: '550e8400-e29b-41d4-a716-446655440002',
        supplierName: 'Supplier ABC',
        prixBrut: 150.5,
        createdAt: '2025-11-13T10:00:00Z',
        updatedAt: '2025-11-13T10:00:00Z',
      };

      const result = SupplierPriceSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });
  });
});

describe('pricesRouter procedures', () => {
  it('exports pricesRouter with expected procedures', async () => {
    const { pricesRouter } = await import('../src/router');

    expect(pricesRouter).toBeDefined();
    expect(pricesRouter._def).toBeDefined();
    expect(pricesRouter._def.procedures).toBeDefined();

    const procedures = Object.keys(pricesRouter._def.procedures);
    expect(procedures).toContain('list');
    expect(procedures).toContain('listByCatalogue');
    expect(procedures).toContain('getCheapestPrice');
    expect(procedures).toContain('create');
    expect(procedures).toContain('bulkCreate');
    expect(procedures).toContain('update');
    expect(procedures).toContain('delete');
  });
});
