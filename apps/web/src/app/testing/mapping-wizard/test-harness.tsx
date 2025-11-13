'use client';

import { useEffect, useMemo, useState } from 'react';
import { ColumnMapper } from '@/components/ColumnMapper';
import type { ColumnMapping, Suggestion } from '@hex/api';

const SAMPLE_COLUMNS = ['HEX Code', 'Designation', 'Matière'];

const SAMPLE_SUGGESTIONS: Suggestion[] = [
  {
    sourceColumn: 'HEX Code',
    targetField: 'hex_code',
    confidence: 0.92,
    source: 'memory',
    useCount: 12,
  },
  {
    sourceColumn: 'Designation',
    targetField: 'designation',
    confidence: 0.88,
    source: 'memory',
    useCount: 9,
  },
  {
    sourceColumn: 'Matière',
    targetField: 'matiere',
    confidence: 0.6,
    source: 'memory',
    useCount: 2,
  },
];

type Step = 'mapping' | 'review';

const REQUIRED_FIELDS = ['hex_code', 'designation'];

const PREFILL_MAPPINGS: ColumnMapping[] = [
  {
    sourceColumn: 'HEX Code',
    targetField: 'hex_code',
    fieldType: 'hex_code',
    mappingOrder: 0,
  },
  {
    sourceColumn: 'Designation',
    targetField: 'designation',
    fieldType: 'text',
    mappingOrder: 1,
  },
  {
    sourceColumn: 'Matière',
    targetField: 'matiere',
    fieldType: 'text',
    mappingOrder: 2,
  },
];

export function MappingWizardTestHarness() {
  const [step, setStep] = useState<Step>('mapping');
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const hasRequiredFields = useMemo(
    () =>
      REQUIRED_FIELDS.every((field) => mappings.some((mapping) => mapping.targetField === field)),
    [mappings]
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8" data-testid="mapping-harness">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Mapping Wizard Test Harness</h1>
          <p className="text-gray-600">
            This harness renders the real ColumnMapper component with local state so Playwright can
            validate the mapping → review → mapping round-trip without hitting Supabase.
          </p>
          <p className="mt-2 text-sm text-gray-500" data-testid="mapping-count">
            Current mappings: {mappings.length}
          </p>
        </div>

        {step === 'mapping' && (
          <div className="space-y-4" data-testid="mapping-step">
            <div className="flex justify-end">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                onClick={() => setMappings(PREFILL_MAPPINGS)}
                data-testid="prefill-mappings"
                data-hydrated={isHydrated ? 'true' : 'false'}
                disabled={!isHydrated}
              >
                Prefill sample mappings
              </button>
            </div>
            <ColumnMapper
              columns={SAMPLE_COLUMNS}
              mappings={mappings}
              suggestions={SAMPLE_SUGGESTIONS}
              onMappingsChange={setMappings}
            />

            <div className="flex gap-4">
              <button
                type="button"
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                onClick={() => setMappings([])}
                data-testid="reset-mappings"
              >
                Reset mappings
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!hasRequiredFields}
                onClick={() => setStep('review')}
                data-testid="go-review"
              >
                Go to Review →
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-4" data-testid="review-step">
            <div className="bg-white shadow rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">Review Mappings ({mappings.length})</h2>
              {mappings.length === 0 ? (
                <p className="text-sm text-gray-500">No mappings selected.</p>
              ) : (
                <ul className="space-y-2">
                  {mappings.map((mapping, index) => (
                    <li
                      key={`${mapping.sourceColumn}-${mapping.targetField}`}
                      className="flex items-center justify-between text-sm text-gray-700"
                      data-testid={`review-row-${index}`}
                    >
                      <span className="font-medium">{mapping.sourceColumn}</span>
                      <span className="text-gray-500">→</span>
                      <span>
                        <strong>{mapping.targetField}</strong>
                        <span className="text-gray-500 ml-1">({mapping.fieldType})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                onClick={() => setStep('mapping')}
                data-testid="back-to-mapping"
              >
                ← Back to Mapping
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                onClick={() => setMappings([])}
                data-testid="confirm-review"
              >
                Confirm & Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
