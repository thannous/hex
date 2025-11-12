'use client';

import { ImportWizard } from '@/components/ImportWizard';
import { useMockImportFlow } from '@/hooks/testing/useMockImportFlow';

export function ImportWizardHarness() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Import Wizard Test Harness</h1>
        <ImportWizard tenantId="test-tenant" useImportFlowImpl={useMockImportFlow} />
      </div>
    </div>
  );
}
