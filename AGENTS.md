# AGENTS.md - Operational Guide for EduDrive AI Agents & Developers

Repository: [https://github.com/stiavelli21/EduDrive.git](https://github.com/stiavelli21/EduDrive.git)

This is the authoritative instruction manual for any AI agent or developer working on the EduDrive codebase.

---

## 1. Project Overview & Tech Stack

EduDrive is a local desktop Google Drive clone with integrated academic tools (university transcript/career tracker and exam deadline management).

- **Desktop Shell**: Wails v2 (Go backend + WebView2 on Windows).
- **Backend**: Go (1.25+), Controller-Service-Repository pattern.
- **Database**: Pure-Go SQLite via `modernc.org/sqlite` (**strictly Zero CGO/GCC**).
- **Storage**: UUID-based physical files in `%APPDATA%/EduDrive/storage_data/`.
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS v3, Lucide Icons, KaTeX (`remark-math`, `rehype-katex`), PrismJS.
- **IPC**: Strongly-typed Wails bindings (`frontend/wailsjs`).

### Runtime Paths
- **App Data Directory**: `%APPDATA%/EduDrive/` (fallback: `./edudrive_data/`)
- **SQLite Database**: `%APPDATA%/EduDrive/edudrive.db`
- **Physical Storage**: `%APPDATA%/EduDrive/storage_data/`

---

## 2. Absolute Development Guardrails

1. **Zero CGO / Pure-Go SQLite**:
   - MUST ONLY use `modernc.org/sqlite`.
   - NEVER import `github.com/mattn/go-sqlite3` or any package requiring GCC/CGO.
2. **Decoupled Storage & Physical Safety**:
   - `items.name` stores the logical display name.
   - Physical disk storage MUST ALWAYS use UUID format: `storage_data/<UUID>.<ext>`.
   - Web bookmarks (`mime_type = 'url'`) store the target URL in `storage_path` with 0 disk bytes.
3. **Soft-Delete vs. Physical Purge**:
   - Soft-delete (`is_trash = 1`) MUST NOT delete physical files from disk.
   - Moving a folder to trash or restoring it MUST cascade recursively to all children.
   - Physical deletion from disk occurs ONLY on `DeleteItem(permanent=true)` or `EmptyTrash()`.
4. **Hierarchical Move & Cycle Prevention**:
   - Moving an item via `MoveItem(id, targetFolderId)` MUST enforce cycle detection via SQLite `WITH RECURSIVE` queries to prevent placing a folder inside its own subtree.
5. **Streaming & Path Traversal Guard**:
   - Local HTTP file streaming via `AssetServer.Handler` (`/storage/<uuid>.<ext>`) MUST strictly sanitize paths (`filepath.Clean`, boundary verification within `storage_data/`) and support HTTP Range requests for video/audio seek.
6. **Documentation & Code Language Rules**:
   - **Code Comments**: All source code comments (Go, TypeScript, CSS, SQL) MUST be frequent, clear, and strictly in **English**.
   - **Project Documentation (`.md`)**: Human-facing documentation (such as `README.md`) MUST be written in **Italian**, concise, technical, and free of emojis.
   - **Doc Sync**: Always keep `README.md` and `AGENTS.md` synchronized whenever features, schemas, or APIs change.

---

## 3. Core Architecture & Key Modules

```
EduDrive/
├── app.go                  # Central Wails controller (IPC bindings, file operations, seed logic)
├── main.go                 # Desktop window initialization, AssetServer.Handler streaming & lifecycle hooks
├── models/item.go          # Core structs: Item, Breadcrumb, StorageStats, ExamDate, PassedExam
├── db/db.go                # SQLite DAL: migrations, hierarchical recursive queries, move/cycle checks, career CRUD
├── storage/storage.go      # Physical file management: UUID mapping, MIME detection, Range HTTP streaming, export
├── converter/              # Document conversion engine to Markdown (DOCX, PDF, text)
│   ├── docx.go             # Word parser with table formatting and OMML-to-LaTeX conversion
│   └── pdf.go              # Pure-Go PDF parser using pdfcpu
└── frontend/src/
    ├── App.tsx             # Global state coordinator, navigation, fast filters, sorting, modal orchestration
    ├── types/index.ts      # TypeScript interfaces matching backend models, SortField, TypeFilter
    ├── components/         # UI components (Header, Sidebar, GridView, ListView, CareerView)
    └── components/Modals/  # Modals: MarkdownModal, DocumentViewerModal, ImageViewerModal, CodeViewerModal, MoveItemModal
```

---

## 4. Domain Logic & Calculation Formulas

### 4.1 University Career (`CareerView.tsx`)
- **Weighted Average (Media Ponderata)**:
  $$\text{Media Ponderata} = \frac{\sum (\text{EffectiveGrade}_i \times \text{CFU}_i)}{\sum \text{CFU}_i}$$
  *Honors (`is_honors = true`) value configured via settings: 30 (standard), 31, or 33.*
- **Degree Starting Grade Baseline (Base di Laurea su 110)**:
  $$\text{Base Laurea} = \frac{\text{Media Ponderata} \times 110}{30}$$
- **CFU Targets**: Bachelor (180), Master (120), Single Cycle (300 or 360).

### 4.2 Exam Deadlines (`ExamDateItem`)
- **Urgent (Red)**: $\le 10$ days remaining or overdue.
- **Warning (Yellow)**: $11 - 30$ days remaining.
- **Normal (Green)**: $> 30$ days remaining.

---

## 5. Agent Workflow Playbook

### Adding or Modifying Backend APIs
1. Update data structures in `models/item.go` if needed.
2. Implement repository logic in `db/db.go` with parameterized queries.
3. Update `storage/storage.go` if physical files are affected.
4. Expose the method on `App` in `app.go`.
5. Add/update unit tests in `db/db_test.go` or `storage/storage_test.go`.
6. Run `go test -v ./...`.
7. Update Wails TypeScript bindings in `frontend/wailsjs/` or verify typings.
8. Connect frontend state with toast notification feedback.

### Database Schema Updates
1. Add backwards-compatible `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE` statements to `migrate()` in `db/db.go`.
2. Ensure strict `modernc.org/sqlite` compatibility.

---

## 6. Verification & Build Commands

```bash
# Run all Go backend unit tests
go test -v ./...

# Verify frontend TypeScript build
cd frontend && npm run build

# Run in development mode with hot reload
wails dev

# Build production executable for Windows (outputs to build/bin/EduDrive.exe)
wails build
```

---

## 7. Strict Anti-Patterns (NEVER DO)

- **NEVER** import `github.com/mattn/go-sqlite3` or any CGO-dependent module.
- **NEVER** save physical files using the user-provided filename; always generate and use UUIDs.
- **NEVER** delete physical files on soft-delete (`is_trash = 1`).
- **NEVER** use emojis in markdown documentation.
- **NEVER** write code comments in languages other than English.
- **NEVER** bypass error handling in Wails IPC calls.