package models

import "time"

// Item represents a file or folder in EduDrive
type Item struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	ParentID    *string   `json:"parentId"` // nil / empty string represents root
	IsFolder    bool      `json:"isFolder"`
	SizeBytes   int64     `json:"sizeBytes"`
	MimeType    string    `json:"mimeType"`
	StoragePath string    `json:"storagePath"`
	IsTrash     bool      `json:"isTrash"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// Breadcrumb represents a step in folder navigation
type Breadcrumb struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ExamDate represents an upcoming exam deadline in EduDrive
type ExamDate struct {
	ID        string    `json:"id"`
	Subject   string    `json:"subject"`
	ExamDate  time.Time `json:"examDate"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// StorageStats contains overall storage usage statistics
type StorageStats struct {
	TotalSizeBytes int64 `json:"totalSizeBytes"`
	TotalFiles     int64 `json:"totalFiles"`
	TotalFolders   int64 `json:"totalFolders"`
	TrashSizeBytes int64 `json:"trashSizeBytes"`
	TrashItems     int64 `json:"trashItems"`
}

// PassedExam represents a passed exam in the student booklet with subject, grade, honors, and CFU
type PassedExam struct {
	ID        string    `json:"id"`
	Subject   string    `json:"subject"`
	Grade     int       `json:"grade"`
	IsHonors  bool      `json:"isHonors"`
	CFU       int       `json:"cfu"`
	ExamDate  string    `json:"examDate"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

