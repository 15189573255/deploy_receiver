package database

import (
	"database/sql"
	"os"
	"path/filepath"
	"runtime"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

// Server 服务器配置
type Server struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	URL       string   `json:"url"`
	Paths     []string `json:"paths"`
	IsDefault bool     `json:"isDefault"`
	CreatedAt string   `json:"createdAt"`
}

// KeyPair 密钥对
type KeyPair struct {
	PrivateKey string `json:"privateKey"`
	PublicKey  string `json:"publicKey"`
	UpdatedAt  string `json:"updatedAt"`
}

// HistoryEntry 上传历史
type HistoryEntry struct {
	ID         int64  `json:"id"`
	ServerID   string `json:"serverId"`
	ServerName string `json:"serverName"`
	PathKey    string `json:"pathKey"`
	Filename   string `json:"filename"`
	FileSize   int64  `json:"fileSize"`
	Status     string `json:"status"`
	ErrorMsg   string `json:"errorMsg"`
	UploadedAt string `json:"uploadedAt"`
}

// WatchConfig 监控配置
type WatchConfig struct {
	ID         string   `json:"id"`
	FolderPath string   `json:"folderPath"`
	ServerID   string   `json:"serverId"`
	PathKey    string   `json:"pathKey"`
	Patterns   []string `json:"patterns"`
	DebounceMs int      `json:"debounceMs"`
	Enabled    bool     `json:"enabled"`
}

// Schedule 定时任务
type Schedule struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	CronExpr string `json:"cronExpr"`
	FilePath string `json:"filePath"`
	ServerID string `json:"serverId"`
	PathKey  string `json:"pathKey"`
	Extract  bool   `json:"extract"`
	Enabled  bool   `json:"enabled"`
}

// GetDataDir 获取数据目录
func GetDataDir() string {
	var dir string
	switch runtime.GOOS {
	case "windows":
		dir = os.Getenv("APPDATA")
	case "darwin":
		dir = filepath.Join(os.Getenv("HOME"), "Library", "Application Support")
	default:
		dir = filepath.Join(os.Getenv("HOME"), ".config")
	}
	return filepath.Join(dir, "DeployReceiverClient")
}

// New 创建数据库连接
func New() (*DB, error) {
	dataDir := GetDataDir()
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	dbPath := filepath.Join(dataDir, "data.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	d := &DB{db}
	if err := d.init(); err != nil {
		return nil, err
	}

	return d, nil
}

func (d *DB) init() error {
	schema := `
	CREATE TABLE IF NOT EXISTS servers (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		url TEXT NOT NULL,
		paths TEXT DEFAULT '[]',
		is_default INTEGER DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS keys (
		id INTEGER PRIMARY KEY CHECK (id = 1),
		encrypted_private_key TEXT,
		public_key TEXT,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		server_id TEXT,
		server_name TEXT,
		path_key TEXT,
		filename TEXT,
		file_size INTEGER,
		status TEXT,
		error_msg TEXT,
		uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS watches (
		id TEXT PRIMARY KEY,
		folder_path TEXT,
		server_id TEXT,
		path_key TEXT,
		patterns TEXT DEFAULT '[]',
		debounce_ms INTEGER DEFAULT 1000,
		enabled INTEGER DEFAULT 1
	);

	CREATE TABLE IF NOT EXISTS schedules (
		id TEXT PRIMARY KEY,
		name TEXT,
		cron_expr TEXT,
		file_path TEXT,
		server_id TEXT,
		path_key TEXT,
		extract INTEGER DEFAULT 0,
		enabled INTEGER DEFAULT 1
	);
	`
	_, err := d.Exec(schema)
	return err
}

// SaveServer 保存服务器配置
func (d *DB) SaveServer(s Server) error {
	pathsJSON := "[]"
	if len(s.Paths) > 0 {
		pathsJSON = toJSON(s.Paths)
	}

	_, err := d.Exec(`
		INSERT INTO servers (id, name, url, paths, is_default)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET name=?, url=?, paths=?, is_default=?
	`, s.ID, s.Name, s.URL, pathsJSON, boolToInt(s.IsDefault),
		s.Name, s.URL, pathsJSON, boolToInt(s.IsDefault))
	return err
}

// GetServers 获取所有服务器
func (d *DB) GetServers() ([]Server, error) {
	rows, err := d.Query("SELECT id, name, url, paths, is_default, created_at FROM servers ORDER BY created_at")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var servers []Server
	for rows.Next() {
		var s Server
		var pathsJSON string
		var isDefault int
		if err := rows.Scan(&s.ID, &s.Name, &s.URL, &pathsJSON, &isDefault, &s.CreatedAt); err != nil {
			return nil, err
		}
		s.Paths = fromJSON(pathsJSON)
		s.IsDefault = isDefault == 1
		servers = append(servers, s)
	}
	return servers, nil
}

// DeleteServer 删除服务器
func (d *DB) DeleteServer(id string) error {
	_, err := d.Exec("DELETE FROM servers WHERE id = ?", id)
	return err
}

// SetDefaultServer 设置默认服务器
func (d *DB) SetDefaultServer(id string) error {
	tx, err := d.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("UPDATE servers SET is_default = 0"); err != nil {
		return err
	}
	if _, err := tx.Exec("UPDATE servers SET is_default = 1 WHERE id = ?", id); err != nil {
		return err
	}
	return tx.Commit()
}

// SaveKeyPair 保存密钥对
func (d *DB) SaveKeyPair(privateKey, publicKey string) error {
	_, err := d.Exec(`
		INSERT INTO keys (id, encrypted_private_key, public_key, updated_at)
		VALUES (1, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET encrypted_private_key=?, public_key=?, updated_at=?
	`, privateKey, publicKey, time.Now().Format(time.RFC3339),
		privateKey, publicKey, time.Now().Format(time.RFC3339))
	return err
}

// GetKeyPair 获取密钥对
func (d *DB) GetKeyPair() (*KeyPair, error) {
	var kp KeyPair
	err := d.QueryRow("SELECT encrypted_private_key, public_key, updated_at FROM keys WHERE id = 1").
		Scan(&kp.PrivateKey, &kp.PublicKey, &kp.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &kp, nil
}

// AddHistory 添加历史记录
func (d *DB) AddHistory(h HistoryEntry) error {
	_, err := d.Exec(`
		INSERT INTO history (server_id, server_name, path_key, filename, file_size, status, error_msg)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, h.ServerID, h.ServerName, h.PathKey, h.Filename, h.FileSize, h.Status, h.ErrorMsg)
	return err
}

// GetHistory 获取历史记录
func (d *DB) GetHistory(limit int) ([]HistoryEntry, error) {
	rows, err := d.Query(`
		SELECT id, server_id, server_name, path_key, filename, file_size, status, error_msg, uploaded_at
		FROM history ORDER BY uploaded_at DESC LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []HistoryEntry
	for rows.Next() {
		var h HistoryEntry
		if err := rows.Scan(&h.ID, &h.ServerID, &h.ServerName, &h.PathKey, &h.Filename, &h.FileSize, &h.Status, &h.ErrorMsg, &h.UploadedAt); err != nil {
			return nil, err
		}
		entries = append(entries, h)
	}
	return entries, nil
}

// ClearHistory 清空历史记录
func (d *DB) ClearHistory() error {
	_, err := d.Exec("DELETE FROM history")
	return err
}

// SaveWatch 保存监控配置
func (d *DB) SaveWatch(w WatchConfig) error {
	patternsJSON := toJSON(w.Patterns)
	_, err := d.Exec(`
		INSERT INTO watches (id, folder_path, server_id, path_key, patterns, debounce_ms, enabled)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET folder_path=?, server_id=?, path_key=?, patterns=?, debounce_ms=?, enabled=?
	`, w.ID, w.FolderPath, w.ServerID, w.PathKey, patternsJSON, w.DebounceMs, boolToInt(w.Enabled),
		w.FolderPath, w.ServerID, w.PathKey, patternsJSON, w.DebounceMs, boolToInt(w.Enabled))
	return err
}

// GetWatches 获取所有监控配置
func (d *DB) GetWatches() ([]WatchConfig, error) {
	rows, err := d.Query("SELECT id, folder_path, server_id, path_key, patterns, debounce_ms, enabled FROM watches")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var watches []WatchConfig
	for rows.Next() {
		var w WatchConfig
		var patternsJSON string
		var enabled int
		if err := rows.Scan(&w.ID, &w.FolderPath, &w.ServerID, &w.PathKey, &patternsJSON, &w.DebounceMs, &enabled); err != nil {
			return nil, err
		}
		w.Patterns = fromJSON(patternsJSON)
		w.Enabled = enabled == 1
		watches = append(watches, w)
	}
	return watches, nil
}

// DeleteWatch 删除监控配置
func (d *DB) DeleteWatch(id string) error {
	_, err := d.Exec("DELETE FROM watches WHERE id = ?", id)
	return err
}

// SaveSchedule 保存定时任务
func (d *DB) SaveSchedule(s Schedule) error {
	_, err := d.Exec(`
		INSERT INTO schedules (id, name, cron_expr, file_path, server_id, path_key, extract, enabled)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET name=?, cron_expr=?, file_path=?, server_id=?, path_key=?, extract=?, enabled=?
	`, s.ID, s.Name, s.CronExpr, s.FilePath, s.ServerID, s.PathKey, boolToInt(s.Extract), boolToInt(s.Enabled),
		s.Name, s.CronExpr, s.FilePath, s.ServerID, s.PathKey, boolToInt(s.Extract), boolToInt(s.Enabled))
	return err
}

// GetSchedules 获取所有定时任务
func (d *DB) GetSchedules() ([]Schedule, error) {
	rows, err := d.Query("SELECT id, name, cron_expr, file_path, server_id, path_key, extract, enabled FROM schedules")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schedules []Schedule
	for rows.Next() {
		var s Schedule
		var extract, enabled int
		if err := rows.Scan(&s.ID, &s.Name, &s.CronExpr, &s.FilePath, &s.ServerID, &s.PathKey, &extract, &enabled); err != nil {
			return nil, err
		}
		s.Extract = extract == 1
		s.Enabled = enabled == 1
		schedules = append(schedules, s)
	}
	return schedules, nil
}

// DeleteSchedule 删除定时任务
func (d *DB) DeleteSchedule(id string) error {
	_, err := d.Exec("DELETE FROM schedules WHERE id = ?", id)
	return err
}

// Helper functions
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func toJSON(arr []string) string {
	if len(arr) == 0 {
		return "[]"
	}
	result := "["
	for i, s := range arr {
		if i > 0 {
			result += ","
		}
		result += `"` + s + `"`
	}
	result += "]"
	return result
}

func fromJSON(s string) []string {
	if s == "" || s == "[]" {
		return []string{}
	}
	// Simple JSON array parsing
	s = s[1 : len(s)-1] // Remove brackets
	if s == "" {
		return []string{}
	}
	var result []string
	inQuote := false
	current := ""
	for _, c := range s {
		switch c {
		case '"':
			inQuote = !inQuote
		case ',':
			if !inQuote {
				result = append(result, current)
				current = ""
			} else {
				current += string(c)
			}
		default:
			if inQuote {
				current += string(c)
			}
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}
