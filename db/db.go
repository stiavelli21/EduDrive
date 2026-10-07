package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"EduDrive/models"

	_ "modernc.org/sqlite"
)

// Database manages SQLite database operations
type Database struct {
	conn *sql.DB
}

// InitDB initializes SQLite database connection and runs migrations
func InitDB(dbPath string) (*Database, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	// Optimize connection pool for SQLite
	conn.SetMaxOpenConns(1)

	db := &Database{conn: conn}
	if err := db.migrate(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

// Close closes the database connection
func (d *Database) Close() error {
	return d.conn.Close()
}

// migrate creates necessary tables and indexes
func (d *Database) migrate() error {
	query := `
	CREATE TABLE IF NOT EXISTS items (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		parent_id TEXT,
		is_folder INTEGER NOT NULL DEFAULT 0,
		size_bytes INTEGER NOT NULL DEFAULT 0,
		mime_type TEXT NOT NULL DEFAULT '',
		storage_path TEXT NOT NULL DEFAULT '',
		is_trash INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY (parent_id) REFERENCES items(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_items_parent_id ON items(parent_id);
	CREATE INDEX IF NOT EXISTS idx_items_is_trash ON items(is_trash);
	CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
	CREATE INDEX IF NOT EXISTS idx_items_updated_at ON items(updated_at);

	CREATE TABLE IF NOT EXISTS exam_dates (
		id TEXT PRIMARY KEY,
		subject TEXT NOT NULL,
		exam_date DATETIME NOT NULL,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_exam_dates_date ON exam_dates(exam_date);

	CREATE TABLE IF NOT EXISTS passed_exams (
		id TEXT PRIMARY KEY,
		subject TEXT NOT NULL,
		grade INTEGER NOT NULL,
		is_honors INTEGER NOT NULL DEFAULT 0,
		cfu INTEGER NOT NULL,
		exam_date TEXT NOT NULL DEFAULT '',
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_passed_exams_date ON passed_exams(exam_date);

	CREATE TABLE IF NOT EXISTS app_settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS podcasts (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		topic TEXT NOT NULL DEFAULT '',
		tone TEXT NOT NULL DEFAULT 'colloquial',
		source_item_ids TEXT NOT NULL DEFAULT '[]',
		source_item_names TEXT NOT NULL DEFAULT '[]',
		turns_json TEXT NOT NULL DEFAULT '[]',
		audio_path TEXT NOT NULL DEFAULT '',
		duration_seconds REAL NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_podcasts_created_at ON podcasts(created_at DESC);

	CREATE TABLE IF NOT EXISTS study_handouts (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		topic TEXT NOT NULL DEFAULT '',
		mode TEXT NOT NULL DEFAULT 'reasoned_handout',
		detail_level TEXT NOT NULL DEFAULT 'standard',
		source_item_ids TEXT NOT NULL DEFAULT '[]',
		source_item_names TEXT NOT NULL DEFAULT '[]',
		content_markdown TEXT NOT NULL DEFAULT '',
		drive_item_id TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_study_handouts_created_at ON study_handouts(created_at DESC);
	`
	_, err := d.conn.Exec(query)
	return err
}

// InsertItem adds a new item to the database
func (d *Database) InsertItem(item *models.Item) error {
	query := `
	INSERT INTO items (id, name, parent_id, is_folder, size_bytes, mime_type, storage_path, is_trash, created_at, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	var parentID sql.NullString
	if item.ParentID != nil && *item.ParentID != "" {
		parentID = sql.NullString{String: *item.ParentID, Valid: true}
	}

	now := time.Now()
	if item.CreatedAt.IsZero() {
		item.CreatedAt = now
	}
	item.UpdatedAt = now

	_, err := d.conn.Exec(query,
		item.ID,
		item.Name,
		parentID,
		item.IsFolder,
		item.SizeBytes,
		item.MimeType,
		item.StoragePath,
		item.IsTrash,
		item.CreatedAt,
		item.UpdatedAt,
	)
	return err
}

// GetItemByID fetches a single item by its ID
func (d *Database) GetItemByID(id string) (*models.Item, error) {
	query := `
	SELECT id, name, parent_id, is_folder, size_bytes, mime_type, storage_path, is_trash, created_at, updated_at
	FROM items
	WHERE id = ?
	`
	var item models.Item
	var parentID sql.NullString

	err := d.conn.QueryRow(query, id).Scan(
		&item.ID,
		&item.Name,
		&parentID,
		&item.IsFolder,
		&item.SizeBytes,
		&item.MimeType,
		&item.StoragePath,
		&item.IsTrash,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if parentID.Valid {
		val := parentID.String
		item.ParentID = &val
	}

	return &item, nil
}

// GetItemsByParentID retrieves non-trash items inside a folder (or root if parentID is empty)
func (d *Database) GetItemsByParentID(parentID string) ([]models.Item, error) {
	var query string
	var rows *sql.Rows
	var err error

	if parentID == "" {
		query = `
		SELECT id, name, parent_id, is_folder, size_bytes, mime_type, storage_path, is_trash, created_at, updated_at
		FROM items
		WHERE is_trash = 0 AND (parent_id IS NULL OR parent_id = '')
		ORDER BY is_folder DESC, name COLLATE NOCASE ASC
		`
		rows, err = d.conn.Query(query)
	} else {
		query = `
		SELECT id, name, parent_id, is_folder, size_bytes, mime_type, storage_path, is_trash, created_at, updated_at
		FROM items
		WHERE is_trash = 0 AND parent_id = ?
		ORDER BY is_folder DESC, name COLLATE NOCASE ASC
		`
		rows, err = d.conn.Query(query, parentID)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Item, 0)
	for rows.Next() {
		var item models.Item
		var pID sql.NullString
		err := rows.Scan(
			&item.ID,
			&item.Name,
			&pID,
			&item.IsFolder,
			&item.SizeBytes,
			&item.MimeType,
			&item.StoragePath,
			&item.IsTrash,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if pID.Valid {
			val := pID.String
			item.ParentID = &val
		}
		items = append(items, item)
	}

	return items, nil
}

// GetRecentItems retrieves the most recently updated active files
func (d *Database) GetRecentItems(limit int) ([]models.Item, error) {
	query := `
	SELECT id, name, parent_id, is_folder, size_bytes, mime_type, storage_path, is_trash, created_at, updated_at
	FROM items
	WHERE is_trash = 0 AND is_folder = 0
	ORDER BY updated_at DESC
	LIMIT ?
	`
	rows, err := d.conn.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Item, 0)
	for rows.Next() {
		var item models.Item
		var pID sql.NullString
		err := rows.Scan(
			&item.ID,
			&item.Name,
			&pID,
			&item.IsFolder,
			&item.SizeBytes,
			&item.MimeType,
			&item.StoragePath,
			&item.IsTrash,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if pID.Valid {
			val := pID.String
			item.ParentID = &val
		}
		items = append(items, item)
	}

	return items, nil
}

// GetTrashItems retrieves all items in the trash
func (d *Database) GetTrashItems() ([]models.Item, error) {
	query := `
	SELECT id, name, parent_id, is_folder, size_bytes, mime_type, storage_path, is_trash, created_at, updated_at
	FROM items
	WHERE is_trash = 1
	ORDER BY updated_at DESC
	`
	rows, err := d.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Item, 0)
	for rows.Next() {
		var item models.Item
		var pID sql.NullString
		err := rows.Scan(
			&item.ID,
			&item.Name,
			&pID,
			&item.IsFolder,
			&item.SizeBytes,
			&item.MimeType,
			&item.StoragePath,
			&item.IsTrash,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if pID.Valid {
			val := pID.String
			item.ParentID = &val
		}
		items = append(items, item)
	}

	return items, nil
}

// SearchItems searches active items by name
func (d *Database) SearchItems(queryStr string) ([]models.Item, error) {
	pattern := "%" + queryStr + "%"
	query := `
	SELECT id, name, parent_id, is_folder, size_bytes, mime_type, storage_path, is_trash, created_at, updated_at
	FROM items
	WHERE is_trash = 0 AND name LIKE ?
	ORDER BY is_folder DESC, updated_at DESC
	LIMIT 100
	`
	rows, err := d.conn.Query(query, pattern)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Item, 0)
	for rows.Next() {
		var item models.Item
		var pID sql.NullString
		err := rows.Scan(
			&item.ID,
			&item.Name,
			&pID,
			&item.IsFolder,
			&item.SizeBytes,
			&item.MimeType,
			&item.StoragePath,
			&item.IsTrash,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if pID.Valid {
			val := pID.String
			item.ParentID = &val
		}
		items = append(items, item)
	}

	return items, nil
}

// UpdateItemName updates an item's display name
func (d *Database) UpdateItemName(id string, newName string) error {
	query := `
	UPDATE items
	SET name = ?, updated_at = ?
	WHERE id = ?
	`
	_, err := d.conn.Exec(query, newName, time.Now(), id)
	return err
}

// UpdateItemSizeAndTimestamp updates the size and updated_at timestamp of an item
func (d *Database) UpdateItemSizeAndTimestamp(id string, sizeBytes int64) error {
	query := `
	UPDATE items
	SET size_bytes = ?, updated_at = ?
	WHERE id = ?
	`
	_, err := d.conn.Exec(query, sizeBytes, time.Now(), id)
	return err
}

// MoveItem moves an item to a new parent folder, preventing circular dependencies and invalid targets
func (d *Database) MoveItem(id string, newParentID *string) error {
	if id == "" {
		return fmt.Errorf("item ID cannot be empty")
	}

	item, err := d.GetItemByID(id)
	if err != nil {
		return fmt.Errorf("failed to fetch item: %w", err)
	}
	if item == nil {
		return fmt.Errorf("item not found")
	}

	if item.IsTrash {
		return fmt.Errorf("cannot move a trashed item; restore it first")
	}

	var targetParent sql.NullString
	if newParentID != nil && *newParentID != "" {
		destID := *newParentID
		if id == destID {
			return fmt.Errorf("cannot move an item into itself")
		}

		target, err := d.GetItemByID(destID)
		if err != nil {
			return fmt.Errorf("failed to fetch destination folder: %w", err)
		}
		if target == nil {
			return fmt.Errorf("destination folder not found")
		}
		if !target.IsFolder {
			return fmt.Errorf("destination must be a folder")
		}
		if target.IsTrash {
			return fmt.Errorf("cannot move item into a trashed folder")
		}

		// If moving a folder, verify that destination is NOT a descendant of the folder (cycle prevention)
		if item.IsFolder {
			cycleQuery := `
			WITH RECURSIVE subordinates AS (
				SELECT id FROM items WHERE parent_id = ?
				UNION ALL
				SELECT items.id FROM items JOIN subordinates ON items.parent_id = subordinates.id
			)
			SELECT COUNT(*) FROM subordinates WHERE id = ?
			`
			var count int
			if err := d.conn.QueryRow(cycleQuery, id, destID).Scan(&count); err != nil {
				return fmt.Errorf("failed to check folder hierarchy: %w", err)
			}
			if count > 0 {
				return fmt.Errorf("cannot move a folder into one of its subfolders")
			}
		}

		targetParent = sql.NullString{String: destID, Valid: true}
	}

	// No-op if target parent matches current parent
	if (item.ParentID == nil && !targetParent.Valid) ||
		(item.ParentID != nil && targetParent.Valid && *item.ParentID == targetParent.String) {
		return nil
	}

	query := `
	UPDATE items
	SET parent_id = ?, updated_at = ?
	WHERE id = ?
	`
	_, err = d.conn.Exec(query, targetParent, time.Now(), id)
	if err != nil {
		return fmt.Errorf("failed to update item parent: %w", err)
	}

	return nil
}

// GetAllFolders returns all active non-trash folders for navigation and destination picker
func (d *Database) GetAllFolders() ([]models.Item, error) {
	query := `
	SELECT id, name, parent_id, is_folder, size_bytes, mime_type, storage_path, is_trash, created_at, updated_at
	FROM items
	WHERE is_trash = 0 AND is_folder = 1
	ORDER BY name COLLATE NOCASE ASC
	`
	rows, err := d.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	folders := make([]models.Item, 0)
	for rows.Next() {
		var item models.Item
		var pID sql.NullString
		err := rows.Scan(
			&item.ID,
			&item.Name,
			&pID,
			&item.IsFolder,
			&item.SizeBytes,
			&item.MimeType,
			&item.StoragePath,
			&item.IsTrash,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		if pID.Valid {
			val := pID.String
			item.ParentID = &val
		}
		folders = append(folders, item)
	}

	return folders, nil
}


// SetTrashStatus sets trash flag for an item and all its descendants recursively
func (d *Database) SetTrashStatus(id string, isTrash bool) error {
	descendants, err := d.GetAllDescendantItems(id)
	if err != nil {
		return err
	}

	allIDs := append([]string{id}, descendants...)
	now := time.Now()

	tx, err := d.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`UPDATE items SET is_trash = ?, updated_at = ? WHERE id = ?`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	trashVal := 0
	if isTrash {
		trashVal = 1
	}

	for _, itemID := range allIDs {
		if _, err := stmt.Exec(trashVal, now, itemID); err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetAllDescendantItems finds all children IDs recursively
func (d *Database) GetAllDescendantItems(parentID string) ([]string, error) {
	var result []string
	query := `SELECT id, is_folder FROM items WHERE parent_id = ?`
	rows, err := d.conn.Query(query, parentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type child struct {
		id       string
		isFolder bool
	}
	var children []child
	for rows.Next() {
		var c child
		if err := rows.Scan(&c.id, &c.isFolder); err != nil {
			return nil, err
		}
		children = append(children, c)
	}

	for _, c := range children {
		result = append(result, c.id)
		if c.isFolder {
			sub, err := d.GetAllDescendantItems(c.id)
			if err != nil {
				return nil, err
			}
			result = append(result, sub...)
		}
	}

	return result, nil
}

// GetItemsWithStoragePaths retrieves all items matching a slice of IDs (for deleting disk files)
func (d *Database) GetItemsWithStoragePaths(ids []string) ([]models.Item, error) {
	if len(ids) == 0 {
		return nil, nil
	}

	items := make([]models.Item, 0)
	for _, id := range ids {
		item, err := d.GetItemByID(id)
		if err != nil {
			return nil, err
		}
		if item != nil {
			items = append(items, *item)
		}
	}
	return items, nil
}

// DeletePermanent deletes an item and all descendants from the DB
func (d *Database) DeletePermanent(id string) ([]models.Item, error) {
	descendantIDs, err := d.GetAllDescendantItems(id)
	if err != nil {
		return nil, err
	}
	allIDs := append([]string{id}, descendantIDs...)

	itemsToDelete, err := d.GetItemsWithStoragePaths(allIDs)
	if err != nil {
		return nil, err
	}

	tx, err := d.conn.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`DELETE FROM items WHERE id = ?`)
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	for _, itemID := range allIDs {
		if _, err := stmt.Exec(itemID); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return itemsToDelete, nil
}

// EmptyTrash deletes all items marked as trash and returns them so their files can be deleted
func (d *Database) EmptyTrash() ([]models.Item, error) {
	trashItems, err := d.GetTrashItems()
	if err != nil {
		return nil, err
	}

	_, err = d.conn.Exec(`DELETE FROM items WHERE is_trash = 1`)
	if err != nil {
		return nil, err
	}

	return trashItems, nil
}

// GetBreadcrumbs returns the folder hierarchy leading up to folderID
func (d *Database) GetBreadcrumbs(folderID string) ([]models.Breadcrumb, error) {
	if folderID == "" {
		return []models.Breadcrumb{{ID: "", Name: "Il mio Drive"}}, nil
	}

	var crumbs []models.Breadcrumb
	currID := folderID

	// Loop back up to root (with depth limit safeguard)
	for i := 0; i < 50; i++ {
		if currID == "" {
			break
		}
		item, err := d.GetItemByID(currID)
		if err != nil || item == nil {
			break
		}

		crumbs = append([]models.Breadcrumb{{ID: item.ID, Name: item.Name}}, crumbs...)
		if item.ParentID == nil || *item.ParentID == "" {
			break
		}
		currID = *item.ParentID
	}

	// Prepend root
	crumbs = append([]models.Breadcrumb{{ID: "", Name: "Il mio Drive"}}, crumbs...)
	return crumbs, nil
}

// GetStorageStats computes storage utilization
func (d *Database) GetStorageStats() (*models.StorageStats, error) {
	var stats models.StorageStats

	// Active stats
	row := d.conn.QueryRow(`
		SELECT 
			COALESCE(SUM(CASE WHEN is_trash = 0 AND is_folder = 0 THEN size_bytes ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN is_trash = 0 AND is_folder = 0 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN is_trash = 0 AND is_folder = 1 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN is_trash = 1 THEN size_bytes ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN is_trash = 1 THEN 1 ELSE 0 END), 0)
		FROM items
	`)
	err := row.Scan(
		&stats.TotalSizeBytes,
		&stats.TotalFiles,
		&stats.TotalFolders,
		&stats.TrashSizeBytes,
		&stats.TrashItems,
	)
	if err != nil {
		return nil, err
	}

	return &stats, nil
}

// InsertExamDate adds a new exam deadline to the database
func (d *Database) InsertExamDate(exam *models.ExamDate) error {
	query := `
	INSERT INTO exam_dates (id, subject, exam_date, created_at, updated_at)
	VALUES (?, ?, ?, ?, ?)
	`
	now := time.Now()
	if exam.CreatedAt.IsZero() {
		exam.CreatedAt = now
	}
	exam.UpdatedAt = now

	_, err := d.conn.Exec(query,
		exam.ID,
		exam.Subject,
		exam.ExamDate,
		exam.CreatedAt,
		exam.UpdatedAt,
	)
	return err
}

// GetExamDates retrieves all active exam deadlines ordered chronologically and removes expired exams
func (d *Database) GetExamDates() ([]models.ExamDate, error) {
	now := time.Now()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	// Automatically remove expired exams (passed before today) so they disappear without trace
	_, _ = d.conn.Exec(`DELETE FROM exam_dates WHERE exam_date < ?`, startOfToday)

	query := `
	SELECT id, subject, exam_date, created_at, updated_at
	FROM exam_dates
	WHERE exam_date >= ?
	ORDER BY exam_date ASC, subject COLLATE NOCASE ASC
	`
	rows, err := d.conn.Query(query, startOfToday)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	exams := make([]models.ExamDate, 0)
	for rows.Next() {
		var exam models.ExamDate
		err := rows.Scan(
			&exam.ID,
			&exam.Subject,
			&exam.ExamDate,
			&exam.CreatedAt,
			&exam.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		exams = append(exams, exam)
	}

	return exams, nil
}

// DeleteExamDate removes an exam deadline from the database
func (d *Database) DeleteExamDate(id string) error {
	query := `DELETE FROM exam_dates WHERE id = ?`
	_, err := d.conn.Exec(query, id)
	return err
}

// InsertPassedExam records a passed university exam into the student booklet
func (d *Database) InsertPassedExam(exam *models.PassedExam) error {
	query := `
	INSERT INTO passed_exams (id, subject, grade, is_honors, cfu, exam_date, created_at, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	now := time.Now()
	if exam.CreatedAt.IsZero() {
		exam.CreatedAt = now
	}
	exam.UpdatedAt = now

	honorsInt := 0
	if exam.IsHonors {
		honorsInt = 1
	}

	_, err := d.conn.Exec(query,
		exam.ID,
		exam.Subject,
		exam.Grade,
		honorsInt,
		exam.CFU,
		exam.ExamDate,
		exam.CreatedAt,
		exam.UpdatedAt,
	)
	return err
}

// GetPassedExams retrieves all passed exams from the booklet ordered by exam date and subject
func (d *Database) GetPassedExams() ([]models.PassedExam, error) {
	query := `
	SELECT id, subject, grade, is_honors, cfu, exam_date, created_at, updated_at
	FROM passed_exams
	ORDER BY exam_date DESC, created_at DESC
	`
	rows, err := d.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	exams := make([]models.PassedExam, 0)
	for rows.Next() {
		var exam models.PassedExam
		var honorsInt int
		err := rows.Scan(
			&exam.ID,
			&exam.Subject,
			&exam.Grade,
			&honorsInt,
			&exam.CFU,
			&exam.ExamDate,
			&exam.CreatedAt,
			&exam.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		exam.IsHonors = (honorsInt == 1)
		exams = append(exams, exam)
	}

	return exams, nil
}

// UpdatePassedExam updates an existing passed exam record
func (d *Database) UpdatePassedExam(exam *models.PassedExam) error {
	query := `
	UPDATE passed_exams
	SET subject = ?, grade = ?, is_honors = ?, cfu = ?, exam_date = ?, updated_at = ?
	WHERE id = ?
	`
	now := time.Now()
	exam.UpdatedAt = now

	honorsInt := 0
	if exam.IsHonors {
		honorsInt = 1
	}

	_, err := d.conn.Exec(query,
		exam.Subject,
		exam.Grade,
		honorsInt,
		exam.CFU,
		exam.ExamDate,
		exam.UpdatedAt,
		exam.ID,
	)
	return err
}

// DeletePassedExam removes a passed exam record from the booklet
func (d *Database) DeletePassedExam(id string) error {
	query := `DELETE FROM passed_exams WHERE id = ?`
	_, err := d.conn.Exec(query, id)
	return err
}

// GetSetting retrieves a setting value by key, returning empty string if not found
func (d *Database) GetSetting(key string) (string, error) {
	query := `SELECT value FROM app_settings WHERE key = ?`
	var value string
	err := d.conn.QueryRow(query, key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return value, nil
}

// SetSetting inserts or updates a setting key-value pair
func (d *Database) SetSetting(key string, value string) error {
	query := `
	INSERT INTO app_settings (key, value)
	VALUES (?, ?)
	ON CONFLICT(key) DO UPDATE SET value = excluded.value
	`
	_, err := d.conn.Exec(query, key, value)
	return err
}

// InsertPodcast stores a new podcast episode and its transcript in the database
func (d *Database) InsertPodcast(ep *models.PodcastEpisode) error {
	sourceIDsJSON, _ := json.Marshal(ep.SourceItemIDs)
	sourceNamesJSON, _ := json.Marshal(ep.SourceItemNames)
	turnsJSON, _ := json.Marshal(ep.Turns)

	query := `
	INSERT INTO podcasts (id, title, topic, tone, source_item_ids, source_item_names, turns_json, audio_path, duration_seconds, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := d.conn.Exec(query,
		ep.ID,
		ep.Title,
		ep.Topic,
		ep.Tone,
		string(sourceIDsJSON),
		string(sourceNamesJSON),
		string(turnsJSON),
		ep.AudioPath,
		ep.DurationSeconds,
		ep.CreatedAt,
	)
	return err
}

// GetPodcasts retrieves all podcast episodes sorted by creation date descending
func (d *Database) GetPodcasts() ([]models.PodcastEpisode, error) {
	query := `
	SELECT id, title, topic, tone, source_item_ids, source_item_names, turns_json, audio_path, duration_seconds, created_at
	FROM podcasts
	ORDER BY created_at DESC
	`
	rows, err := d.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var episodes []models.PodcastEpisode
	for rows.Next() {
		var ep models.PodcastEpisode
		var sourceIDsJSON, sourceNamesJSON, turnsJSON string

		err := rows.Scan(
			&ep.ID,
			&ep.Title,
			&ep.Topic,
			&ep.Tone,
			&sourceIDsJSON,
			&sourceNamesJSON,
			&turnsJSON,
			&ep.AudioPath,
			&ep.DurationSeconds,
			&ep.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		_ = json.Unmarshal([]byte(sourceIDsJSON), &ep.SourceItemIDs)
		_ = json.Unmarshal([]byte(sourceNamesJSON), &ep.SourceItemNames)
		_ = json.Unmarshal([]byte(turnsJSON), &ep.Turns)

		episodes = append(episodes, ep)
	}

	if episodes == nil {
		episodes = []models.PodcastEpisode{}
	}
	return episodes, nil
}

// GetPodcastByID retrieves a specific podcast episode by its ID
func (d *Database) GetPodcastByID(id string) (*models.PodcastEpisode, error) {
	query := `
	SELECT id, title, topic, tone, source_item_ids, source_item_names, turns_json, audio_path, duration_seconds, created_at
	FROM podcasts
	WHERE id = ?
	`
	var ep models.PodcastEpisode
	var sourceIDsJSON, sourceNamesJSON, turnsJSON string

	err := d.conn.QueryRow(query, id).Scan(
		&ep.ID,
		&ep.Title,
		&ep.Topic,
		&ep.Tone,
		&sourceIDsJSON,
		&sourceNamesJSON,
		&turnsJSON,
		&ep.AudioPath,
		&ep.DurationSeconds,
		&ep.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	_ = json.Unmarshal([]byte(sourceIDsJSON), &ep.SourceItemIDs)
	_ = json.Unmarshal([]byte(sourceNamesJSON), &ep.SourceItemNames)
	_ = json.Unmarshal([]byte(turnsJSON), &ep.Turns)

	return &ep, nil
}

// DeletePodcast removes a podcast episode by its ID
func (d *Database) DeletePodcast(id string) error {
	query := `DELETE FROM podcasts WHERE id = ?`
	_, err := d.conn.Exec(query, id)
	return err
}

// InsertStudyHandout persists a newly generated study handout or synthesis to the database
func (d *Database) InsertStudyHandout(h *models.StudyHandout) error {
	sourceIDsJSON, _ := json.Marshal(h.SourceItemIDs)
	sourceNamesJSON, _ := json.Marshal(h.SourceItemNames)

	var driveItemID sql.NullString
	if h.DriveItemID != nil && *h.DriveItemID != "" {
		driveItemID = sql.NullString{String: *h.DriveItemID, Valid: true}
	}

	query := `
	INSERT INTO study_handouts (
		id, title, topic, mode, detail_level,
		source_item_ids, source_item_names, content_markdown,
		drive_item_id, created_at, updated_at
	)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := d.conn.Exec(query,
		h.ID,
		h.Title,
		h.Topic,
		h.Mode,
		h.DetailLevel,
		string(sourceIDsJSON),
		string(sourceNamesJSON),
		h.ContentMarkdown,
		driveItemID,
		h.CreatedAt,
		h.UpdatedAt,
	)
	return err
}

// GetStudyHandouts retrieves all study handouts ordered by creation date descending
func (d *Database) GetStudyHandouts() ([]models.StudyHandout, error) {
	query := `
	SELECT id, title, topic, mode, detail_level, source_item_ids, source_item_names, content_markdown, drive_item_id, created_at, updated_at
	FROM study_handouts
	ORDER BY created_at DESC
	`
	rows, err := d.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var handouts []models.StudyHandout
	for rows.Next() {
		var h models.StudyHandout
		var sourceIDsJSON, sourceNamesJSON string
		var driveItemID sql.NullString

		err := rows.Scan(
			&h.ID,
			&h.Title,
			&h.Topic,
			&h.Mode,
			&h.DetailLevel,
			&sourceIDsJSON,
			&sourceNamesJSON,
			&h.ContentMarkdown,
			&driveItemID,
			&h.CreatedAt,
			&h.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		_ = json.Unmarshal([]byte(sourceIDsJSON), &h.SourceItemIDs)
		_ = json.Unmarshal([]byte(sourceNamesJSON), &h.SourceItemNames)
		if driveItemID.Valid {
			val := driveItemID.String
			h.DriveItemID = &val
		}

		handouts = append(handouts, h)
	}

	if handouts == nil {
		handouts = []models.StudyHandout{}
	}
	return handouts, nil
}

// GetStudyHandoutByID retrieves a single study handout by its unique ID
func (d *Database) GetStudyHandoutByID(id string) (*models.StudyHandout, error) {
	query := `
	SELECT id, title, topic, mode, detail_level, source_item_ids, source_item_names, content_markdown, drive_item_id, created_at, updated_at
	FROM study_handouts
	WHERE id = ?
	`
	var h models.StudyHandout
	var sourceIDsJSON, sourceNamesJSON string
	var driveItemID sql.NullString

	err := d.conn.QueryRow(query, id).Scan(
		&h.ID,
		&h.Title,
		&h.Topic,
		&h.Mode,
		&h.DetailLevel,
		&sourceIDsJSON,
		&sourceNamesJSON,
		&h.ContentMarkdown,
		&driveItemID,
		&h.CreatedAt,
		&h.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	_ = json.Unmarshal([]byte(sourceIDsJSON), &h.SourceItemIDs)
	_ = json.Unmarshal([]byte(sourceNamesJSON), &h.SourceItemNames)
	if driveItemID.Valid {
		val := driveItemID.String
		h.DriveItemID = &val
	}

	return &h, nil
}

// UpdateStudyHandout updates the title, markdown content and drive item reference of a study handout
func (d *Database) UpdateStudyHandout(h *models.StudyHandout) error {
	var driveItemID sql.NullString
	if h.DriveItemID != nil && *h.DriveItemID != "" {
		driveItemID = sql.NullString{String: *h.DriveItemID, Valid: true}
	}

	query := `
	UPDATE study_handouts
	SET title = ?, content_markdown = ?, drive_item_id = ?, updated_at = ?
	WHERE id = ?
	`
	_, err := d.conn.Exec(query, h.Title, h.ContentMarkdown, driveItemID, h.UpdatedAt, h.ID)
	return err
}

// DeleteStudyHandout deletes a study handout record by its ID
func (d *Database) DeleteStudyHandout(id string) error {
	query := `DELETE FROM study_handouts WHERE id = ?`
	_, err := d.conn.Exec(query, id)
	return err
}



