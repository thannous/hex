/**
 * Web Worker pour parsing XLSX
 * Utilise SheetJS pour traiter fichiers Excel
 *
 * Messages:
 * - input: { type: 'parse', file: Blob }
 * - output: { type: 'complete', data: any[], sheetName: string } | { type: 'fallback', reason: string } | { type: 'error', error: string }
 */

import * as XLSX from 'xlsx';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_SHEETS = 1; // Limitation une seule feuille pour MVP

self.onmessage = async (event: MessageEvent) => {
  const { type, file } = event.data;

  if (type === 'parse') {
    parseXLSX(file as Blob);
  }
};

async function parseXLSX(file: Blob) {
  try {
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

    // Lire fichier
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellFormula: true,
      cellStyles: false,
    });

    // Vérifier nombre de feuilles
    if (workbook.SheetNames.length > MAX_SHEETS) {
      self.postMessage({
        type: 'fallback',
        reason: 'multi_sheet',
        sheets: workbook.SheetNames,
        maxSheets: MAX_SHEETS,
      });
      return;
    }

    // Traiter première feuille
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      self.postMessage({
        type: 'error',
        error: 'No data found in Excel file',
      });
      return;
    }

    // Convertir en JSON
    const data = XLSX.utils.sheet_to_json(worksheet, {
      defval: '', // Valeur par défaut pour cellules vides
      blankrows: false,
    });

    if (data.length === 0) {
      self.postMessage({
        type: 'error',
        error: 'No data rows found in Excel sheet',
      });
      return;
    }

    self.postMessage({
      type: 'complete',
      data,
      sheetName,
      rowCount: data.length,
      columns: Object.keys(data[0] || {}),
      success: true,
    });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error parsing XLSX',
    });
  }
}
