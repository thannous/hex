'use client';

/**
 * DataPreview Component
 *
 * Displays first N rows from imported file with:
 * - Sticky header for easy column reference
 * - Copy functionality for headers
 * - Pagination controls
 * - Loading and error states
 */

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';

interface DataPreviewProps {
  importId: string;
  limit?: number;
  // Optional: notify parent about detected columns
  onColumnsLoaded?: (columns: string[]) => void;
}

export function DataPreview({ importId, limit = 10, onColumnsLoaded }: DataPreviewProps) {
  const [offset, setOffset] = useState(0);
  const [copiedColumn, setCopiedColumn] = useState<string | null>(null);

  // Fetch preview with pagination
  const {
    data: preview,
    isLoading,
    error,
  } = trpc.mappings.getPreview.useQuery(
    { importId, limit, offset },
    { refetchOnWindowFocus: false }
  );

  // Reset offset on importId change
  useEffect(() => {
    setOffset(0);
  }, [importId]);

  // Propagate columns to parent when available/changed
  useEffect(() => {
    if (preview && Array.isArray(preview.columns) && preview.columns.length > 0) {
      onColumnsLoaded?.(preview.columns);
    }
    // We intentionally depend on preview?.columns reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.columns]);

  const handleCopyColumn = (columnName: string) => {
    navigator.clipboard.writeText(columnName);
    setCopiedColumn(columnName);
    setTimeout(() => setCopiedColumn(null), 2000);
  };

  const canGoPrev = offset > 0;
  const canGoNext = preview ? offset + limit < preview.totalRows : false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading preview...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">Failed to load preview</p>
        <p className="text-red-700 text-sm">{error.message}</p>
      </div>
    );
  }

  if (!preview || preview.columns.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data found in import</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">Data Preview</h3>
          <p className="text-sm text-gray-500">
            Showing rows {offset + 1}-{Math.min(offset + limit, preview.totalRows)} of{' '}
            {preview.totalRows.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Scrollable table with sticky header */}
      <div className="overflow-x-auto border border-gray-300 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 bg-gray-50 w-12">
                #
              </th>
              {preview.columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 bg-gray-50 whitespace-nowrap"
                >
                  <button
                    onClick={() => handleCopyColumn(col)}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors group"
                    title="Click to copy"
                  >
                    <span className="truncate max-w-xs">{col}</span>
                    <svg
                      className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 011 1v2h4a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h4V3z" />
                    </svg>
                    {copiedColumn === col && (
                      <span className="text-xs text-green-600">copied!</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {preview.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-xs text-gray-500 font-medium bg-gray-50 sticky left-0 z-9">
                  {offset + rowIndex + 1}
                </td>
                {preview.columns.map((col) => (
                  <td key={`${rowIndex}-${col}`} className="px-4 py-3 text-sm text-gray-900">
                    <div className="truncate max-w-sm" title={String(row[col] || '')}>
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : '—'}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">{preview.columns.length} columns</div>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={!canGoPrev}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={!canGoNext}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
