'use client';

import { useEffect, useState } from 'react';
import { ImportWizard } from '@/components/ImportWizard';
import { useMockImportFlow } from '@/hooks/testing/useMockImportFlow';

export function ImportWizardHarness() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <div
      className="min-h-screen bg-gray-50 p-8"
      data-testid="import-harness"
      data-hydrated={isHydrated ? 'true' : 'false'}
    >
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Import Wizard Test Harness</h1>
        <ImportWizard tenantId="test-tenant" useImportFlowImpl={useMockImportFlow} />
      </div>
    </div>
  );
}
