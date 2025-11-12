/**
 * Hook pour gérer le flux d'import DPGF complet
 * 1. Upload du fichier vers Supabase Storage
 * 2. Création de l'enregistrement d'import
 * 3. Parsing côté client (Web Worker) ou serveur (Edge Function si fallback)
 * 4. Polling du statut
 */

import { useCallback, useRef, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { createBrowserClient } from '@hex/db';
import { useFileParser } from './useFileParser';

interface ImportFlowState {
  step: 'idle' | 'uploading' | 'parsing' | 'complete' | 'error';
  progress: number;
  error: string | null;
  importId?: string;
  rowCount?: number;
  filename?: string;
}

export function useImportFlow() {
  const [state, setState] = useState<ImportFlowState>({
    step: 'idle',
    progress: 0,
    error: null,
  });

  const supabaseRef = useRef<ReturnType<typeof createBrowserClient> | null>(null);
  const { parseCSV, parseXLSX } = useFileParser();
  const { mutateAsync: createImport } = trpc.imports.create.useMutation();
  const { mutateAsync: triggerServerParsing } = trpc.imports.triggerParsing.useMutation();
  const { data: importStatus } = trpc.imports.getStatus.useQuery(
    state.importId ? { importId: state.importId } : undefined,
    { enabled: !!state.importId, refetchInterval: 2000 } // Poll every 2s
  );

  // Initialiser le client Supabase au premier appel
  const getSupabaseClient = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    return supabaseRef.current;
  }, []);

  // Upload fichier vers Storage
  const uploadFile = useCallback(
    async (file: File, tenantId: string): Promise<string> => {
      const supabase = getSupabaseClient();
      const timestamp = Date.now();
      const storagePath = `${tenantId}/dpgf/${timestamp}_${file.name}`;

      const { data, error } = await supabase.storage
        .from('dpgf-uploads')
        .upload(storagePath, file, { cacheControl: '0' });

      if (error || !data) {
        throw new Error(`Upload failed: ${error?.message}`);
      }

      return storagePath;
    },
    [getSupabaseClient]
  );

  // Démarrer le flux d'import complet
  const startImport = useCallback(
    async (file: File, tenantId: string) => {
      setState({ step: 'uploading', progress: 0, error: null });

      try {
        // 1. Upload fichier
        console.log('[ImportFlow] Uploading file:', file.name);
        const storagePath = await uploadFile(file, tenantId);
        setState({ step: 'uploading', progress: 50, error: null });

        // 2. Créer l'enregistrement d'import
        console.log('[ImportFlow] Creating import record');
        const importData = await createImport({
          filename: file.name,
          storagePath,
        });

        setState({
          step: 'parsing',
          progress: 50,
          error: null,
          importId: importData.id,
          filename: importData.filename,
        });

        // 3. Parser le fichier
        const fileExt = file.name.toLowerCase().split('.').pop() || '';
        console.log('[ImportFlow] Parsing file:', fileExt);

        let parseResult = null;

        if (fileExt === 'csv') {
          parseResult = await parseCSV(file);
        } else if (fileExt === 'xlsx' || fileExt === 'xls') {
          parseResult = await parseXLSX(file);
        } else {
          throw new Error(`Unsupported file format: ${fileExt}`);
        }

        // 4. Si fallback au serveur (parseResult === null), déclencher Edge Function
        if (parseResult === null) {
          console.log('[ImportFlow] Fallback to server parsing');
          await triggerServerParsing({ importId: importData.id });
          // Le polling automatique via useQuery va mettre à jour le statut
        } else {
          // Parsing côté client réussi
          setState({
            step: 'complete',
            progress: 100,
            error: null,
            importId: importData.id,
            filename: importData.filename,
            rowCount: parseResult.rowCount,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ImportFlow] Error:', errorMessage);
        setState({
          step: 'error',
          progress: 0,
          error: errorMessage,
        });
      }
    },
    [uploadFile, createImport, parseCSV, parseXLSX, triggerServerParsing]
  );

  // Mettre à jour le statut quand le polling retourne des données
  const getDisplayStatus = useCallback(() => {
    if (importStatus) {
      const progress = importStatus.status === 'parsed' ? 100 : 75;
      return {
        ...state,
        step: importStatus.status === 'parsed' ? 'complete' : 'parsing',
        progress,
        rowCount: importStatus.rowCount,
      };
    }
    return state;
  }, [state, importStatus]);

  return {
    state: getDisplayStatus(),
    startImport,
    importId: state.importId,
    filename: state.filename,
  };
}
