package db

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"EduDrive/models"
)

func TestDatabaseOperations(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "edudrive_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test.db")
	database, err := InitDB(dbPath)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer database.Close()

	// 1. Insert Folder
	folder := &models.Item{
		ID:        "folder-1",
		Name:      "Documenti",
		IsFolder:  true,
		SizeBytes: 0,
		MimeType:  "folder",
		IsTrash:   false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := database.InsertItem(folder); err != nil {
		t.Fatalf("InsertItem folder failed: %v", err)
	}

	// 2. Insert File inside Folder
	parentID := "folder-1"
	file := &models.Item{
		ID:          "file-1",
		Name:        "tesi.pdf",
		ParentID:    &parentID,
		IsFolder:    false,
		SizeBytes:   1024 * 500, // 500 KB
		MimeType:    "application/pdf",
		StoragePath: "uuid-1234.pdf",
		IsTrash:     false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := database.InsertItem(file); err != nil {
		t.Fatalf("InsertItem file failed: %v", err)
	}

	// 3. Retrieve Root items
	rootItems, err := database.GetItemsByParentID("")
	if err != nil {
		t.Fatalf("GetItemsByParentID root failed: %v", err)
	}
	if len(rootItems) != 1 || rootItems[0].ID != "folder-1" {
		t.Fatalf("Expected 1 root item (folder-1), got %d", len(rootItems))
	}

	// 4. Retrieve Folder-1 items
	folderItems, err := database.GetItemsByParentID("folder-1")
	if err != nil {
		t.Fatalf("GetItemsByParentID folder-1 failed: %v", err)
	}
	if len(folderItems) != 1 || folderItems[0].ID != "file-1" {
		t.Fatalf("Expected 1 child item (file-1), got %d", len(folderItems))
	}

	// 5. Breadcrumbs
	crumbs, err := database.GetBreadcrumbs("folder-1")
	if err != nil {
		t.Fatalf("GetBreadcrumbs failed: %v", err)
	}
	if len(crumbs) != 2 || crumbs[0].Name != "Il mio Drive" || crumbs[1].Name != "Documenti" {
		t.Fatalf("Unexpected breadcrumbs: %+v", crumbs)
	}

	// 6. Search
	searchRes, err := database.SearchItems("tesi")
	if err != nil {
		t.Fatalf("SearchItems failed: %v", err)
	}
	if len(searchRes) != 1 || searchRes[0].Name != "tesi.pdf" {
		t.Fatalf("Expected search match for tesi.pdf, got %+v", searchRes)
	}

	// 7. Stats
	stats, err := database.GetStorageStats()
	if err != nil {
		t.Fatalf("GetStorageStats failed: %v", err)
	}
	if stats.TotalFiles != 1 || stats.TotalFolders != 1 || stats.TotalSizeBytes != 1024*500 {
		t.Fatalf("Unexpected stats: %+v", stats)
	}

	// 8. Rename
	if err := database.UpdateItemName("file-1", "tesi_finale.pdf"); err != nil {
		t.Fatalf("UpdateItemName failed: %v", err)
	}
	renamed, err := database.GetItemByID("file-1")
	if err != nil || renamed.Name != "tesi_finale.pdf" {
		t.Fatalf("Rename verification failed: %+v", renamed)
	}

	// 9. Trash
	if err := database.SetTrashStatus("folder-1", true); err != nil {
		t.Fatalf("SetTrashStatus failed: %v", err)
	}
	trashItems, err := database.GetTrashItems()
	if err != nil {
		t.Fatalf("GetTrashItems failed: %v", err)
	}
	if len(trashItems) != 2 {
		t.Fatalf("Expected both folder-1 and file-1 in trash, got %d", len(trashItems))
	}

	// 10. Restore
	if err := database.SetTrashStatus("folder-1", false); err != nil {
		t.Fatalf("Restore failed: %v", err)
	}
	trashItemsAfterRestore, _ := database.GetTrashItems()
	if len(trashItemsAfterRestore) != 0 {
		t.Fatalf("Expected 0 trash items after restore, got %d", len(trashItemsAfterRestore))
	}

	// 11. Insert and verify Web Link
	webLink := &models.Item{
		ID:          "link-1",
		Name:        "Google",
		ParentID:    nil,
		IsFolder:    false,
		SizeBytes:   int64(len("https://google.com")),
		MimeType:    "url",
		StoragePath: "https://google.com",
		IsTrash:     false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := database.InsertItem(webLink); err != nil {
		t.Fatalf("InsertItem webLink failed: %v", err)
	}

	fetchedLink, err := database.GetItemByID("link-1")
	if err != nil || fetchedLink == nil || fetchedLink.MimeType != "url" || fetchedLink.StoragePath != "https://google.com" {
		t.Fatalf("Failed to retrieve valid web link item: %+v", fetchedLink)
	}

	// 12. Exam Dates CRUD
	exam1 := &models.ExamDate{
		ID:        "exam-1",
		Subject:   "Fisica Generale",
		ExamDate:  time.Now().AddDate(0, 1, 10), // ~40 days later
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	exam2 := &models.ExamDate{
		ID:        "exam-2",
		Subject:   "Analisi Matematica",
		ExamDate:  time.Now().AddDate(0, 0, 5), // 5 days later
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := database.InsertExamDate(exam1); err != nil {
		t.Fatalf("InsertExamDate 1 failed: %v", err)
	}
	if err := database.InsertExamDate(exam2); err != nil {
		t.Fatalf("InsertExamDate 2 failed: %v", err)
	}

	// Retrieve exam dates - should be ordered with soonest first (exam2 then exam1)
	exams, err := database.GetExamDates()
	if err != nil {
		t.Fatalf("GetExamDates failed: %v", err)
	}
	if len(exams) != 2 {
		t.Fatalf("Expected 2 exam dates, got %d", len(exams))
	}
	if exams[0].ID != "exam-2" || exams[1].ID != "exam-1" {
		t.Fatalf("Expected exam-2 first (soonest date), got order: %+v", exams)
	}

	// Delete exam-2
	if err := database.DeleteExamDate("exam-2"); err != nil {
		t.Fatalf("DeleteExamDate failed: %v", err)
	}
	examsAfterDelete, _ := database.GetExamDates()
	if len(examsAfterDelete) != 1 || examsAfterDelete[0].ID != "exam-1" {
		t.Fatalf("Expected 1 exam remaining (exam-1), got: %+v", examsAfterDelete)
	}

	// 13. Expired Exam Auto-Pruning
	expiredExam := &models.ExamDate{
		ID:        "exam-expired",
		Subject:   "Storia Moderna",
		ExamDate:  time.Now().AddDate(0, 0, -2), // 2 days in the past
		CreatedAt: time.Now().AddDate(0, 0, -10),
		UpdatedAt: time.Now().AddDate(0, 0, -10),
	}
	if err := database.InsertExamDate(expiredExam); err != nil {
		t.Fatalf("InsertExamDate expired failed: %v", err)
	}

	// Calling GetExamDates should auto-prune the expired exam
	activeExams, err := database.GetExamDates()
	if err != nil {
		t.Fatalf("GetExamDates after expired insert failed: %v", err)
	}
	for _, e := range activeExams {
		if e.ID == "exam-expired" {
			t.Fatalf("Expired exam was not pruned and is still visible: %+v", e)
		}
	}

	// 14. Passed Exams (Booklet & Career) CRUD
	passed1 := &models.PassedExam{
		ID:        "passed-1",
		Subject:   "Programmazione 1",
		Grade:     28,
		IsHonors:  false,
		CFU:       9,
		ExamDate:  "2026-02-15",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	passed2 := &models.PassedExam{
		ID:        "passed-2",
		Subject:   "Architettura degli Elaboratori",
		Grade:     30,
		IsHonors:  true,
		CFU:       6,
		ExamDate:  "2026-06-20",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := database.InsertPassedExam(passed1); err != nil {
		t.Fatalf("InsertPassedExam 1 failed: %v", err)
	}
	if err := database.InsertPassedExam(passed2); err != nil {
		t.Fatalf("InsertPassedExam 2 failed: %v", err)
	}

	// Retrieve passed exams
	passedExams, err := database.GetPassedExams()
	if err != nil {
		t.Fatalf("GetPassedExams failed: %v", err)
	}
	if len(passedExams) != 2 {
		t.Fatalf("Expected 2 passed exams, got %d", len(passedExams))
	}

	// Verify fields
	if passedExams[0].ID == "passed-2" {
		if !passedExams[0].IsHonors || passedExams[0].Grade != 30 || passedExams[0].CFU != 6 {
			t.Fatalf("PassedExam 2 corrupted: %+v", passedExams[0])
		}
	}

	// Update passed1 (change grade to 30)
	passed1.Grade = 30
	passed1.IsHonors = false
	if err := database.UpdatePassedExam(passed1); err != nil {
		t.Fatalf("UpdatePassedExam failed: %v", err)
	}

	// Delete passed2
	if err := database.DeletePassedExam("passed-2"); err != nil {
		t.Fatalf("DeletePassedExam failed: %v", err)
	}

	passedAfterDelete, err := database.GetPassedExams()
	if err != nil {
		t.Fatalf("GetPassedExams after delete failed: %v", err)
	}
	if len(passedAfterDelete) != 1 || passedAfterDelete[0].ID != "passed-1" || passedAfterDelete[0].Grade != 30 {
		t.Fatalf("Expected 1 passed exam with updated grade 30, got: %+v", passedAfterDelete)
	}
}

