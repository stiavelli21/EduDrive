package db

import (
	"database/sql"
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

