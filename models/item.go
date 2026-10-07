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

// AIChatMessage is a single turn of the AI assistant conversation
type AIChatMessage struct {
	Role         string `json:"role"`         // "user" or "model"
	Text         string `json:"text"`         // Visible message text (question or answer)
	SelectedText string `json:"selectedText"` // Optional passage of the document the question refers to
	HasImageCrop bool   `json:"hasImageCrop"` // True if the question referred to a selected image region
}

// AIAskRequest is the payload sent by the frontend to start an AI answer stream
type AIAskRequest struct {
	RequestID       string          `json:"requestId"`       // Client-generated ID used to correlate stream events
	ItemID          string          `json:"itemId"`          // Drive item used as document context (optional if DocumentText is set)
	DocumentName    string          `json:"documentName"`    // Display name of the document
	DocumentText    string          `json:"documentText"`    // Optional in-memory text overriding the stored file (e.g. unsaved Markdown)
	Question        string          `json:"question"`        // Current user question
	SelectedText    string          `json:"selectedText"`    // Optional selected passage
	ImageCropBase64 string          `json:"imageCropBase64"` // Optional base64 image of a selected region (no data URL prefix)
	ImageCropMime   string          `json:"imageCropMime"`   // MIME type of the image crop
	History         []AIChatMessage `json:"history"`         // Previous completed turns
}

// AISettings describes the current AI assistant configuration (the API key is never returned in clear)
type AISettings struct {
	HasAPIKey bool   `json:"hasApiKey"`
	MaskedKey string `json:"maskedKey"`
	Model     string `json:"model"`
}

// AIModelInfo is a model selectable in the AI settings
type AIModelInfo struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Description string `json:"description"`
}

// PodcastTurn represents a single speaker exchange in a podcast episode
type PodcastTurn struct {
	Speaker   string  `json:"speaker"`   // "Marco" or "Elena"
	Text      string  `json:"text"`      // Dialogue line
	StartTime float64 `json:"startTime"` // Start offset in seconds
	EndTime   float64 `json:"endTime"`   // End offset in seconds
}

// PodcastEpisode represents a saved NotebookLM-style podcast session
type PodcastEpisode struct {
	ID              string        `json:"id"`
	Title           string        `json:"title"`
	Topic           string        `json:"topic"`
	Tone            string        `json:"tone"`
	SourceItemIDs   []string      `json:"sourceItemIds"`
	SourceItemNames []string      `json:"sourceItemNames"`
	Turns           []PodcastTurn `json:"turns"`
	AudioPath       string        `json:"audioPath"`
	DurationSeconds float64       `json:"durationSeconds"`
	CreatedAt       time.Time     `json:"createdAt"`
}

// PodcastGenerateRequest contains parameters for creating a new podcast
type PodcastGenerateRequest struct {
	ItemIDs         []string `json:"itemIds"`
	CustomQuestions string   `json:"customQuestions"`
	Tone            string   `json:"tone"`   // "colloquial" | "academic"
	Length          string   `json:"length"` // "short" | "standard" | "deep"
}

// PodcastProgressEvent notifies the frontend of podcast creation progress
type PodcastProgressEvent struct {
	Stage       string `json:"stage"` // "sources", "script", "synthesis", "complete", "error"
	Percent     int    `json:"percent"`
	Message     string `json:"message"`
	CurrentTurn int    `json:"currentTurn"`
	TotalTurns  int    `json:"totalTurns"`
	Error       string `json:"error,omitempty"`
}

// StudyHandout represents an AI-generated structured study handout, synthesis, or simplification
type StudyHandout struct {
	ID              string    `json:"id"`
	Title           string    `json:"title"`
	Topic           string    `json:"topic"`
	Mode            string    `json:"mode"`         // "reasoned_handout" | "didactic_simplification" | "technical_deep_dive" | "exam_prep"
	DetailLevel     string    `json:"detailLevel"` // "concise" | "standard" | "exhaustive"
	SourceItemIDs   []string  `json:"sourceItemIds"`
	SourceItemNames []string  `json:"sourceItemNames"`
	ContentMarkdown string    `json:"contentMarkdown"`
	DriveItemID     *string   `json:"driveItemId,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// StudyHandoutGenerateRequest contains parameters for creating a new study handout from multiple sources
type StudyHandoutGenerateRequest struct {
	Title              string   `json:"title"`
	Topic              string   `json:"topic"`
	ItemIDs            []string `json:"itemIds"`
	Mode               string   `json:"mode"`        // "reasoned_handout" | "didactic_simplification" | "technical_deep_dive" | "exam_prep"
	DetailLevel        string   `json:"detailLevel"` // "concise" | "standard" | "exhaustive"
	CustomInstructions string   `json:"customInstructions"`
	SaveToDrive        bool     `json:"saveToDrive"`
	TargetFolderID     string   `json:"targetFolderId"`
}

// StudyHandoutProgressEvent notifies the frontend of study handout generation progress
type StudyHandoutProgressEvent struct {
	Stage   string `json:"stage"` // "sources", "structuring", "generating", "saving", "complete", "error"
	Percent int    `json:"percent"`
	Message string `json:"message"`
	Error   string `json:"error,omitempty"`
}


