package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"client-gui/internal/crypto"
	"client-gui/internal/database"
	"client-gui/internal/uploader"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
	db  *database.DB
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// 初始化数据库
	db, err := database.New()
	if err != nil {
		runtime.LogError(ctx, fmt.Sprintf("数据库初始化失败: %v", err))
		return
	}
	a.db = db
}

// shutdown is called when the app is shutting down
func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
}

// ============= 服务器管理 =============

// GetServers 获取所有服务器
func (a *App) GetServers() ([]database.Server, error) {
	return a.db.GetServers()
}

// SaveServer 保存服务器
func (a *App) SaveServer(server database.Server) error {
	if server.ID == "" {
		server.ID = fmt.Sprintf("server_%d", time.Now().UnixNano())
	}
	return a.db.SaveServer(server)
}

// DeleteServer 删除服务器
func (a *App) DeleteServer(id string) error {
	return a.db.DeleteServer(id)
}

// SetDefaultServer 设置默认服务器
func (a *App) SetDefaultServer(id string) error {
	return a.db.SetDefaultServer(id)
}

// TestConnection 测试服务器连接
func (a *App) TestConnection(serverURL string) error {
	return uploader.TestConnection(serverURL)
}

// GetServerInfo 获取服务器信息
func (a *App) GetServerInfo(serverURL string) (map[string]interface{}, error) {
	return uploader.GetServerInfo(serverURL)
}

// ============= 密钥管理 =============

// GenerateKeyPair 生成密钥对
func (a *App) GenerateKeyPair() (map[string]string, error) {
	privateKey, publicKey, err := crypto.GenerateKeyPair()
	if err != nil {
		return nil, err
	}
	return map[string]string{
		"privateKey": privateKey,
		"publicKey":  publicKey,
	}, nil
}

// SaveKeyPair 保存密钥对
func (a *App) SaveKeyPair(privateKey string) error {
	publicKey, err := crypto.GetPublicKeyFromPrivate(privateKey)
	if err != nil {
		return err
	}
	return a.db.SaveKeyPair(privateKey, publicKey)
}

// GetKeyPair 获取密钥对
func (a *App) GetKeyPair() (*database.KeyPair, error) {
	return a.db.GetKeyPair()
}

// GetPublicKeyFromPrivate 从私钥获取公钥
func (a *App) GetPublicKeyFromPrivate(privateKey string) (string, error) {
	return crypto.GetPublicKeyFromPrivate(privateKey)
}

// ============= 上传功能 =============

// UploadResult 上传结果
type UploadResultWrapper struct {
	uploader.UploadResult
	ServerName string `json:"serverName"`
}

// UploadFile 上传文件
func (a *App) UploadFile(serverID, pathKey, filePath string, extract bool) (*UploadResultWrapper, error) {
	// 获取服务器信息
	servers, err := a.db.GetServers()
	if err != nil {
		return nil, err
	}

	var server *database.Server
	for _, s := range servers {
		if s.ID == serverID {
			server = &s
			break
		}
	}
	if server == nil {
		return nil, fmt.Errorf("服务器不存在: %s", serverID)
	}

	// 获取私钥
	keyPair, err := a.db.GetKeyPair()
	if err != nil {
		return nil, err
	}

	privateKey := ""
	if keyPair != nil {
		privateKey = keyPair.PrivateKey
	}

	// 上传文件
	result, err := uploader.UploadFile(server.URL, pathKey, filePath, privateKey, extract, func(sent, total int64) {
		// 发送进度事件到前端
		runtime.EventsEmit(a.ctx, "upload:progress", map[string]interface{}{
			"filename": filepath.Base(filePath),
			"sent":     sent,
			"total":    total,
			"percent":  float64(sent) / float64(total) * 100,
		})
	})

	if err != nil {
		return nil, err
	}

	// 记录历史
	a.db.AddHistory(database.HistoryEntry{
		ServerID:   serverID,
		ServerName: server.Name,
		PathKey:    pathKey,
		Filename:   filepath.Base(filePath),
		FileSize:   result.Size,
		Status:     map[bool]string{true: "success", false: "failed"}[result.Success],
		ErrorMsg:   result.Error,
	})

	return &UploadResultWrapper{
		UploadResult: *result,
		ServerName:   server.Name,
	}, nil
}

// SelectFile 选择文件对话框
func (a *App) SelectFile() (string, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择文件",
	})
	return path, err
}

// SelectFolder 选择文件夹对话框
func (a *App) SelectFolder() (string, error) {
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择文件夹",
	})
	return path, err
}

// GetFileInfo 获取文件信息
func (a *App) GetFileInfo(filePath string) (map[string]interface{}, error) {
	info, err := os.Stat(filePath)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"name":    info.Name(),
		"size":    info.Size(),
		"isDir":   info.IsDir(),
		"modTime": info.ModTime().Format(time.RFC3339),
	}, nil
}

// ============= 历史记录 =============

// GetHistory 获取历史记录
func (a *App) GetHistory(limit int) ([]database.HistoryEntry, error) {
	if limit <= 0 {
		limit = 100
	}
	return a.db.GetHistory(limit)
}

// ClearHistory 清空历史记录
func (a *App) ClearHistory() error {
	return a.db.ClearHistory()
}

// ============= 文件夹监控 =============

// GetWatches 获取所有监控配置
func (a *App) GetWatches() ([]database.WatchConfig, error) {
	return a.db.GetWatches()
}

// SaveWatch 保存监控配置
func (a *App) SaveWatch(watch database.WatchConfig) error {
	if watch.ID == "" {
		watch.ID = fmt.Sprintf("watch_%d", time.Now().UnixNano())
	}
	return a.db.SaveWatch(watch)
}

// DeleteWatch 删除监控配置
func (a *App) DeleteWatch(id string) error {
	return a.db.DeleteWatch(id)
}

// ============= 定时任务 =============

// GetSchedules 获取所有定时任务
func (a *App) GetSchedules() ([]database.Schedule, error) {
	return a.db.GetSchedules()
}

// SaveSchedule 保存定时任务
func (a *App) SaveSchedule(schedule database.Schedule) error {
	if schedule.ID == "" {
		schedule.ID = fmt.Sprintf("schedule_%d", time.Now().UnixNano())
	}
	return a.db.SaveSchedule(schedule)
}

// DeleteSchedule 删除定时任务
func (a *App) DeleteSchedule(id string) error {
	return a.db.DeleteSchedule(id)
}

// ============= 工具方法 =============

// GetDataDir 获取数据目录
func (a *App) GetDataDir() string {
	return database.GetDataDir()
}
