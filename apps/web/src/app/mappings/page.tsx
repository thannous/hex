/**
 * Mappings Page
 *
 * Interface for mapping DPGF imports to catalogue fields
 */

'use client';

import { MappingWizard } from '@/components/MappingWizard';

export default function MappingsPage() {
  const tenantId = 'demo-tenant-id'; // TODO: Get from context

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Column Mapping</h1>
          <p className="text-gray-600 mt-2">Map CSV columns to your catalogue fields</p>
        </div>

        {/* Wizard */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <MappingWizard
            tenantId={tenantId}
            onCompleted={(importId, version) => {
              console.log(`Mapping completed for import ${importId} (version ${version})`);
            }}
          />
        </div>

        {/* Info section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Data Preview</h3>
            <p className="text-gray-600 text-sm">
              View sample rows from your import to understand the data structure
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Suggestions</h3>
            <p className="text-gray-600 text-sm">
              Get AI-powered mapping suggestions based on your history and patterns
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Save Templates</h3>
            <p className="text-gray-600 text-sm">
              Save successful mappings as templates for faster imports next time
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
