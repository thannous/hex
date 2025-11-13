import { describe, expect, it } from 'vitest';
import {
  applyValidationRules,
  createNormalizedColumnsMap,
  detectDuplicateGroups,
  expandSuggestionsForColumns,
  normalizeSourceColumn,
  normalizeSupplierName,
  type RawImportRow,
  type SuggestionRow,
} from '../src/lib/mappingUtils';
import type { ValidationRule } from '../src/types';

describe('normalizeSourceColumn', () => {
  it('removes accents, case, and whitespace', () => {
    expect(normalizeSourceColumn('  Héx Code  ')).toBe('hex code');
    expect(normalizeSourceColumn('Matière')).toBe('matiere');
  });
});

describe('normalizeSupplierName', () => {
  it('trims spaces and falls back to General', () => {
    expect(normalizeSupplierName('   Supplier  ABC  ')).toBe('Supplier ABC');
    expect(normalizeSupplierName('')).toBe('General');
    expect(normalizeSupplierName(undefined)).toBe('General');
  });
});

describe('expandSuggestionsForColumns', () => {
  it('maps normalized suggestions back to every matching column', () => {
    const normalizedMap = createNormalizedColumnsMap(['HEX Code', 'Hex Code ', 'Designation']);
    const rows: SuggestionRow[] = [
      {
        source_column_original: 'hex code',
        source_column_normalized: 'hex code',
        target_field: 'hex_code',
        confidence: 0.9,
        use_count: 3,
      },
      {
        source_column_original: 'designation',
        source_column_normalized: 'designation',
        target_field: 'designation',
        confidence: 0.8,
        use_count: 1,
      },
    ];

    const suggestions = expandSuggestionsForColumns(normalizedMap, rows);

    expect(suggestions).toHaveLength(3);
    expect(suggestions.map((s) => s.sourceColumn)).toEqual(
      expect.arrayContaining(['HEX Code', 'Hex Code ', 'Designation'])
    );
    expect(suggestions.find((s) => s.sourceColumn === 'HEX Code')?.targetField).toBe('hex_code');
  });
});

describe('applyValidationRules', () => {
  it('returns issues for required, type, length, pattern, and range violations', () => {
    const rows: RawImportRow[] = [
      {
        row_index: 1,
        raw_data: { hex_code: '', designation: 'Valve', qty: 'abc', price: '-5' },
      },
      {
        row_index: 2,
        raw_data: { hex_code: 'HX-42', designation: '', qty: '10', price: '20' },
      },
    ];

    const rules: ValidationRule[] = [
      { field: 'hex_code', required: true, minLength: 3, pattern: '^[A-Z0-9\\-]+$' },
      { field: 'designation', required: true },
      { field: 'qty', type: 'number', min: 1, max: 100 },
      { field: 'price', type: 'currency', min: 0 },
    ];

    const issues = applyValidationRules(rows, rules);

    expect(issues).toHaveLength(4);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'required', field: 'hex_code', rowIndex: 1 }),
        expect.objectContaining({ code: 'type', field: 'qty', rowIndex: 1 }),
        expect.objectContaining({ code: 'type', field: 'price', rowIndex: 1 }),
        expect.objectContaining({ code: 'required', field: 'designation', rowIndex: 2 }),
      ])
    );
  });
});

describe('detectDuplicateGroups', () => {
  it('groups duplicate composite keys with row indices', () => {
    const rows: RawImportRow[] = [
      { row_index: 0, raw_data: { hex_code: 'HX-1', supplier_ref: 'ABC' } },
      { row_index: 1, raw_data: { hex_code: 'HX-2', supplier_ref: 'XYZ' } },
      { row_index: 2, raw_data: { hex_code: 'HX-1', supplier_ref: 'ABC' } },
      { row_index: 3, raw_data: { hex_code: 'HX-3', supplier_ref: 'XYZ' } },
      { row_index: 4, raw_data: { hex_code: 'HX-2', supplier_ref: 'DIFF' } },
    ];

    const duplicates = detectDuplicateGroups(rows, ['hex_code', 'supplier_ref']);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toMatchObject({
      key: 'hex_code, supplier_ref',
      keyValue: 'hex_code=HX-1 | supplier_ref=ABC',
      rowIndices: [0, 2],
      count: 2,
    });
  });
});
