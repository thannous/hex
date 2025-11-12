'use client';

/**
 * Wizard pour importer des fichiers DPGF
 * Étapes:
 * 1. Upload du fichier
 * 2. Aperçu des données parsées
 * 3. Mapping des colonnes
 */

import { useState } from 'react';
import { useImportFlow } from '@/hooks/useImportFlow';

interface ImportWizardProps {
  tenantId: string;
  onCompleted?: (importId: string, rowCount: number) => void;
}

export function ImportWizard({ tenantId, onCompleted }: ImportWizardProps) {
  const { state, startImport, importId } = useImportFlow();
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await handleFile(files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    // Valider l'extension
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      alert('Only CSV, XLSX, and XLS files are supported');
      return;
    }

    // Valider la taille (limit client-side parsing à 50MB pour CSV, 10MB pour XLSX)
    const maxSize = ext === 'csv' ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`File size exceeds limit (max ${maxSize / 1024 / 1024}MB). Will use server parsing.`);
    }

    await startImport(file, tenantId);
  };

  // Trigger callback when import completes
  React.useEffect(() => {
    if (state.step === 'complete' && state.rowCount && importId) {
      onCompleted?.(importId, state.rowCount);
    }
  }, [state.step, state.rowCount, importId, onCompleted]);

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Import DPGF</h2>

      {/* Step 1: Upload */}
      {state.step === 'idle' && (
        <div className="space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input
              type="file"
              id="file-input"
              onChange={handleChange}
              className="hidden"
              accept=".csv,.xlsx,.xls"
            />
            <label htmlFor="file-input" className="cursor-pointer block">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path
                  d="M28 8H12a4 4 0 00-4 4v24a4 4 0 004 4h24a4 4 0 004-4V20m-24-8v16m0-16l4-4m-4 4l-4-4m28 28l-4-4m4 4l4-4"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-4 text-lg font-medium text-gray-900">
                Drag and drop your file here, or click to select
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Supported formats: CSV, XLSX, XLS (max 50MB for CSV, 10MB for XLSX)
              </p>
            </label>
          </div>
        </div>
      )}

      {/* Step 2 & 3: Uploading / Parsing */}
      {(state.step === 'uploading' || state.step === 'parsing') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">
              {state.step === 'uploading' ? 'Uploading file...' : 'Parsing file...'}
            </h3>
            <span className="text-sm text-gray-600">{Math.round(state.progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          {state.filename && (
            <p className="text-sm text-gray-600">File: {state.filename}</p>
          )}
        </div>
      )}

      {/* Step 4: Complete */}
      {state.step === 'complete' && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <h3 className="font-medium text-green-800">Import successful!</h3>
                <p className="text-sm text-green-700">
                  {state.rowCount} rows parsed and stored
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 transition-colors"
          >
            Continue to Mapping
          </button>
        </div>
      )}

      {/* Error State */}
      {state.step === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="ml-3">
                <h3 className="font-medium text-red-800">Import failed</h3>
                <p className="text-sm text-red-700">{state.error}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-gray-600 text-white rounded-lg py-2 hover:bg-gray-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
