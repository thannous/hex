'use client';

/**
 * Liste des imports DPGF avec suivi en temps réel
 * Affiche le statut, nombre de lignes, date de création, etc.
 */

import { trpc } from '@/lib/trpc';
import { formatDistanceToNow } from 'date-fns';

interface ImportsListProps {
  tenantId: string;
}

export function ImportsList({ tenantId }: ImportsListProps) {
  // Requête avec polling automatique toutes les 5 secondes
  const { data: imports, isLoading } = trpc.imports.list.useQuery(undefined, {
    refetchInterval: 5000, // Polling toutes les 5s
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading imports...</div>
      </div>
    );
  }

  if (!imports || imports.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No imports yet. Start by uploading a file above.</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
      case 'parsing':
        return 'bg-blue-100 text-blue-800';
      case 'parsed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'processing':
      case 'parsing':
        return 'Parsing...';
      case 'parsed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Filename
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Status
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Rows
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Created
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {imports.map((imp) => (
            <tr key={imp.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                {imp.filename}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(imp.status)}`}>
                  {getStatusLabel(imp.status)}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                {imp.rowCount > 0 ? imp.rowCount.toLocaleString() : '—'}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                {formatDistanceToNow(new Date(imp.createdAt), { addSuffix: true })}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm">
                {imp.status === 'parsed' ? (
                  <button className="text-blue-600 hover:text-blue-900">
                    View Mapping
                  </button>
                ) : imp.status === 'failed' ? (
                  <button className="text-gray-600 hover:text-gray-900">
                    Retry
                  </button>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
