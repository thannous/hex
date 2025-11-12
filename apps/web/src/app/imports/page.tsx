/**
 * Page d'importation DPGF
 * Affiche le wizard d'import et la liste des imports
 */

'use client';

import { ImportWizard } from '@/components/ImportWizard';
import { ImportsList } from '@/components/ImportsList';
import { useState } from 'react';

export default function ImportsPage() {
  // TODO: Récupérer tenantId depuis le contexte utilisateur
  const tenantId = 'demo-tenant-id';
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">DPGF Imports</h1>
          <p className="text-gray-600 mt-2">Upload and manage your DPGF files (CSV, XLSX)</p>
        </div>

        {/* Import Wizard */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <ImportWizard
            tenantId={tenantId}
            onCompleted={(importId, rowCount) => {
              console.log(`Import ${importId} completed with ${rowCount} rows`);
              // Refresh the imports list
              setRefreshKey((k) => k + 1);
            }}
          />
        </div>

        {/* Imports List */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-bold mb-4">Recent Imports</h2>
          <ImportsList key={refreshKey} tenantId={tenantId} />
        </div>
      </div>
    </div>
  );
}
