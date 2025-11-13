/**
 * Unit tests for indicesRouter
 *
 * Tests basic structure and validation logic.
 * E2E tests with real Supabase will be in Sprint 4 Day 7.
 */

import { describe, it, expect } from 'vitest';
import { MaterialIndexInputSchema, MaterialIndexSchema } from '../src/schemas';

describe('indicesRouter schemas', () => {
  describe('MaterialIndexInputSchema', () => {
    it('validates a valid material index input', () => {
      const validInput = {
        matiere: 'Acier',
        indexDate: '2025-11-13',
        coefficient: 1.25,
      };

      const result = MaterialIndexInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.matiere).toBe('Acier');
        expect(result.data.indexDate).toBe('2025-11-13');
        expect(result.data.coefficient).toBe(1.25);
      }
    });

    it('requires matiere', () => {
      const invalidInput = {
        indexDate: '2025-11-13',
        coefficient: 1.25,
      };

      const result = MaterialIndexInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('requires indexDate', () => {
      const invalidInput = {
        matiere: 'Acier',
        coefficient: 1.25,
      };

      const result = MaterialIndexInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('requires positive coefficient', () => {
      const invalidInput = {
        matiere: 'Acier',
        indexDate: '2025-11-13',
        coefficient: -1.5,
      };

      const result = MaterialIndexInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('rejects zero coefficient', () => {
      const invalidInput = {
        matiere: 'Acier',
        indexDate: '2025-11-13',
        coefficient: 0,
      };

      const result = MaterialIndexInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('accepts decimal coefficients', () => {
      const validInput = {
        matiere: 'Cuivre',
        indexDate: '2025-11-13',
        coefficient: 1.123456,
      };

      const result = MaterialIndexInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('rejects invalid date format', () => {
      const invalidInput = {
        matiere: 'Acier',
        indexDate: '13/11/2025', // Wrong format
        coefficient: 1.25,
      };

      const result = MaterialIndexInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('accepts valid ISO date format', () => {
      const validInput = {
        matiere: 'Acier',
        indexDate: '2025-11-13', // YYYY-MM-DD
        coefficient: 1.25,
      };

      const result = MaterialIndexInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('MaterialIndexSchema (output)', () => {
    it('validates complete material index with metadata', () => {
      const validOutput = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        matiere: 'Acier',
        indexDate: '2025-11-13',
        coefficient: 1.25,
        createdAt: '2025-11-13T10:00:00Z',
        updatedAt: '2025-11-13T10:00:00Z',
      };

      const result = MaterialIndexSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('requires id and tenantId', () => {
      const invalidOutput = {
        matiere: 'Acier',
        indexDate: '2025-11-13',
        coefficient: 1.25,
        createdAt: '2025-11-13T10:00:00Z',
        updatedAt: '2025-11-13T10:00:00Z',
      };

      const result = MaterialIndexSchema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });

    it('requires valid UUID for id', () => {
      const invalidOutput = {
        id: 'not-a-uuid',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        matiere: 'Acier',
        indexDate: '2025-11-13',
        coefficient: 1.25,
        createdAt: '2025-11-13T10:00:00Z',
        updatedAt: '2025-11-13T10:00:00Z',
      };

      const result = MaterialIndexSchema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });

    it('validates different material types', () => {
      const materials = ['Acier', 'Cuivre', 'PVC', 'Fonte', 'Inox'];

      materials.forEach((matiere) => {
        const output = {
          id: '550e8400-e29b-41d4-a716-446655440000',
          tenantId: '550e8400-e29b-41d4-a716-446655440001',
          matiere,
          indexDate: '2025-11-13',
          coefficient: 1.0,
          createdAt: '2025-11-13T10:00:00Z',
          updatedAt: '2025-11-13T10:00:00Z',
        };

        const result = MaterialIndexSchema.safeParse(output);
        expect(result.success).toBe(true);
      });
    });
  });
});

describe('indicesRouter procedures', () => {
  it('exports indicesRouter with expected procedures', async () => {
    const { indicesRouter } = await import('../src/router');

    expect(indicesRouter).toBeDefined();
    expect(indicesRouter._def).toBeDefined();
    expect(indicesRouter._def.procedures).toBeDefined();

    const procedures = Object.keys(indicesRouter._def.procedures);
    expect(procedures).toContain('list');
    expect(procedures).toContain('listByMaterial');
    expect(procedures).toContain('getLatest');
    expect(procedures).toContain('listMaterials');
    expect(procedures).toContain('create');
    expect(procedures).toContain('bulkUpsert');
    expect(procedures).toContain('update');
    expect(procedures).toContain('delete');
  });

  it('has exactly 8 procedures', async () => {
    const { indicesRouter } = await import('../src/router');
    const procedures = Object.keys(indicesRouter._def.procedures);
    expect(procedures).toHaveLength(8);
  });
});
