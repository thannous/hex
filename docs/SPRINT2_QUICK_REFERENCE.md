# Sprint 2: Quick Reference Guide

## File Locations

| Component | Path | Lines | Purpose |
|-----------|------|-------|---------|
| CSV Parser | `apps/web/src/workers/csv-parser.worker.ts` | 110 | Streaming CSV with PapaParse |
| XLSX Parser | `apps/web/src/workers/xlsx-parser.worker.ts` | 100 | XLSX parsing with SheetJS |
| File Parser Hook | `apps/web/src/hooks/useFileParser.ts` | 210 | Worker lifecycle management |
| Import Flow Hook | `apps/web/src/hooks/useImportFlow.ts` | 180 | Complete workflow orchestration |
| Import Wizard | `apps/web/src/components/ImportWizard.tsx` | 200 | UI for file upload & progress |
| Imports List | `apps/web/src/components/ImportsList.tsx` | 150 | Real-time imports table |
| Imports Page | `apps/web/src/app/imports/page.tsx` | 47 | Route for `/imports` |
| Edge Function | `supabase/functions/parse-dpgf/index.ts` | 210 | Server parsing (Deno) |
| tRPC Router | `packages/api/src/router.ts` (importsRouter) | 165 | API procedures |
| API Types | `packages/api/src/types.ts` | 6 | Added Supabase client to context |
| tRPC Handler | `apps/web/src/app/api/trpc/[trpc]/route.ts` | 96 | JWT extraction & auth context |

## API Reference

### tRPC Procedures

```typescript
// Create import
import { trpc } from '@/lib/trpc';
const { mutateAsync: createImport } = trpc.imports.create.useMutation();
const result = await createImport({
  filename: 'suppliers.csv',
  storagePath: 'tenant-123/dpgf/1234567890_suppliers.csv'
});
// Returns: { id, filename, status: 'pending', storagePath }

// List imports
const { data: imports } = trpc.imports.list.useQuery();
// Returns: Array<{ id, filename, status, rowCount, parsedAt, createdAt }>

// Get status
const { data: status } = trpc.imports.getStatus.useQuery(
  { importId: 'imp-xyz' },
  { refetchInterval: 2000 } // Poll every 2s
);
// Returns: { id, filename, status, rowCount, parsedAt, createdAt }

// Trigger server parsing (fallback)
const { mutateAsync: triggerParsing } = trpc.imports.triggerParsing.useMutation();
await triggerParsing({ importId: 'imp-xyz' });
// Returns: { success: true, rowCount: number }
```

## Component Usage

### ImportWizard

```typescript
import { ImportWizard } from '@/components/ImportWizard';

<ImportWizard
  tenantId="tenant-123"
  onCompleted={(importId, rowCount) => {
    console.log(`Import ${importId} completed with ${rowCount} rows`);
    refreshImportsList();
  }}
/>

// Props:
// - tenantId: string (required) - Tenant ID for multi-tenancy
// - onCompleted: (importId: string, rowCount: number) => void (optional)
```

### ImportsList

```typescript
import { ImportsList } from '@/components/ImportsList';

<ImportsList tenantId="tenant-123" />

// Props:
// - tenantId: string (required) - Tenant ID
// Auto-polls every 5 seconds via TanStack Query
```

## Hooks

### useFileParser

```typescript
import { useFileParser } from '@/hooks/useFileParser';

const {
  parseCSV,
  parseXLSX,
  abort,
  cleanup,
  loading,
  progress,
  error,
  shouldFallbackToServer,
} = useFileParser();

// Parse CSV
const result = await parseCSV(file); // File object
// Returns: { data: any[], rowCount: number } or null if fallback

// Parse XLSX
const result = await parseXLSX(file);
// Returns: { data: any[], rowCount: number, sheetName: string, columns: string[] } or null

// Abort parsing
abort();

// Cleanup worker
cleanup();
```

### useImportFlow

```typescript
import { useImportFlow } from '@/hooks/useImportFlow';

const {
  state: { step, progress, error, importId, rowCount, filename },
  startImport,
} = useImportFlow();

// Start import process
await startImport(file, tenantId);

// State flow: idle → uploading → parsing → complete/error
// Progress: 0 → 50 (upload) → 100 (complete)
```

## Web Worker Message Protocol

### CSV Parser

**Input:**
```javascript
postMessage({
  type: 'parse',
  file: Blob,
  config: { header: true, skipEmptyLines: true, dynamicTyping: false }
});

// Abort
postMessage({ type: 'abort' });
```

**Output:**
```javascript
// While parsing
{ type: 'chunk', data: any[], rowCount: number }

// When complete
{ type: 'complete', rowCount: number, success: true }

// On fallback
{ type: 'fallback', reason: 'file_too_large' | 'too_many_rows' }

// On error
{ type: 'error', error: string }
```

### XLSX Parser

**Input:**
```javascript
postMessage({
  type: 'parse',
  file: Blob
});
```

**Output:**
```javascript
// Success
{
  type: 'complete',
  data: any[],
  sheetName: string,
  rowCount: number,
  columns: string[],
  success: true
}

// Fallback
{ type: 'fallback', reason: 'file_too_large' | 'multi_sheet' }

// Error
{ type: 'error', error: string }
```

## Configuration Constants

### CSV Parser
```typescript
const CHUNK_SIZE = 1000;           // Rows per chunk
const MAX_FILE_SIZE = 50 * 1024 * 1024;  // 50 MB
const MAX_ROWS = 500_000;          // 500k rows
```

### XLSX Parser
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024;  // 10 MB
const MAX_SHEETS = 1;              // Single sheet only
```

### TanStack Query Polling
```typescript
// In ImportsList
refetchInterval: 5000  // 5 seconds

// In useImportFlow (getStatus)
refetchInterval: 2000  // 2 seconds
```

## Database Queries

### Check import progress
```sql
SELECT id, filename, status, row_count, created_at
FROM dpgf_imports
WHERE tenant_id = $1
ORDER BY created_at DESC
LIMIT 20;
```

### Count rows by import
```sql
SELECT import_id, COUNT(*) as row_count
FROM dpgf_rows_raw
WHERE tenant_id = $1
GROUP BY import_id;
```

### Get raw data for import
```sql
SELECT raw_data
FROM dpgf_rows_raw
WHERE import_id = $1
ORDER BY row_index
LIMIT 10;
```

## Testing Scenarios

### Quick Test: Small CSV
```bash
# 1. Create test file (1000 rows)
echo "name,supplier,price" > test.csv
for i in {1..1000}; do echo "item$i,supplier$i,100.50" >> test.csv; done

# 2. Visit http://localhost:3000/imports
# 3. Drag-drop test.csv
# 4. Should complete in <2 seconds
# 5. Check ImportsList shows new import with status='parsed'
```

### Quick Test: Force Fallback
```bash
# 1. Edit csv-parser.worker.ts
const MAX_FILE_SIZE = 1 * 1024 * 1024; // Reduce to 1MB

# 2. Create large CSV (>1MB)
python3 -c "
import csv
with open('large.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['id', 'name', 'price'])
    for i in range(100000):
        w.writerow([i, f'item{i}', 100.50])
"

# 3. Upload large.csv
# 4. Should see fallback message in console
# 5. Status should change from 'processing' to 'parsed' after ~30s
```

## Debugging Tips

### Check Worker Status
```typescript
// In browser console
const worker = new Worker('...');
worker.onerror = (e) => console.error('Worker error:', e);
worker.onmessage = (e) => console.log('Worker message:', e.data);
```

### Check Edge Function Logs
```bash
# List all functions
npx supabase functions list

# View parse-dpgf logs
npx supabase functions logs parse-dpgf

# Follow logs in real-time
npx supabase functions logs parse-dpgf --tail
```

### Monitor tRPC Calls
```typescript
// DevTools → Network tab
// Filter by /api/trpc
// Each request shows input/output
```

### Database Health Check
```sql
-- Check dpgf_imports table
SELECT COUNT(*) as total,
       COUNT(*) FILTER (WHERE status = 'parsed') as completed,
       COUNT(*) FILTER (WHERE status = 'processing') as processing,
       COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM dpgf_imports;
```

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Unsupported file format" | Wrong file extension | Upload .csv, .xlsx, or .xls |
| "File size exceeds limit" | File > 50MB (CSV) or 10MB (XLSX) | Use larger file or server parsing |
| Worker error | Worker script not found | Check webpack config for worker loading |
| "Failed to create import" | DB insert error | Check tenantId exists, RLS policies |
| Status stays "parsing" | Edge Function stuck | Check Edge Function logs, Storage permissions |
| Polling not working | Query not enabled | Add `enabled: !!importId` to useQuery |

## Performance Tuning

### For Large CSVs (>100MB)
- Use server-side parsing (automatic)
- Monitor Edge Function memory usage
- Consider batch size adjustments

### For Memory Constraints
- Reduce `CHUNK_SIZE` from 1000 to 500
- Reduce `MAX_ROWS` from 500k to 250k

### For Faster Polling
- Reduce `refetchInterval` from 5000 to 2000 (but increases server load)
- Use `staleTime` to reduce unnecessary refetches

## Next Steps (Sprint 3)

1. **Data Preview**: Show first 10 rows from dpgf_rows_raw
2. **Column Mapping**: Map CSV columns to catalogue fields
3. **Mapping Memory**: Learn from previous mappings
4. **Validation**: Ensure data quality before processing
5. **Templates**: Save mappings for reuse by supplier

---

For detailed information, see:
- `docs/SPRINT2_IMPORT_SYSTEM.md` - Architecture & detailed testing
- `docs/SPRINT2_SUMMARY.md` - Project summary & metrics
