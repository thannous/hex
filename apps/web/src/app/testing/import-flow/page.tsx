import { notFound } from 'next/navigation';
import { ImportWizardHarness } from './test-harness';

const TEST_ROUTES_ENABLED = process.env.NEXT_PUBLIC_ENABLE_TEST_ROUTES === 'true';

export default function ImportFlowTestPage() {
  if (!TEST_ROUTES_ENABLED) {
    notFound();
  }

  return <ImportWizardHarness />;
}
