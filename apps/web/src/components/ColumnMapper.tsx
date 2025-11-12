'use client';

/**
 * ColumnMapper Component
 *
 * Maps source CSV columns to target catalogue fields
 * Features:
 * - Dropdown selection for target field
 * - Field type configuration (text, number, date, etc)
 * - Search/filter for large catalogues
 * - Drag-enabled reordering (basic implementation)
 * - Visual feedback for required fields
 */

import { useState } from 'react';
import type { ColumnMapping, FieldType } from '@hex/api';

interface ColumnMapperProps {
  columns: string[];
  onMappingsChange: (mappings: ColumnMapping[]) => void;
  catalogueFields?: string[];
  suggestions?: Array<{
    sourceColumn: string;
    targetField: string;
    confidence: number;
  }>;
}

const CATALOGUE_FIELDS = [
  'hex_code',
  'designation',
  'tempsUnitaireH',
  'uniteMesure',
  'dn',
  'pn',
  'matiere',
  'connexion',
  'discipline',
];

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'email', label: 'Email' },
  { value: 'currency', label: 'Currency' },
  { value: 'hex_code', label: 'HEX Code' },
  { value: 'supplier_ref', label: 'Supplier Reference' },
];

const REQUIRED_FIELDS = ['hex_code', 'designation'];

export function ColumnMapper({
  columns,
  onMappingsChange,
  catalogueFields = CATALOGUE_FIELDS,
  suggestions,
}: ColumnMapperProps) {
  const [mappings, setMappings] = useState<Map<string, ColumnMapping>>(new Map());
  const [searchField, setSearchField] = useState('');

  const handleMapColumn = (sourceColumn: string, targetField: string) => {
    const newMappings = new Map(mappings);
    const existingMapping = newMappings.get(sourceColumn);

    newMappings.set(sourceColumn, {
      sourceColumn,
      targetField,
      fieldType: existingMapping?.fieldType || 'text',
      mappingOrder: existingMapping?.mappingOrder || Array.from(newMappings.keys()).length,
    });

    setMappings(newMappings);
    onMappingsChange(Array.from(newMappings.values()).sort((a, b) => a.mappingOrder - b.mappingOrder));
  };

  const handleFieldTypeChange = (sourceColumn: string, fieldType: FieldType) => {
    const newMappings = new Map(mappings);
    const mapping = newMappings.get(sourceColumn);

    if (mapping) {
      newMappings.set(sourceColumn, {
        ...mapping,
        fieldType,
      });

      setMappings(newMappings);
      onMappingsChange(
        Array.from(newMappings.values()).sort((a, b) => a.mappingOrder - b.mappingOrder)
      );
    }
  };

  const handleUnmapColumn = (sourceColumn: string) => {
    const newMappings = new Map(mappings);
    newMappings.delete(sourceColumn);
    setMappings(newMappings);
    onMappingsChange(Array.from(newMappings.values()));
  };

  // Get suggestion for a source column
  const getSuggestion = (sourceColumn: string) => {
    return suggestions?.find((s) => s.sourceColumn === sourceColumn);
  };

  // Filter catalogue fields by search
  const filteredFields = catalogueFields.filter((field) =>
    field.toLowerCase().includes(searchField.toLowerCase())
  );

  const mappedFieldsCount = mappings.size;
  const requiredFieldsMapped = REQUIRED_FIELDS.every((field) =>
    Array.from(mappings.values()).some((m) => m.targetField === field)
  );

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Column Mapping</h3>
          <p className="text-sm text-gray-500">
            Map {mappedFieldsCount}/{columns.length} columns
            {!requiredFieldsMapped && (
              <span className="text-orange-600 ml-2">
                (Required fields: HEX code, Designation)
              </span>
            )}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          requiredFieldsMapped ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
        }`}>
          {requiredFieldsMapped ? '✓ Ready' : 'Missing fields'}
        </div>
      </div>

      {/* Search for catalogue fields */}
      <div>
        <input
          type="text"
          placeholder="Search catalogue fields..."
          value={searchField}
          onChange={(e) => setSearchField(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Mapping list */}
      <div className="space-y-3">
        {columns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No columns to map
          </div>
        ) : (
          columns.map((sourceColumn, index) => {
            const mapping = mappings.get(sourceColumn);
            const suggestion = getSuggestion(sourceColumn);
            const targetField = mapping?.targetField || '';
            const isRequired = REQUIRED_FIELDS.includes(targetField);
            const confidenceColor =
              suggestion && suggestion.confidence > 0.7
                ? 'bg-green-100 text-green-800'
                : suggestion && suggestion.confidence > 0.4
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800';

            return (
              <div
                key={sourceColumn}
                className={`p-4 border rounded-lg transition-colors ${
                  mapping ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
                } hover:border-blue-300`}
              >
                {/* Source column */}
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 truncate">{sourceColumn}</p>
                        {suggestion && (
                          <p className="text-xs text-gray-600 mt-1">
                            Suggestion:{' '}
                            <span className={`px-2 py-0.5 rounded ${confidenceColor}`}>
                              {suggestion.targetField} ({(suggestion.confidence * 100).toFixed(0)}%)
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Target field selector */}
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700">Target Field</label>
                      <select
                        value={targetField}
                        onChange={(e) => handleMapColumn(sourceColumn, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Select field —</option>
                        {(searchField ? filteredFields : catalogueFields).map((field) => (
                          <option key={field} value={field}>
                            {field}
                            {REQUIRED_FIELDS.includes(field) ? ' (required)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Field type selector (if mapped) */}
                    {mapping && (
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Field Type
                        </label>
                        <select
                          value={mapping.fieldType}
                          onChange={(e) => handleFieldTypeChange(sourceColumn, e.target.value as FieldType)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {FIELD_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Action button */}
                  {mapping && (
                    <button
                      onClick={() => handleUnmapColumn(sourceColumn)}
                      className="mt-1 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                      title="Unmap column"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Mapped indicator */}
                {mapping && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-2 rounded">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Mapped to <strong>{mapping.targetField}</strong> as <strong>{mapping.fieldType}</strong>
                    {isRequired && <span className="ml-2 px-2 py-0.5 bg-orange-200 text-orange-800 rounded">Required</span>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>{mappedFieldsCount}</strong> column(s) mapped,{' '}
          <strong>{columns.length - mappedFieldsCount}</strong> unmapped
        </p>
        {!requiredFieldsMapped && (
          <p className="text-sm text-orange-800 mt-2">
            ⚠️ Please map required fields: <strong>hex_code</strong> and <strong>designation</strong>
          </p>
        )}
      </div>
    </div>
  );
}
