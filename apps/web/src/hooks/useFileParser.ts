/**
 * Hook pour parser fichiers CSV/XLSX
 * Parsing client (Web Workers) avec fallback serveur automatique
 */

import { useCallback, useRef, useState } from 'react';

interface ParserConfig {
  forceServer?: boolean; // Forcer parsing serveur
}

interface ParseResult {
  data: any[];
  rowCount: number;
  columns?: string[];
  sheetName?: string;
}

interface ParserState {
  loading: boolean;
  progress: number; // 0-100
  error: string | null;
  shouldFallbackToServer: boolean;
}

export function useFileParser() {
  const [state, setState] = useState<ParserState>({
    loading: false,
    progress: 0,
    error: null,
    shouldFallbackToServer: false,
  });

  const workerRef = useRef<Worker | null>(null);
  const workerTypeRef = useRef<'csv' | 'xlsx' | null>(null);
  const abortRef = useRef(false);

  const getWorker = useCallback((type: 'csv' | 'xlsx') => {
    if (workerRef.current && workerTypeRef.current && workerTypeRef.current !== type) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL(
          type === 'csv'
            ? '../workers/csv-parser.worker.ts'
            : '../workers/xlsx-parser.worker.ts',
          import.meta.url
        ),
        { type: 'module' }
      );
    }

    workerTypeRef.current = type;
    return workerRef.current;
  }, []);

  const parseCSV = useCallback(
    async (file: File, config?: ParserConfig): Promise<ParseResult | null> => {
      if (config?.forceServer) {
        setState((s) => ({ ...s, shouldFallbackToServer: true }));
        return null;
      }

      setState({ loading: true, progress: 0, error: null, shouldFallbackToServer: false });
      abortRef.current = false;

      return new Promise((resolve) => {
        const worker = getWorker('csv');

        const allData: any[] = [];
        let totalRows = 0;

        worker.onmessage = (event) => {
          const { type, data, reason, error, rowCount, success } = event.data;

          if (type === 'chunk') {
            allData.push(...data);
            totalRows = rowCount;
            setState((s) => ({ ...s, progress: Math.min(90, (rowCount / 50_000) * 100) }));
          } else if (type === 'fallback') {
            // Basculer au serveur automatiquement
            setState({
              loading: false,
              progress: 0,
              error: null,
              shouldFallbackToServer: true,
            });
            console.warn(`[Parser] Fallback to server: ${reason}`);
            resolve(null);
          } else if (type === 'error') {
            setState({
              loading: false,
              progress: 0,
              error: `Parsing error: ${error}`,
              shouldFallbackToServer: false,
            });
            resolve(null);
          } else if (type === 'complete' && success) {
            setState({ loading: false, progress: 100, error: null, shouldFallbackToServer: false });
            resolve({
              data: allData,
              rowCount: totalRows,
            });
          }
        };

        worker.onerror = (error) => {
          setState({
            loading: false,
            progress: 0,
            error: `Worker error: ${error.message}`,
            shouldFallbackToServer: false,
          });
          resolve(null);
        };

        // Envoyer fichier au worker
        worker.postMessage({
          type: 'parse',
          file,
          config: { header: true, skipEmptyLines: true, dynamicTyping: false },
        });
      });
    },
    [getWorker]
  );

  const parseXLSX = useCallback(
    async (file: File, config?: ParserConfig): Promise<ParseResult | null> => {
      if (config?.forceServer) {
        setState((s) => ({ ...s, shouldFallbackToServer: true }));
        return null;
      }

      setState({ loading: true, progress: 0, error: null, shouldFallbackToServer: false });
      abortRef.current = false;

      return new Promise((resolve) => {
        const worker = getWorker('xlsx');

        worker.onmessage = (event) => {
          const { type, data, reason, error, rowCount, sheetName, columns, success } = event.data;

          if (type === 'fallback') {
            // Basculer au serveur automatiquement
            setState({
              loading: false,
              progress: 0,
              error: null,
              shouldFallbackToServer: true,
            });
            console.warn(`[Parser] Fallback to server: ${reason}`);
            resolve(null);
          } else if (type === 'error') {
            setState({
              loading: false,
              progress: 0,
              error: `Parsing error: ${error}`,
              shouldFallbackToServer: false,
            });
            resolve(null);
          } else if (type === 'complete' && success) {
            setState({ loading: false, progress: 100, error: null, shouldFallbackToServer: false });
            resolve({
              data,
              rowCount,
              sheetName,
              columns,
            });
          }
        };

        worker.onerror = (error) => {
          setState({
            loading: false,
            progress: 0,
            error: `Worker error: ${error.message}`,
            shouldFallbackToServer: false,
          });
          resolve(null);
        };

        // Envoyer fichier au worker
        worker.postMessage({
          type: 'parse',
          file,
        });
      });
    },
    [getWorker]
  );

  const abort = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'abort' });
    }
    abortRef.current = true;
    setState({ loading: false, progress: 0, error: 'Parsing aborted', shouldFallbackToServer: false });
  }, []);

  const cleanup = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    workerTypeRef.current = null;
  }, []);

  return {
    parseCSV,
    parseXLSX,
    abort,
    cleanup,
    ...state,
  };
}
