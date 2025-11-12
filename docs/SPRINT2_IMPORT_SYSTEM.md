# Sprint 2: Hybrid DPGF Import System

## Overview

Sprint 2 implements a complete, production-ready DPGF import system with intelligent hybrid parsing:
- **Client-side parsing** via Web Workers for small/medium files (fast, no server load)
- **Automatic fallback** to server-side Edge Functions for large files
- **Real-time status tracking** with TanStack Query polling
- **Type-safe API** via tRPC with automatic TypeScript inference

## Architecture

### Component Stack

```
User → ImportWizard (UI)
    ↓
useImportFlow (Orchestration)
    ├─ uploadFile() → Supabase Storage
    ├─ createImport() → tRPC → Database
    └─ parseFile()
        ├─ Client: Web Worker (CSV/XLSX)
        │   ├─ parseCSV() with streaming (50MB max)
        │   └─ parseXLSX() single-sheet (10MB max)
        └─ Server: Edge Function (fallback)
            ├─ Download from Storage
            ├─ Parse file
            ├─ Normalize rows
            └─ Batch insert to dpgf_rows_raw
```

### Data Flow

1. **Upload Phase**
   - User selects file via ImportWizard
   - File uploaded to `Supabase Storage/dpgf-uploads/{tenantId}/dpgf/{timestamp}_{filename}`
   - ImportWizard shows 50% progress

2. **Parsing Phase**
   - `useImportFlow.startImport()` creates import record with status='pending'
   - Web Worker starts parsing in background
   - Two possible paths:
     - ✅ **Client wins**: File parsed in <CHUNK_SIZE> chunks, sent to UI, displayed as progress
     - ⏸️ **Fallback triggered**: File too large (>50MB CSV, >10MB XLSX)
       - Worker sends fallback message
       - Client calls `triggerParsing()` → Edge Function
       - UI polls `getStatus()` every 2 seconds
       - Edge Function updates DB status: pending → processing → parsed

3. **Completion Phase**
   - `dpgf_imports` record updated with:
     - `status`: 'parsed'
     - `parsed_at`: timestamp
     - `row_count`: number of rows
   - Raw data stored in `dpgf_rows_raw` table
   - ImportsList component polls and reflects new status

## Files

### Web Workers

**`apps/web/src/workers/csv-parser.worker.ts`** (~110 lines)
- Uses PapaParse for streaming CSV parsing
- Constants: `CHUNK_SIZE=1000`, `MAX_FILE_SIZE=50MB`, `MAX_ROWS=500k`
- Message types:
  - `'parse'` (input) → triggers parsing
  - `'abort'` (input) → stops parsing
  - `'chunk'` (output) → data + rowCount
  - `'fallback'` (output) → file too large/too many rows
  - `'error'` (output) → parsing error
  - `'complete'` (output) → all data parsed

**`apps/web/src/workers/xlsx-parser.worker.ts`** (~95 lines)
- Uses SheetJS (@x/xlsx) for XLSX/XLS parsing
- Reads entire file into memory (single-sheet only)
- Constants: `MAX_FILE_SIZE=10MB`, `MAX_SHEETS=1`
- Returns: data[], sheetName, columns[], rowCount

### Hooks

**`apps/web/src/hooks/useFileParser.ts`** (~210 lines)
- Manages Web Worker lifecycle
- Handles chunked parsing results for CSV
- Detects fallback conditions
- Provides: `parseCSV()`, `parseXLSX()`, `abort()`, `cleanup()`
- State: `{ loading, progress, error, shouldFallbackToServer }`

**`apps/web/src/hooks/useImportFlow.ts`** (~180 lines)
- High-level orchestration of complete import flow
- Steps: upload → create import → parse → complete/fallback
- Manages Supabase Storage client
- Calls tRPC procedures for backend operations
- Integrates useFileParser for client-side parsing
- Automatically triggers server parsing on fallback

### Components

**`apps/web/src/components/ImportWizard.tsx`** (~200 lines)
- Multi-step UI wizard for file import
- Step 1: File upload with drag-drop support
- Step 2-3: Progress tracking (uploading/parsing)
- Step 4: Success confirmation
- Error state with retry option
- Validates file type and size

**`apps/web/src/components/ImportsList.tsx`** (~150 lines)
- Table displaying recent imports
- Columns: Filename, Status, Row Count, Created Date, Actions
- Real-time status updates via TanStack Query polling
- Automatic refresh every 5 seconds
- Status badges with color coding:
  - Yellow: pending
  - Blue: processing/parsing
  - Green: parsed/complete
  - Red: failed

### Pages

**`apps/web/src/app/imports/page.tsx`**
- Import management page
- Combines ImportWizard + ImportsList
- Refresh list on successful import

### API Procedures

**`packages/api/src/router.ts` - `importsRouter`**

```typescript
// Create import record
imports.create(filename, storagePath) → { id, filename, status, storagePath }

// List imports for tenant
imports.list() → Array<{ id, filename, status, rowCount, parsedAt, createdAt }>

// Get import status
imports.getStatus(importId) → { id, filename, status, rowCount, parsedAt, createdAt }

// Trigger server parsing (fallback)
imports.triggerParsing(importId) → { success: true, rowCount: number }
```

### Edge Function

**`supabase/functions/parse-dpgf/index.ts`** (~210 lines)
- POST /functions/v1/parse-dpgf
- Input: `{ storagePath, importId, tenantId }`
- Steps:
  1. Download file from Supabase Storage
  2. Detect format (CSV vs XLSX)
  3. Parse using appropriate parser
  4. Normalize into `DPGFRow[]` objects
  5. Batch insert into `dpgf_rows_raw` (1000 rows per insert)
  6. Update import status to 'parsed' + row_count
- Error handling: sets status='failed' if parsing fails

## Database Schema

### dpgf_imports Table
```sql
CREATE TABLE dpgf_imports (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL, -- FK tenants.id
  user_id uuid NOT NULL,   -- FK profiles.id
  filename text NOT NULL,
  storage_path text NOT NULL,
  status import_status ('pending', 'processing', 'parsed', 'mapping', 'completed', 'failed'),
  parsed_at timestamptz,
  row_count integer,
  created_at timestamptz DEFAULT NOW(),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, storage_path)
);
```

### dpgf_rows_raw Table
```sql
CREATE TABLE dpgf_rows_raw (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  import_id uuid NOT NULL, -- FK dpgf_imports.id
  row_index integer NOT NULL,
  raw_data jsonb NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (import_id) REFERENCES dpgf_imports(id) ON DELETE CASCADE,
  INDEX (import_id, row_index)
);
```

## Testing Guide

### 1. Manual Testing - Client-Side Parsing

```bash
# Start dev server
npm run dev

# Navigate to http://localhost:3000/imports

# Test Case 1: Small CSV (< 50MB)
1. Create test file: small.csv with 1000 rows
2. Drag/drop into wizard
3. ✅ Should parse on client within 2 seconds
4. Progress shows 100%
5. Success message with row count

# Test Case 2: Large CSV (> 50MB)
1. Create test file: large.csv with 1M rows
2. Upload to wizard
3. ✅ Should trigger fallback after 5-10 seconds
4. Should see "Fallback to server parsing" in console
5. ImportsList shows status='processing'
6. After ~30 seconds, status changes to 'parsed'
```

### 2. Testing Fallback Logic

**Force client-side fallback:**
```typescript
// In useFileParser.ts, reduce MAX_FILE_SIZE for testing
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB for testing

// Test CSV fallback
- Upload 2MB CSV → should fallback
- Check console for "Fallback to server: file_too_large"

// Test XLSX fallback (multi-sheet)
- Create Excel file with 2 sheets
- Upload → should fallback with reason "multi_sheet"
```

### 3. Testing Real-Time Polling

```typescript
// ImportsList polls every 5 seconds
1. Upload a large file
2. Open browser DevTools → Network tab
3. Filter by "trpc"
4. Should see repeated calls to imports.getStatus
5. Each call returns updated status/row_count
6. Status transitions: pending → processing → parsed
```

### 4. Testing Error Handling

**Invalid file format:**
```
- Try uploading .txt file
- Should show error: "Unsupported file format"
```

**Corrupted CSV:**
```
- Create CSV with invalid structure
- Upload → should show parsing error in ImportWizard
```

**Storage error (simulate):**
```typescript
// Mock storage.download() failure
const { data, error } = await supabase.storage.from('dpgf-uploads').download(path);
// Should trigger error state in Edge Function
// import status set to 'failed'
```

## Performance Characteristics

### Client-Side Parsing
- CSV 50MB: ~2-5 seconds (streaming)
- XLSX 10MB: ~1-3 seconds (single sheet)
- Non-blocking UI with progress updates every 1000 rows

### Server-Side Parsing (Edge Function)
- CSV 100MB+: ~10-30 seconds
- XLSX 50MB+: ~5-15 seconds
- Batch inserts in groups of 1000 rows

### Network
- File upload: ~2-10 Mbps (depends on user connection)
- tRPC polling: 1-2 KB per request, ~5 calls/minute

## Known Limitations & Future Improvements

### Current Limitations
1. **XLSX**: Only first sheet is parsed (MAX_SHEETS=1)
2. **CSV**: No sophisticated quote/escape handling (basic split(','))
3. **Memory**: Entire XLSX file loaded into memory (not streaming)
4. **Polling**: Fixed 5-second interval (could be adaptive)

### Planned for Sprint 3 (Mapping & Memory)
1. Multi-sheet XLSX support
2. Column mapping UI
3. Data validation rules
4. Duplicate detection
5. Column name memory (learn common mappings)
6. Preview with first 10 rows
7. Mapping templates per supplier

### Future Optimizations
1. Streaming XLSX parsing with streaming-xlsx
2. WebAssembly for CSV parsing (faster)
3. IndexedDB for client-side caching
4. Progressive Enhancement: load more rows as user scrolls
5. Webhook instead of polling for large files

## Debugging

### Console Logs
```typescript
// Client-side
[Parser] Fallback to server: file_too_large
[ImportFlow] Uploading file: myfile.csv
[ImportFlow] Creating import record
[ImportFlow] Parsing file: csv
[ImportFlow] Fallback to server parsing
[ImportFlow] Complete: import_12345 with 50000 rows

// Server-side (Edge Function)
[parse-dpgf] Starting: tenants/demo/dpgf/file.csv (import: xyz)
[parse-dpgf] Parsed 50000 rows
[parse-dpgf] Inserted 50 batches (1000 rows each)
[parse-dpgf] Completed: 50000 rows parsed and stored
```

### Troubleshooting

**ImportWizard shows error immediately:**
- Check browser console for error messages
- Verify file is CSV/XLSX
- Check file size is within limits

**Status stays "parsing" forever:**
- Check Edge Function logs: `supabase functions list` then `supabase functions logs parse-dpgf`
- Verify dpgf-uploads bucket exists and has correct permissions
- Check dpgf_imports table for failed status

**ImportsList doesn't update:**
- Open DevTools → Network tab
- Filter by "trpc"
- Check if `imports.getStatus` calls are being made
- Verify `refetchInterval: 5000` is set

## Example Data Flow

```
User: uploads file "suppliers.csv" (25MB, 100k rows)

1. ImportWizard detects file
2. Uploads to Storage: dpgf-uploads/tenant-123/dpgf/1234567890_suppliers.csv
3. Progress: 50%
4. Calls imports.create()
   → Creates dpgf_imports record
   → status='pending', row_count=null
   → Returns importId='imp-xyz'
5. useFileParser starts parseCSV worker
6. Worker streams file, sends chunks every 1000 rows
7. UI updates progress: 50% → 75% → 90%
8. Worker completes, sends 100k rows total
9. ImportWizard shows success: "100,000 rows parsed"
10. ImportsList polls imports.getStatus('imp-xyz')
    → Returns { status: 'parsed', rowCount: 100000, parsedAt: '2024-11-12T14:30:00Z' }
11. UI marks import as complete ✅

Database state after completion:
- dpgf_imports: 1 record with status='parsed', row_count=100000
- dpgf_rows_raw: 100000 records (raw CSV row data as JSONB)
```

## Performance Monitoring

To monitor real-world performance:

```sql
-- Check import statistics
SELECT
  status,
  COUNT(*) as count,
  AVG(row_count) as avg_rows,
  MAX(row_count) as max_rows,
  AVG(EXTRACT(EPOCH FROM (parsed_at - created_at))) as avg_duration_seconds
FROM dpgf_imports
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status;

-- Check parsing speed
SELECT
  filename,
  row_count,
  EXTRACT(EPOCH FROM (parsed_at - created_at)) as duration_seconds,
  ROUND(row_count::float / EXTRACT(EPOCH FROM (parsed_at - created_at)), 0) as rows_per_second
FROM dpgf_imports
WHERE status = 'parsed'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY duration_seconds DESC
LIMIT 10;
```

## References

- [PapaParse Documentation](https://www.papaparse.com/docs)
- [SheetJS (xlsx) API](https://docs.sheetjs.com/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [tRPC Documentation](https://trpc.io/)
