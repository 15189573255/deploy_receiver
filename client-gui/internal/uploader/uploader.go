package uploader

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"client-gui/internal/crypto"
)

// UploadResult 上传结果
type UploadResult struct {
	Success    bool   `json:"success"`
	Status     string `json:"status"`
	Path       string `json:"path"`
	Size       int64  `json:"size"`
	PathKey    string `json:"pathKey"`
	Filename   string `json:"filename"`
	Extracted  bool   `json:"extracted"`
	ExtractDir string `json:"extractDir"`
	Error      string `json:"error"`
}

// UploadProgress 上传进度
type UploadProgress struct {
	Filename   string  `json:"filename"`
	TotalBytes int64   `json:"totalBytes"`
	SentBytes  int64   `json:"sentBytes"`
	Percent    float64 `json:"percent"`
}

// progressReader 带进度的 Reader
type progressReader struct {
	reader     io.Reader
	total      int64
	sent       int64
	onProgress func(sent, total int64)
}

func (pr *progressReader) Read(p []byte) (int, error) {
	n, err := pr.reader.Read(p)
	pr.sent += int64(n)
	if pr.onProgress != nil {
		pr.onProgress(pr.sent, pr.total)
	}
	return n, err
}

// UploadFile 上传文件
func UploadFile(serverURL, pathKey, filePath, privateKey string, extract bool, onProgress func(sent, total int64)) (*UploadResult, error) {
	// 读取文件
	file, err := os.Open(filePath)
	if err != nil {
		return &UploadResult{Success: false, Error: fmt.Sprintf("无法打开文件: %v", err)}, nil
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return &UploadResult{Success: false, Error: fmt.Sprintf("无法获取文件信息: %v", err)}, nil
	}

	filename := filepath.Base(filePath)
	urlPath := fmt.Sprintf("/upload/%s/%s", pathKey, filename)

	// 构建完整 URL（签名只用路径部分，不包含查询参数）
	fullURL := serverURL + urlPath
	if extract {
		fullURL += "?extract=true"
	}

	// 创建签名头（签名只用路径部分，与服务器端一致）
	var timestamp, nonce, signature string
	if privateKey != "" {
		timestamp, nonce, signature, err = crypto.CreateSignedHeaders(privateKey, urlPath)
		if err != nil {
			return &UploadResult{Success: false, Error: fmt.Sprintf("签名失败: %v", err)}, nil
		}
	}

	// 读取文件内容
	fileContent, err := io.ReadAll(file)
	if err != nil {
		return &UploadResult{Success: false, Error: fmt.Sprintf("读取文件失败: %v", err)}, nil
	}

	// 创建带进度的 Reader
	pr := &progressReader{
		reader:     bytes.NewReader(fileContent),
		total:      fileInfo.Size(),
		onProgress: onProgress,
	}

	// 创建请求
	req, err := http.NewRequest("POST", fullURL, pr)
	if err != nil {
		return &UploadResult{Success: false, Error: fmt.Sprintf("创建请求失败: %v", err)}, nil
	}

	req.Header.Set("Content-Type", "application/octet-stream")
	req.ContentLength = fileInfo.Size()

	if privateKey != "" {
		req.Header.Set("X-Timestamp", timestamp)
		req.Header.Set("X-Nonce", nonce)
		req.Header.Set("X-Signature", signature)
	}

	// 发送请求
	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return &UploadResult{Success: false, Error: fmt.Sprintf("请求失败: %v", err)}, nil
	}
	defer resp.Body.Close()

	// 解析响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &UploadResult{Success: false, Error: fmt.Sprintf("读取响应失败: %v", err)}, nil
	}

	var result UploadResult
	if err := json.Unmarshal(body, &result); err != nil {
		// 非 JSON 响应
		if resp.StatusCode >= 400 {
			return &UploadResult{Success: false, Error: fmt.Sprintf("服务器错误 (%d): %s", resp.StatusCode, string(body))}, nil
		}
		return &UploadResult{Success: false, Error: fmt.Sprintf("解析响应失败: %v, 原始响应: %s", err, string(body))}, nil
	}

	result.Success = resp.StatusCode == 200 && result.Status == "ok"
	if !result.Success && result.Error == "" {
		result.Error = fmt.Sprintf("上传失败: %s", result.Status)
	}

	return &result, nil
}

// TestConnection 测试服务器连接
func TestConnection(serverURL string) error {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(serverURL + "/health")
	if err != nil {
		return fmt.Errorf("连接失败: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("服务器响应异常: %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("响应格式错误: %v", err)
	}

	if status, ok := result["status"].(string); !ok || status != "ok" {
		return fmt.Errorf("服务器状态异常: %v", result)
	}

	return nil
}

// GetServerInfo 获取服务器信息
func GetServerInfo(serverURL string) (map[string]interface{}, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(serverURL + "/")
	if err != nil {
		return nil, fmt.Errorf("连接失败: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("响应格式错误: %v", err)
	}

	return result, nil
}

// FileToUpload 待上传的文件信息
type FileToUpload struct {
	AbsPath  string // 文件绝对路径
	RelPath  string // 相对路径（用于服务器端目录结构）
	Size     int64  // 文件大小
}

// ListFilesInDir 列出目录中的所有文件
func ListFilesInDir(dirPath string) ([]FileToUpload, error) {
	var files []FileToUpload

	err := filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// 跳过目录本身
		if info.IsDir() {
			return nil
		}

		// 获取相对路径
		relPath, err := filepath.Rel(dirPath, path)
		if err != nil {
			return err
		}

		files = append(files, FileToUpload{
			AbsPath: path,
			RelPath: filepath.ToSlash(relPath), // 使用正斜杠
			Size:    info.Size(),
		})

		return nil
	})

	return files, err
}

// UploadSingleFile 上传单个文件（支持指定服务器端相对路径）
func UploadSingleFile(serverURL, pathKey, filePath, relPath, privateKey string, onProgress func(sent, total int64)) (*UploadResult, error) {
	// 读取文件
	file, err := os.Open(filePath)
	if err != nil {
		return &UploadResult{Success: false, Error: fmt.Sprintf("无法打开文件: %v", err)}, nil
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return &UploadResult{Success: false, Error: fmt.Sprintf("无法获取文件信息: %v", err)}, nil
	}

	// 使用相对路径构建 URL
	urlPath := fmt.Sprintf("/upload/%s/%s", pathKey, relPath)
	fullURL := serverURL + urlPath

	// 创建签名头
	var timestamp, nonce, signature string
	if privateKey != "" {
		timestamp, nonce, signature, err = crypto.CreateSignedHeaders(privateKey, urlPath)
		if err != nil {
			return &UploadResult{Success: false, Error: fmt.Sprintf("签名失败: %v", err)}, nil
		}
	}

	// 读取文件内容
	fileContent, err := io.ReadAll(file)
	if err != nil {
		return &UploadResult{Success: false, Error: fmt.Sprintf("读取文件失败: %v", err)}, nil
	}

	// 创建带进度的 Reader
	pr := &progressReader{
		reader:     bytes.NewReader(fileContent),
		total:      fileInfo.Size(),
		onProgress: onProgress,
	}

	// 创建请求
	req, err := http.NewRequest("POST", fullURL, pr)
	if err != nil {
		return &UploadResult{Success: false, Error: fmt.Sprintf("创建请求失败: %v", err)}, nil
	}

	req.Header.Set("Content-Type", "application/octet-stream")
	req.ContentLength = fileInfo.Size()

	if privateKey != "" {
		req.Header.Set("X-Timestamp", timestamp)
		req.Header.Set("X-Nonce", nonce)
		req.Header.Set("X-Signature", signature)
	}

	// 发送请求
	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return &UploadResult{Success: false, Error: fmt.Sprintf("请求失败: %v", err)}, nil
	}
	defer resp.Body.Close()

	// 解析响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &UploadResult{Success: false, Error: fmt.Sprintf("读取响应失败: %v", err)}, nil
	}

	var result UploadResult
	if err := json.Unmarshal(body, &result); err != nil {
		if resp.StatusCode >= 400 {
			return &UploadResult{Success: false, Error: fmt.Sprintf("服务器错误 (%d): %s", resp.StatusCode, string(body))}, nil
		}
		return &UploadResult{Success: false, Error: fmt.Sprintf("解析响应失败: %v", err, string(body))}, nil
	}

	result.Success = resp.StatusCode == 200 && result.Status == "ok"
	if !result.Success && result.Error == "" {
		result.Error = fmt.Sprintf("上传失败: %s", result.Status)
	}

	return &result, nil
}
