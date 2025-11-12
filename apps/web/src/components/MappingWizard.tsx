'use client';

/**
 * MappingWizard Component
 *
 * Multi-step wizard for mapping DPGF imports
 * Steps:
 * 1. Select import (with status filter)
 * 2. Data preview (first N rows)
 * 3. Column mapping (with suggestions)
 * 4. Review & save
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { DataPreview } from './DataPreview';
import { ColumnMapper } from './ColumnMapper';
import type { ColumnMapping, Suggestion } from '@hex/api';

interface MappingWizardProps {
  tenantId: string;
  onCompleted?: (importId: string, mappingVersion: number) => void;
}

type Step = 'select' | 'preview' | 'mapping' | 'review' | 'success';

export function MappingWizard({ tenantId, onCompleted }: MappingWizardProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [columns, setColumns] = useState<string[]>([]);

  // Fetch imports list
  const { data: imports, isLoading: importsLoading } = trpc.imports.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Fetch suggestions
  const { mutate: getSuggestions, isPending: suggestionsLoading } = trpc.mappings.getSuggestions.useMutation({
    onSuccess: (data) => {
      setSuggestions(data);
    },
  });

  // Save mappings
  const { mutateAsync: createMapping, isPending: savingMappings } = trpc.mappings.create.useMutation();

  // Filter imports that are parsed but not yet mapped
  const parsedImports = imports?.filter((imp) => imp.status === 'parsed') || [];

  const handleSelectImport = (importId: string) => {
    setSelectedImportId(importId);
    setStep('preview');
  };

  const handlePreviewComplete = (previewColumns: string[]) => {
    setColumns(previewColumns);

    // Auto-suggest mappings if supplier provided
    if (selectedSupplier && previewColumns.length > 0) {
      getSuggestions(
        {
          supplier: selectedSupplier,
          sourceColumns: previewColumns,
        },
        {
          onSuccess: () => {
            setStep('mapping');
          },
        }
      );
    } else {
      setStep('mapping');
    }
  };

  const handleMappingsChange = (newMappings: ColumnMapping[]) => {
    setMappings(newMappings);
  };

  const handleSaveMappings = async () => {
    if (!selectedImportId || mappings.length === 0) return;

    try {
      const result = await createMapping({
        importId: selectedImportId,
        mappings,
      });

      setStep('success');
      onCompleted?.(selectedImportId, result.version);
    } catch (error) {
      console.error('Failed to save mappings:', error);
      alert('Failed to save mappings. Please try again.');
    }
  };

  const hasRequiredFields = ['hex_code', 'designation'].every((field) =>
    mappings.some((m) => m.targetField === field)
  );

  return (
    <div className="max-w-4xl mx-auto">
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {(['select', 'preview', 'mapping', 'review', 'success'] as const).map((s, idx) => {
            const stepLabels: Record<Step, string> = {
              select: 'Select Import',
              preview: 'Preview Data',
              mapping: 'Map Columns',
              review: 'Review',
              success: 'Complete',
            };

            const isActive = step === s;
            const isCompleted =
              (['select', 'preview', 'mapping', 'review'].includes(step) &&
                ['select', 'preview', 'mapping', 'review'].indexOf(step as any) >= idx) ||
              step === 'success';

            return (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-colors ${
                    isActive || isCompleted
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {isCompleted && !isActive ? '✓' : idx + 1}
                </div>
                <div className="flex-1">
                  <div className={`h-1 ${
                    isCompleted ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                </div>
                <span className={`text-xs font-medium ml-2 whitespace-nowrap ${
                  isActive ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {stepLabels[s]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
        {/* Step 1: Select Import */}
        {step === 'select' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Select Import</h2>
              <p className="text-gray-600">Choose a parsed import to map columns</p>
            </div>

            {importsLoading ? (
              <div className="text-center py-8 text-gray-500">Loading imports...</div>
            ) : parsedImports.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No parsed imports found. Please upload and parse a file first.
              </div>
            ) : (
              <div className="space-y-3">
                {parsedImports.map((imp) => (
                  <button
                    key={imp.id}
                    onClick={() => handleSelectImport(imp.id)}
                    className="w-full text-left p-4 border border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 group-hover:text-blue-600">
                          {imp.filename}
                        </p>
                        <p className="text-sm text-gray-600">
                          {imp.rowCount.toLocaleString()} rows • Parsed{' '}
                          {new Date(imp.parsedAt!).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          ✓ Ready
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Supplier input */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supplier Name (for suggestions)
              </label>
              <input
                type="text"
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                placeholder="e.g., 'Supplier ABC', 'General'"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional: Helps get smarter suggestions based on historical mappings
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Preview Data */}
        {step === 'preview' && selectedImportId && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Preview Data</h2>
              <p className="text-gray-600">Review sample rows before mapping</p>
            </div>

            <DataPreview
              importId={selectedImportId}
              limit={10}
              onColumnsLoaded={(cols) => setColumns(cols)}
            />

            <div className="flex gap-4">
              <button
                onClick={() => setStep('select')}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                ← Back
              </button>
              <button
                onClick={() => handlePreviewComplete(columns)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Map Columns */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Map Columns</h2>
              <p className="text-gray-600">Match source columns to catalogue fields</p>
            </div>

            <ColumnMapper
              columns={columns}
              onMappingsChange={handleMappingsChange}
              suggestions={suggestions}
            />

            <div className="flex gap-4">
              <button
                onClick={() => setStep('preview')}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep('review')}
                disabled={!hasRequiredFields}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Review Mapping</h2>
              <p className="text-gray-600">Confirm before saving</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Mapped Columns ({mappings.length})</h3>
              <div className="space-y-2">
                {mappings.map((m) => (
                  <div key={m.sourceColumn} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      <strong>{m.sourceColumn}</strong>
                    </span>
                    <span className="text-gray-600">→</span>
                    <span className="text-gray-700">
                      <strong>{m.targetField}</strong>
                      <span className="text-gray-500 ml-2">({m.fieldType})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep('mapping')}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                ← Back
              </button>
              <button
                onClick={handleSaveMappings}
                disabled={savingMappings}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingMappings ? 'Saving...' : 'Save Mapping'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 'success' && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Mapping Saved!</h2>
            <p className="text-gray-600 mb-6">
              {mappings.length} columns mapped successfully
            </p>
            <button
              onClick={() => {
                // Reset wizard for next import
                setStep('select');
                setSelectedImportId(null);
                setMappings([]);
                setSuggestions([]);
                setColumns([]);
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Map Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
