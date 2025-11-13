/**
 * Web Worker pour parsing CSV
 * Utilise PapaParse en streaming pour gérer gros fichiers
 *
 * Messages:
 * - input: { type: 'parse', file: Blob, config: ParseConfig }
 * - output: { type: 'chunk', data: any[] } | { type: 'complete' } | { type: 'error', error: string }
 */

import Papa, { type ParseLocalConfig, type ParseResult } from 'papaparse';

const CHUNK_SIZE = 1000; // Nombre de lignes par chunk
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_ROWS = 500_000;

interface ParseConfig {
  header: boolean;
  skipEmptyLines: boolean;
  dynamicTyping: boolean;
}

let rowCount = 0;
let shouldAbort = false;

self.onmessage = (event: MessageEvent) => {
  const { type, file, config } = event.data;

  if (type === 'parse') {
    parseCSV(file as File, config as ParseConfig);
  } else if (type === 'abort') {
    shouldAbort = true;
  }
};

type CsvRow = Record<string, unknown>;

function parseCSV(file: File, config: ParseConfig) {
  // Vérifier taille
  if (file.size > MAX_FILE_SIZE) {
    self.postMessage({
      type: 'fallback',
      reason: 'file_too_large',
      size: file.size,
      maxSize: MAX_FILE_SIZE,
    });
    return;
  }

  rowCount = 0;
  shouldAbort = false;
  let currentChunk: CsvRow[] = [];

  const parseLocalFile = Papa.parse as unknown as (
    input: File,
    config: ParseLocalConfig<CsvRow, File>
  ) => void;

  parseLocalFile(file, {
    ...config,
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    chunk: (results: ParseResult<CsvRow>, parser: Papa.Parser) => {
      if (shouldAbort) {
        parser.abort();
        return;
      }

      currentChunk.push(...results.data);
      rowCount += results.data.length;

      // Envoyer un chunk tous les N lignes
      if (currentChunk.length >= CHUNK_SIZE) {
        self.postMessage({
          type: 'chunk',
          data: currentChunk,
          rowCount,
        });
        currentChunk = [];
      }

      // Vérifier limite de lignes
      if (rowCount > MAX_ROWS) {
        parser.abort();
        self.postMessage({
          type: 'fallback',
          reason: 'too_many_rows',
          rowCount,
          maxRows: MAX_ROWS,
        });
      }
    },
    error: (error: Error, _file: File) => {
      self.postMessage({
        type: 'error',
        error: error.message,
      });
    },
    complete: (_results: ParseResult<CsvRow>, _file: File) => {
      // Envoyer chunk final
      if (currentChunk.length > 0) {
        self.postMessage({
          type: 'chunk',
          data: currentChunk,
          rowCount,
        });
      }

      self.postMessage({
        type: 'complete',
        rowCount,
        success: true,
      });
    },
  });
}
