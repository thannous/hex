/**
 * Unit tests for catalogueRouter
 *
 * Tests basic structure and validation logic.
 * E2E tests with real Supabase will be in Sprint 4 Day 7.
 */

import { describe, it, expect } from 'vitest';
import { CatalogueItemInputSchema, CatalogueItemSchema } from '../src/schemas';

describe('catalogueRouter schemas', () => {
  describe('CatalogueItemInputSchema', () => {
    it('validates a valid catalogue item input', () => {
      const validInput = {
        hexCode: 'A1B2C3',
        designation: 'Valve 100mm',
        tempsUnitaireH: 1.5,
        uniteMesure: 'unit',
        dn: '100',
        pn: '16',
        matiere: 'Acier',
        connexion: 'Flanged',
        discipline: 'Plumbing',
      };

      const result = CatalogueItemInputSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.hexCode).toBe('A1B2C3');
        expect(result.data.designation).toBe('Valve 100mm');
      }
    });

    it('requires hexCode', () => {
      const invalidInput = {
        designation: 'Valve 100mm',
      };

      const result = CatalogueItemInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('requires designation', () => {
      const invalidInput = {
        hexCode: 'A1B2C3',
      };

      const result = CatalogueItemInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('accepts minimal valid input', () => {
      const minimalInput = {
        hexCode: 'MIN123',
        designation: 'Minimal Item',
      };

      const result = CatalogueItemInputSchema.safeParse(minimalInput);
      expect(result.success).toBe(true);
    });

    it('rejects negative temps_unitaire_h', () => {
      const invalidInput = {
        hexCode: 'TEST',
        designation: 'Test',
        tempsUnitaireH: -1,
      };

      const result = CatalogueItemInputSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe('CatalogueItemSchema (output)', () => {
    it('validates complete catalogue item with metadata', () => {
      const validOutput = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        hexCode: 'A1B2C3',
        designation: 'Valve 100mm',
        tempsUnitaireH: 1.5,
        uniteMesure: 'unit',
        dn: '100',
        pn: '16',
        matiere: 'Acier',
        connexion: 'Flanged',
        discipline: 'Plumbing',
        createdAt: '2025-11-13T10:00:00Z',
        updatedAt: '2025-11-13T10:00:00Z',
      };

      const result = CatalogueItemSchema.safeParse(validOutput);
      expect(result.success).toBe(true);
    });

    it('requires id and tenantId', () => {
      const invalidOutput = {
        hexCode: 'TEST',
        designation: 'Test',
        createdAt: '2025-11-13T10:00:00Z',
        updatedAt: '2025-11-13T10:00:00Z',
      };

      const result = CatalogueItemSchema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });

    it('requires valid UUID for id', () => {
      const invalidOutput = {
        id: 'not-a-uuid',
        tenantId: '550e8400-e29b-41d4-a716-446655440001',
        hexCode: 'TEST',
        designation: 'Test',
        createdAt: '2025-11-13T10:00:00Z',
        updatedAt: '2025-11-13T10:00:00Z',
      };

      const result = CatalogueItemSchema.safeParse(invalidOutput);
      expect(result.success).toBe(false);
    });
  });
});

describe('catalogueRouter procedures', () => {
  it('exports catalogueRouter with expected procedures', async () => {
    const { catalogueRouter } = await import('../src/router');

    expect(catalogueRouter).toBeDefined();
    expect(catalogueRouter._def).toBeDefined();
    expect(catalogueRouter._def.procedures).toBeDefined();

    const procedures = Object.keys(catalogueRouter._def.procedures);
    expect(procedures).toContain('list');
    expect(procedures).toContain('getById');
    expect(procedures).toContain('create');
    expect(procedures).toContain('update');
    expect(procedures).toContain('delete');
    expect(procedures).toContain('importFromMapping');
  });
});
