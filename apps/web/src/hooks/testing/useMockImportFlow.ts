'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ImportFlowController, ImportFlowState } from '@/hooks/useImportFlow';

const INITIAL_STATE: ImportFlowState = {
  step: 'idle',
  progress: 0,
  error: null,
};

async function parseFile(file: File): Promise<number> {
  const extension = file.name.toLowerCase().split('.').pop() || '';

  if (extension === 'csv') {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return Math.max(lines.length - 1, 0); // subtract header row
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const XLSX = await import('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const primarySheet = workbook.SheetNames[0];
    const worksheet = primarySheet ? workbook.Sheets[primarySheet] : undefined;

    if (!worksheet) {
      return 0;
    }

    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    return rows.length;
  }

  throw new Error('Unsupported file format for mock flow');
}

export function useMockImportFlow(): ImportFlowController {
  const [state, setState] = useState<ImportFlowState>(INITIAL_STATE);

  const startImportInternal = useCallback(
    async (file: File) => {
      setState({
        step: 'parsing',
        progress: 25,
        error: null,
        filename: file.name,
      });

      try {
        const rowCount = await parseFile(file);

        const generatedId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `mock-import-${Date.now()}`;

        setState({
          step: 'complete',
          progress: 100,
          error: null,
          rowCount,
          filename: file.name,
          importId: generatedId,
        });
      } catch (error) {
        setState({
          step: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return useMemo<ImportFlowController>(
    () => ({
      state,
      importId: state.importId,
      filename: state.filename,
      reset,
      startImport: async (file: File, _tenantId: string) => {
        await startImportInternal(file);
      },
    }),
    [reset, startImportInternal, state]
  );
}
