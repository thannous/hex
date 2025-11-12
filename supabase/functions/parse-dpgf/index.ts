/**
 * Edge Function Supabase: Parser DPGF files côté serveur
 *
 * POST /functions/v1/parse-dpgf
 * Body: { storagePath: string, importId: string, tenantId: string }
 *
 * Parsing gros fichiers (CSV >50MB, XLSX >10MB, multi-sheet)
 * Stocke données normalisées dans dpgf_rows_raw
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Deno built-ins pour parsing
import { readableStreamFromReader } from 'https://deno.land/std@0.168.0/streams/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ParseDPGFRequest {
  storagePath: string;
  importId: string;
  tenantId: string;
}

interface DPGFRow {
  tenant_id: string;
  import_id: string;
  row_index: number;
  raw_data: Record<string, any>;
}

serve(async (req: Request) => {
  let body: ParseDPGFRequest | null = null;
  try {
    // Vérifier la méthode
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    body = await req.json();
    const { storagePath, importId, tenantId } = body;

    if (!storagePath || !importId || !tenantId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`[parse-dpgf] Starting: ${storagePath} (import: ${importId})`);

    // 1. Update import status to 'processing'
    await supabase.from('dpgf_imports').update({ status: 'processing' }).eq('id', importId);

    // 2. Télécharger fichier depuis Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('dpgf-uploads')
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download file: ${downloadError?.message}`);
    }

    // 3. Parser le fichier selon extension
    let rows: Record<string, any>[] = [];
    const ext = storagePath.toLowerCase().split('.').pop();

    if (ext === 'csv') {
      rows = await parseCSV(fileData);
    } else if (ext === 'xlsx' || ext === 'xls') {
      rows = await parseXLSX(fileData);
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    console.log(`[parse-dpgf] Parsed ${rows.length} rows`);

    // 4. Normaliser et préparer données pour insertion
    const normalizedRows: DPGFRow[] = rows.map((row, idx) => ({
      tenant_id: tenantId,
      import_id: importId,
      row_index: idx,
      raw_data: row,
    }));

    // 5. Insérer en batch (par chunks de 1000 pour éviter les limites)
    const BATCH_SIZE = 1000;
    for (let i = 0; i < normalizedRows.length; i += BATCH_SIZE) {
      const batch = normalizedRows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from('dpgf_rows_raw').insert(batch);

      if (insertError) {
        throw new Error(`Failed to insert rows: ${insertError.message}`);
      }

      console.log(`[parse-dpgf] Inserted ${Math.min(BATCH_SIZE, normalizedRows.length - i)} rows`);
    }

    // 6. Update import status to 'parsed' + row_count
    const { error: updateError } = await supabase
      .from('dpgf_imports')
      .update({
        status: 'parsed',
        parsed_at: new Date().toISOString(),
        row_count: normalizedRows.length,
      })
      .eq('id', importId);

    if (updateError) {
      throw new Error(`Failed to update import: ${updateError.message}`);
    }

    console.log(`[parse-dpgf] Completed: ${normalizedRows.length} rows parsed and stored`);

    return new Response(
      JSON.stringify({
        success: true,
        rowCount: normalizedRows.length,
        importId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[parse-dpgf] Error:', errorMessage);

    const importId = body?.importId;
    if (importId) {
      await supabase
        .from('dpgf_imports')
        .update({ status: 'failed' })
        .eq('id', importId)
        .catch(() => {});
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Parser CSV using text parsing (since we can't import PapaParse in Edge)
 */
async function parseCSV(file: Blob): Promise<Record<string, any>[]> {
  const text = await file.text();
  const lines = text.split('\n').filter((l) => l.trim());

  if (lines.length === 0) {
    return [];
  }

  // Parser manuellement (simple CSV, pas de guillemets complexes)
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, any>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, any> = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Parser XLSX using Deno + built-in modules
 * Note: Pour MVP, on peut utiliser xlsx npm package via es.sh
 */
async function parseXLSX(file: Blob): Promise<Record<string, any>[]> {
  // Pour MVP, on importe xlsx depuis esm.sh (nécessite dynamic import)
  // En production, considérer un service XLSX dédié ou parser customisé
  const XLSX = await import('https://esm.sh/xlsx@0.18.5');

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  if (workbook.SheetNames.length === 0) {
    return [];
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    return [];
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  return rows;
}
