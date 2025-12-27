package main

import (
	"archive/zip"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/getlantern/systray"
	"golang.org/x/sys/windows/svc"
)

const VERSION = "3.0.0"

// Config 配置结构
type Config struct {
	Port      int               `json:"port"`
	Paths     map[string]string `json:"paths"`
	LogDir    string            `json:"log_dir"`
	MaxUpload int64             `json:"max_upload_mb"`

	// 安全配置
	Security SecurityConfig `json:"security"`
}

// SecurityConfig 安全配置 (非对称签名)
type SecurityConfig struct {
	Enabled        bool     `json:"enabled"`         // 是否启用安全认证
	PublicKey      string   `json:"public_key"`      // Ed25519 公钥 (服务器只存公钥!)
	TimestampLimit int64    `json:"timestamp_limit"` // 时间戳有效期(秒)
	AllowedIPs     []string `json:"allowed_ips"`     // IP白名单(可选)
}

// 全局变量
var (
	config     Config
	configPath string
	logFile    *os.File
	logMutex   sync.Mutex
	exePath    string
	publicKey  ed25519.PublicKey
	httpServer *http.Server
	stats      = struct {
		sync.Mutex
		totalUploads   int
		totalBytes     int64
		lastUploadTime time.Time
		failedAuth     int
	}{}
)

// deployService 实现 Windows 服务接口
type deployService struct{}

func (m *deployService) Execute(args []string, r <-chan svc.ChangeRequest, changes chan<- svc.Status) (ssec bool, errno uint32) {
	const cmdsAccepted = svc.AcceptStop | svc.AcceptShutdown
	changes <- svc.Status{State: svc.StartPending}

	// 初始化
	var err error
	exePath, err = os.Executable()
	if err != nil {
		return
	}
	exePath = filepath.Dir(exePath)

	configPath = filepath.Join(exePath, "config.json")
	if err := loadConfig(); err != nil {
		// 服务模式下配置加载失败直接返回
		return
	}

	initLogger()
	logInfo("Windows服务模式启动，端口: %d，安全认证: %v", config.Port, config.Security.Enabled)

	// 启动 HTTP 服务器
	go startServerWithShutdown()

	changes <- svc.Status{State: svc.Running, Accepts: cmdsAccepted}

loop:
	for {
		select {
		case c := <-r:
			switch c.Cmd {
			case svc.Interrogate:
				changes <- c.CurrentStatus
			case svc.Stop, svc.Shutdown:
				logInfo("收到停止信号，正在关闭服务...")
				break loop
			default:
				logError("未知的服务控制命令: %v", c)
			}
		}
	}

	changes <- svc.Status{State: svc.StopPending}

	// 优雅关闭 HTTP 服务器
	if httpServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		httpServer.Shutdown(ctx)
	}

	logInfo("服务已停止")
	return
}

// 内嵌的图标数据
var iconData = []byte{
	0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10, 0x00, 0x00, 0x01, 0x00,
	0x20, 0x00, 0x68, 0x04, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00, 0x28, 0x00,
	0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x01, 0x00,
	0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00,
}

func main() {
	var err error
	exePath, err = os.Executable()
	if err != nil {
		log.Fatal("无法获取可执行文件路径:", err)
	}
	exePath = filepath.Dir(exePath)

	// 处理命令行参数 (在加载配置之前)
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "-genkey", "--genkey":
			generateKeyPair()
			return
		case "-help", "--help", "-h":
			printHelp()
			return
		case "-version", "--version", "-v":
			fmt.Printf("Deploy Receiver v%s\n", VERSION)
			return
		case "-service", "--service", "-s":
			// 服务模式：静默运行，无GUI无控制台
			runServiceMode()
			return
		}
	}

	configPath = filepath.Join(exePath, "config.json")
	if err := loadConfig(); err != nil {
		log.Fatal(err)
	}

	initLogger()

	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "-console", "--console", "-c":
			runConsoleMode()
			return
		}
	}

	systray.Run(onReady, onExit)
}

func printHelp() {
	fmt.Printf(`Deploy Receiver v%s - 安全部署文件接收器

用法:
  deploy_receiver.exe [选项]

选项:
  -s, --service   服务模式 (静默后台运行，用于Windows服务)
  -c, --console   命令行模式运行
  -genkey         生成密钥对 (私钥保存本地, 公钥放服务器)
  -h, --help      显示帮助信息
  -v, --version   显示版本信息

安全特性 (非对称加密):
  - Ed25519 数字签名
  - 私钥只在客户端，服务器只有公钥
  - 即使服务器被入侵，攻击者也无法伪造请求
  - 时间戳防重放攻击
  - 自动解压ZIP文件

配置文件: config.json (只存公钥)
日志目录: logs/
`, VERSION)
}

// generateKeyPair 生成 Ed25519 密钥对
func generateKeyPair() {
	pubKey, privKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		fmt.Println("生成密钥失败:", err)
		return
	}

	pubKeyHex := hex.EncodeToString(pubKey)
	privKeyHex := hex.EncodeToString(privKey)

	fmt.Println("============================================================")
	fmt.Println("  Ed25519 密钥对已生成 (非对称加密)")
	fmt.Println("============================================================")
	fmt.Println()
	fmt.Println("【公钥】- 放到云服务器的 config.json 中:")
	fmt.Println(pubKeyHex)
	fmt.Println()
	fmt.Println("【私钥】- 只保存在你的本机! 绝对不要泄露!")
	fmt.Println(privKeyHex)
	fmt.Println()
	fmt.Println("============================================================")
	fmt.Println("安全说明:")
	fmt.Println("  - 公钥: 放在服务器，只能验证签名，无法伪造")
	fmt.Println("  - 私钥: 只在你本机，用于签名请求")
	fmt.Println("  - 即使服务器被黑客入侵，他也无法上传文件!")
	fmt.Println("============================================================")

	// 同时保存到文件方便复制
	keyFile := filepath.Join(exePath, "keys.txt")
	content := fmt.Sprintf(`Deploy Receiver 密钥对
生成时间: %s

【公钥】放到云服务器 config.json 的 security.public_key:
%s

【私钥】只保存在本机，配置到客户端脚本:
%s

警告: 私钥绝对不要上传到服务器或泄露给任何人!
`, time.Now().Format("2006-01-02 15:04:05"), pubKeyHex, privKeyHex)

	os.WriteFile(keyFile, []byte(content), 0600)
	fmt.Printf("\n密钥已保存到: %s\n", keyFile)
	fmt.Println("请妥善保管私钥后删除此文件!")
}

func onReady() {
	systray.SetIcon(iconData)
	systray.SetTitle("Deploy Receiver")

	secStatus := "关闭"
	if config.Security.Enabled {
		secStatus = "开启(Ed25519)"
	}
	systray.SetTooltip(fmt.Sprintf("部署接收器 - 端口 %d - 安全: %s", config.Port, secStatus))

	mStatus := systray.AddMenuItem(fmt.Sprintf("状态: 运行中 (安全: %s)", secStatus), "服务状态")
	mStatus.Disable()

	systray.AddSeparator()

	mStats := systray.AddMenuItem("统计信息", "查看统计")
	mOpenLog := systray.AddMenuItem("打开日志目录", "查看日志")
	mOpenConfig := systray.AddMenuItem("打开配置文件", "编辑配置")

	systray.AddSeparator()

	mReload := systray.AddMenuItem("重载配置", "重新加载配置文件")

	systray.AddSeparator()

	mQuit := systray.AddMenuItem("退出", "停止服务并退出")

	go startServer()

	if config.Security.Enabled {
		logInfo("服务已启动，端口: %d，安全认证: Ed25519 非对称签名", config.Port)
	} else {
		logInfo("服务已启动，端口: %d，安全认证: 已关闭 (警告: 不安全!)", config.Port)
	}

	go func() {
		for {
			select {
			case <-mStats.ClickedCh:
				showStats()
			case <-mOpenLog.ClickedCh:
				openPath(filepath.Join(exePath, config.LogDir))
			case <-mOpenConfig.ClickedCh:
				openPath(configPath)
			case <-mReload.ClickedCh:
				if err := loadConfig(); err != nil {
					logError("配置重载失败: %v", err)
				} else {
					logInfo("配置已重载")
				}
			case <-mQuit.ClickedCh:
				systray.Quit()
				return
			}
		}
	}()
}

func onExit() {
	logInfo("服务已停止")
	if logFile != nil {
		logFile.Close()
	}
}

// runServiceMode 服务模式：作为 Windows 服务运行
func runServiceMode() {
	err := svc.Run("Deploy Receiver Service", &deployService{})
	if err != nil {
		log.Fatalf("服务运行失败: %v", err)
	}
}

// startServerWithShutdown 启动支持优雅关闭的HTTP服务器
func startServerWithShutdown() {
	mux := http.NewServeMux()
	mux.HandleFunc("/upload/", handleUpload)
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/", handleRoot)

	httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%d", config.Port),
		Handler: mux,
	}

	logInfo("HTTP服务器启动在 :%d", config.Port)

	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logError("HTTP服务器错误: %v", err)
	}
}

func runConsoleMode() {
	fmt.Println("============================================================")
	fmt.Printf("  Deploy Receiver v%s (控制台模式)\n", VERSION)
	fmt.Println("============================================================")
	fmt.Printf("端口: %d\n", config.Port)
	fmt.Printf("安全认证: %v\n", config.Security.Enabled)
	if config.Security.Enabled {
		fmt.Println("认证方式: Ed25519 非对称签名")
		fmt.Printf("时间戳有效期: %d秒\n", config.Security.TimestampLimit)
		if len(config.Security.AllowedIPs) > 0 {
			fmt.Printf("IP白名单: %v\n", config.Security.AllowedIPs)
		}
	}
	fmt.Println("配置的路径:")
	for key, path := range config.Paths {
		fmt.Printf("  %s -> %s\n", key, path)
	}
	fmt.Println("------------------------------------------------------------")
	fmt.Println("按 Ctrl+C 停止服务")
	fmt.Println()

	startServer()
}

func loadConfig() error {
	// 先检查文件是否存在
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return fmt.Errorf("配置文件不存在: %s\n请手动创建配置文件", configPath)
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("无法读取配置文件: %v", err)
	}

	if err := json.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("配置文件格式错误: %v", err)
	}

	// 设置默认值
	if config.Port == 0 {
		config.Port = 8022
	}
	if config.LogDir == "" {
		config.LogDir = "logs"
	}
	if config.MaxUpload == 0 {
		config.MaxUpload = 500
	}
	if config.Security.TimestampLimit == 0 {
		config.Security.TimestampLimit = 300
	}

	// 解析公钥
	if config.Security.Enabled && config.Security.PublicKey != "" {
		pubKeyBytes, err := hex.DecodeString(config.Security.PublicKey)
		if err != nil || len(pubKeyBytes) != ed25519.PublicKeySize {
			return fmt.Errorf("无效的公钥格式")
		}
		publicKey = ed25519.PublicKey(pubKeyBytes)
	}

	return nil
}

func initLogger() {
	logDir := filepath.Join(exePath, config.LogDir)
	os.MkdirAll(logDir, 0755)

	logFileName := fmt.Sprintf("deploy_%s.log", time.Now().Format("2006-01-02"))
	logPath := filepath.Join(logDir, logFileName)

	var err error
	logFile, err = os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		log.Println("无法创建日志文件:", err)
	}
}

func logInfo(format string, args ...interface{}) {
	writeLog("INFO", format, args...)
}

func logError(format string, args ...interface{}) {
	writeLog("ERROR", format, args...)
}

func logWarn(format string, args ...interface{}) {
	writeLog("WARN", format, args...)
}

func writeLog(level, format string, args ...interface{}) {
	logMutex.Lock()
	defer logMutex.Unlock()

	msg := fmt.Sprintf(format, args...)
	timestamp := time.Now().Format("2006-01-02 15:04:05")
	logLine := fmt.Sprintf("[%s] [%s] %s\r\n", timestamp, level, msg)

	fmt.Print(logLine)

	if logFile != nil {
		logFile.WriteString(logLine)
	}
}

func startServer() {
	http.HandleFunc("/upload/", handleUpload)
	http.HandleFunc("/health", handleHealth)
	http.HandleFunc("/", handleRoot)

	addr := fmt.Sprintf(":%d", config.Port)
	logInfo("HTTP服务器启动在 %s", addr)

	if err := http.ListenAndServe(addr, nil); err != nil {
		logError("HTTP服务器错误: %v", err)
	}
}

func handleRoot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service":  "Deploy Receiver",
		"version":  VERSION,
		"status":   "running",
		"security": config.Security.Enabled,
		"auth":     "Ed25519",
		"paths":    getPathKeys(),
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}

// verifyRequest 验证请求安全性 (Ed25519 签名)
func verifyRequest(r *http.Request) (bool, string) {
	if !config.Security.Enabled {
		return true, ""
	}

	clientIP := getClientIP(r)

	// 检查IP白名单
	if len(config.Security.AllowedIPs) > 0 {
		allowed := false
		for _, ip := range config.Security.AllowedIPs {
			if ip == clientIP || ip == "*" {
				allowed = true
				break
			}
		}
		if !allowed {
			return false, fmt.Sprintf("IP不在白名单: %s", clientIP)
		}
	}

	// 获取认证头
	timestamp := r.Header.Get("X-Timestamp")
	signature := r.Header.Get("X-Signature")
	nonce := r.Header.Get("X-Nonce")

	if timestamp == "" || signature == "" {
		return false, "缺少认证头 (X-Timestamp, X-Signature)"
	}

	// 验证时间戳
	ts, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return false, "无效的时间戳格式"
	}

	now := time.Now().Unix()
	diff := now - ts
	if diff < 0 {
		diff = -diff
	}
	if diff > config.Security.TimestampLimit {
		return false, fmt.Sprintf("时间戳已过期 (差异: %d秒, 限制: %d秒)", diff, config.Security.TimestampLimit)
	}

	// 验证 Ed25519 签名
	message := timestamp + nonce + r.URL.Path
	sigBytes, err := hex.DecodeString(signature)
	if err != nil {
		return false, "无效的签名格式"
	}

	if !ed25519.Verify(publicKey, []byte(message), sigBytes) {
		return false, "签名验证失败"
	}

	return true, ""
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	ip := r.RemoteAddr
	if idx := strings.LastIndex(ip, ":"); idx != -1 {
		ip = ip[:idx]
	}
	return ip
}

func handleUpload(w http.ResponseWriter, r *http.Request) {
	clientIP := getClientIP(r)

	if r.Method != http.MethodPost {
		http.Error(w, "仅支持POST请求", http.StatusMethodNotAllowed)
		return
	}

	// 安全验证
	if ok, reason := verifyRequest(r); !ok {
		stats.Lock()
		stats.failedAuth++
		stats.Unlock()

		logWarn("认证失败 [%s]: %s", clientIP, reason)
		http.Error(w, "认证失败: "+reason, http.StatusUnauthorized)
		return
	}

	// 解析路径
	path := strings.TrimPrefix(r.URL.Path, "/upload/")
	parts := strings.SplitN(path, "/", 2)

	if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		http.Error(w, "URL格式错误，应为: /upload/{path_key}/{filename}", http.StatusBadRequest)
		logError("[%s] 无效的上传路径: %s", clientIP, r.URL.Path)
		return
	}

	pathKey := parts[0]
	filename := parts[1]

	baseDir, exists := config.Paths[pathKey]
	if !exists {
		http.Error(w, fmt.Sprintf("未知的路径标识: %s", pathKey), http.StatusBadRequest)
		logError("[%s] 未知的路径标识: %s", clientIP, pathKey)
		return
	}

	if !isValidFilename(filename) {
		http.Error(w, "非法的文件名", http.StatusBadRequest)
		logError("[%s] 非法文件名: %s", clientIP, filename)
		return
	}

	fullPath := filepath.Join(baseDir, filename)

	// 路径安全检查
	absBase, _ := filepath.Abs(baseDir)
	absPath, _ := filepath.Abs(fullPath)
	if !strings.HasPrefix(absPath, absBase) {
		http.Error(w, "路径安全检查失败", http.StatusBadRequest)
		logError("[%s] 路径遍历攻击: %s", clientIP, filename)
		return
	}

	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		http.Error(w, "创建目录失败", http.StatusInternalServerError)
		logError("[%s] 创建目录失败: %v", clientIP, err)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, config.MaxUpload*1024*1024)

	data, err := io.ReadAll(r.Body)
	if err != nil {
		if strings.Contains(err.Error(), "http: request body too large") {
			http.Error(w, fmt.Sprintf("文件过大，最大 %dMB", config.MaxUpload), http.StatusRequestEntityTooLarge)
		} else {
			http.Error(w, "读取数据失败", http.StatusInternalServerError)
		}
		logError("[%s] 读取失败: %v", clientIP, err)
		return
	}

	if err := os.WriteFile(fullPath, data, 0644); err != nil {
		http.Error(w, "保存文件失败", http.StatusInternalServerError)
		logError("[%s] 保存失败: %v", clientIP, err)
		return
	}

	// 自动解压
	autoExtract := r.URL.Query().Get("extract") == "true"
	extracted := false
	extractDir := ""

	if autoExtract && strings.HasSuffix(strings.ToLower(filename), ".zip") {
		extractDir = strings.TrimSuffix(fullPath, filepath.Ext(fullPath))
		if err := unzipFile(fullPath, extractDir); err != nil {
			logWarn("[%s] 解压失败: %v", clientIP, err)
		} else {
			extracted = true
			logInfo("[%s] 已解压到: %s", clientIP, extractDir)
		}
	}

	stats.Lock()
	stats.totalUploads++
	stats.totalBytes += int64(len(data))
	stats.lastUploadTime = time.Now()
	stats.Unlock()

	response := map[string]interface{}{
		"status":    "ok",
		"path":      fullPath,
		"size":      len(data),
		"path_key":  pathKey,
		"filename":  filename,
		"extracted": extracted,
	}
	if extracted {
		response["extract_dir"] = extractDir
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)

	logInfo("[%s] 已保存: %s (%d bytes)", clientIP, filename, len(data))
}

func isValidFilename(filename string) bool {
	cleaned := filepath.Clean(filename)

	if strings.Contains(cleaned, "..") {
		return false
	}
	if filepath.IsAbs(cleaned) {
		return false
	}

	suspicious := []string{"<", ">", ":", "\"", "|", "?", "*", "\x00"}
	for _, s := range suspicious {
		if strings.Contains(filename, s) {
			return false
		}
	}

	parts := strings.Split(cleaned, string(filepath.Separator))
	for _, part := range parts {
		if strings.HasPrefix(part, ".") && part != "." {
			return false
		}
	}

	return true
}

func unzipFile(src, dest string) error {
	r, err := zip.OpenReader(src)
	if err != nil {
		return err
	}
	defer r.Close()

	os.MkdirAll(dest, 0755)

	for _, f := range r.File {
		fpath := filepath.Join(dest, f.Name)
		if !strings.HasPrefix(fpath, filepath.Clean(dest)+string(os.PathSeparator)) {
			return fmt.Errorf("非法路径: %s", f.Name)
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, 0755)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(fpath), 0755); err != nil {
			return err
		}

		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()

		if err != nil {
			return err
		}
	}

	return nil
}

func getPathKeys() []string {
	keys := make([]string, 0, len(config.Paths))
	for k := range config.Paths {
		keys = append(keys, k)
	}
	return keys
}

func showStats() {
	stats.Lock()
	defer stats.Unlock()

	msg := fmt.Sprintf(`统计信息:
总上传次数: %d
总传输大小: %.2f MB
最后上传: %s
认证失败: %d`,
		stats.totalUploads,
		float64(stats.totalBytes)/1024/1024,
		formatTime(stats.lastUploadTime),
		stats.failedAuth)

	fmt.Println("\n" + msg)
	logInfo("查看统计信息")
}

func formatTime(t time.Time) string {
	if t.IsZero() {
		return "无"
	}
	return t.Format("2006-01-02 15:04:05")
}

func openPath(path string) {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		if !strings.Contains(filepath.Base(path), ".") {
			os.MkdirAll(path, 0755)
		} else {
			os.MkdirAll(filepath.Dir(path), 0755)
		}
	}

	cmd := exec.Command("explorer", path)
	cmd.Start()
	logInfo("打开: %s", path)
}
