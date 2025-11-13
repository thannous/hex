import type {
  DuplicateGroup,
  Suggestion,
  ValidationIssue,
  ValidationRule,
} from '../types';

export type SuggestionRow = {
  source_column_original: string | null;
  source_column_normalized: string | null;
  target_field: string;
  confidence: number | null;
  use_count: number | null;
};

export type RawImportRow = {
  row_index: number;
  raw_data: unknown;
};

export const normalizeSourceColumn = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const DEFAULT_SUPPLIER = 'General';

export const normalizeSupplierName = (value?: string | null): string => {
  if (!value) return DEFAULT_SUPPLIER;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_SUPPLIER;
  return trimmed.replace(/\s+/g, ' ');
};

export const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

export const createNormalizedColumnsMap = (
  sourceColumns: string[]
): Map<string, string[]> => {
  return sourceColumns.reduce((acc, column) => {
    const normalized = normalizeSourceColumn(column);
    const existing = acc.get(normalized);

    if (existing) {
      existing.push(column);
    } else {
      acc.set(normalized, [column]);
    }

    return acc;
  }, new Map<string, string[]>());
};

export const expandSuggestionsForColumns = (
  normalizedColumnsMap: Map<string, string[]>,
  rows: SuggestionRow[]
): Suggestion[] => {
  return rows.flatMap((row) => {
    const normalizedKey =
      row.source_column_normalized ??
      (row.source_column_original ? normalizeSourceColumn(row.source_column_original) : null);

    const candidateColumns =
      (normalizedKey ? normalizedColumnsMap.get(normalizedKey) : undefined) ??
      (row.source_column_original ? [row.source_column_original] : []);

    if (!candidateColumns || candidateColumns.length === 0) {
      return [];
    }

    return candidateColumns.map((sourceColumn) => ({
      sourceColumn,
      targetField: row.target_field,
      confidence: row.confidence ?? 0.5,
      source: 'memory' as const,
      useCount: row.use_count ?? undefined,
    } satisfies Suggestion));
  });
};

export const applyValidationRules = (
  rows: RawImportRow[],
  rules?: ValidationRule[]
): ValidationIssue[] => {
  if (!rules || rules.length === 0) {
    return [];
  }

  const issues: ValidationIssue[] = [];

  for (const row of rows) {
    const rawData = asRecord(row.raw_data);

    for (const rule of rules) {
      const value = rawData[rule.field];

      if (rule.required && (value === null || value === undefined || value === '')) {
        issues.push({
          rowIndex: row.row_index,
          field: rule.field,
          code: 'required',
          message: `${rule.field} is required`,
          value,
        });
        continue;
      }

      if (value === null || value === undefined || value === '') {
        continue;
      }

      if (rule.type) {
        let isValidType = true;
        switch (rule.type) {
          case 'number':
            isValidType = !isNaN(Number(value));
            break;
          case 'date':
            isValidType = !isNaN(Date.parse(String(value)));
            break;
          case 'email':
            isValidType = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
            break;
          case 'currency':
            isValidType = !isNaN(Number(value)) && Number(value) >= 0;
            break;
          default:
            isValidType = true;
        }

        if (!isValidType) {
          issues.push({
            rowIndex: row.row_index,
            field: rule.field,
            code: 'type',
            message: `${rule.field} must be ${rule.type}`,
            value,
          });
          continue;
        }
      }

      if (rule.pattern) {
        const regex = new RegExp(rule.pattern);
        if (!regex.test(String(value))) {
          issues.push({
            rowIndex: row.row_index,
            field: rule.field,
            code: 'pattern',
            message: `${rule.field} does not match pattern ${rule.pattern}`,
            value,
          });
        }
      }

      const stringValue = String(value);

      if (rule.minLength !== undefined && stringValue.length < rule.minLength) {
        issues.push({
          rowIndex: row.row_index,
          field: rule.field,
          code: 'length',
          message: `${rule.field} must be at least ${rule.minLength} characters`,
          value,
        });
      }

      if (rule.maxLength !== undefined && stringValue.length > rule.maxLength) {
        issues.push({
          rowIndex: row.row_index,
          field: rule.field,
          code: 'length',
          message: `${rule.field} must be at most ${rule.maxLength} characters`,
          value,
        });
      }

      if (rule.type === 'number' || rule.type === 'currency') {
        const numericValue = Number(value);

        if (rule.min !== undefined && numericValue < rule.min) {
          issues.push({
            rowIndex: row.row_index,
            field: rule.field,
            code: 'range',
            message: `${rule.field} must be at least ${rule.min}`,
            value,
          });
        }

        if (rule.max !== undefined && numericValue > rule.max) {
          issues.push({
            rowIndex: row.row_index,
            field: rule.field,
            code: 'range',
            message: `${rule.field} must be at most ${rule.max}`,
            value,
          });
        }
      }
    }
  }

  return issues;
};

export const detectDuplicateGroups = (
  rows: RawImportRow[],
  keys: string[]
): DuplicateGroup[] => {
  if (!keys || keys.length === 0) {
    return [];
  }

  const duplicateMap = new Map<string, number[]>();

  for (const row of rows) {
    const rawData = asRecord(row.raw_data);
    const compositeKeyParts = keys.map((key) => {
      const value = rawData[key];
      return [key, value === null || value === undefined ? '' : String(value)];
    });

    const mapKey = JSON.stringify(compositeKeyParts);
    const indices = duplicateMap.get(mapKey);

    if (indices) {
      indices.push(row.row_index);
    } else {
      duplicateMap.set(mapKey, [row.row_index]);
    }
  }

  return Array.from(duplicateMap.entries())
    .filter(([, indices]) => indices.length > 1)
    .map(([mapKey, indices]) => {
      const parsedKey = JSON.parse(mapKey) as [string, string][];
      return {
        key: parsedKey.map(([key]) => key).join(', '),
        keyValue: parsedKey.map(([key, value]) => `${key}=${value}`).join(' | '),
        rowIndices: indices,
        count: indices.length,
      } satisfies DuplicateGroup;
    });
};
