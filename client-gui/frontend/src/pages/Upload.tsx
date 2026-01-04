import { useState, useEffect, useCallback } from 'react';
import { Upload as UploadIcon, File, Folder, X, Check, AlertCircle } from 'lucide-react';
import { GetServers, SelectFile, SelectFolder, UploadFile, GetFileInfo } from '../../wailsjs/go/main/App';
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';

interface Server {
  id: string;
  name: string;
  url: string;
  paths: string[];
  isDefault: boolean;
}

interface UploadTask {
  id: string;
  filePath: string;
  filename: string;
  size: number;
  isDir: boolean;
  fileCount?: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export default function UploadPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [pathKey, setPathKey] = useState<string>('');
  const [extract, setExtract] = useState(false);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadServers();

    EventsOn('upload:progress', (data: any) => {
      setTasks(prev => prev.map(t =>
        t.filename === data.filename && t.status === 'uploading'
          ? { ...t, progress: data.percent }
          : t
      ));
    });

    return () => {
      EventsOff('upload:progress');
    };
  }, []);

  const loadServers = async () => {
    try {
      const list = await GetServers();
      setServers(list || []);
      const defaultServer = list?.find((s: Server) => s.isDefault);
      if (defaultServer) {
        setSelectedServer(defaultServer.id);
        if (defaultServer.paths?.length > 0) {
          setPathKey(defaultServer.paths[0]);
        }
      }
    } catch (err) {
      console.error('加载服务器失败:', err);
    }
  };

  const handleSelectFile = async () => {
    try {
      const path = await SelectFile();
      if (path) {
        addFileToQueue(path);
      }
    } catch (err) {
      console.error('选择文件失败:', err);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const path = await SelectFolder();
      if (path) {
        addFileToQueue(path);
      }
    } catch (err) {
      console.error('选择文件夹失败:', err);
    }
  };

  const addFileToQueue = async (filePath: string) => {
    try {
      const info = await GetFileInfo(filePath);
      const task: UploadTask = {
        id: `task_${Date.now()}`,
        filePath,
        filename: info.name as string,
        size: info.size as number,
        isDir: info.isDir as boolean,
        fileCount: info.fileCount as number | undefined,
        status: 'pending',
        progress: 0,
      };
      setTasks(prev => [...prev, task]);
    } catch (err) {
      console.error('获取文件信息失败:', err);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const startUpload = async () => {
    if (!selectedServer || !pathKey) {
      alert('请先选择服务器和路径');
      return;
    }

    const pendingTasks = tasks.filter(t => t.status === 'pending');

    for (const task of pendingTasks) {
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: 'uploading' } : t
      ));

      try {
        const result = await UploadFile(selectedServer, pathKey, task.filePath, extract);
        setTasks(prev => prev.map(t =>
          t.id === task.id
            ? { ...t, status: result.success ? 'success' : 'error', progress: 100, error: result.error }
            : t
        ));
      } catch (err: any) {
        setTasks(prev => prev.map(t =>
          t.id === task.id
            ? { ...t, status: 'error', error: err.message || '上传失败' }
            : t
        ));
      }
    }
  };

  const currentServer = servers.find(s => s.id === selectedServer);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  };

  return (
    <div className="space-y-6">
      {/* 拖拽区域 */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all ${
          isDragging
            ? 'border-zinc-900 dark:border-white bg-zinc-100 dark:bg-zinc-800'
            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
        }`}
      >
        <UploadIcon className="mx-auto mb-4 text-zinc-400 dark:text-zinc-500" size={48} />
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">拖拽文件到这里上传</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={handleSelectFile}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors shadow-sm"
          >
            <File size={16} />
            选择文件
          </button>
          <button
            onClick={handleSelectFolder}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Folder size={16} />
            选择文件夹
          </button>
        </div>
      </div>

      {/* 配置区域 */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-white mb-4">上传配置</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">服务器</label>
            <select
              value={selectedServer}
              onChange={e => {
                setSelectedServer(e.target.value);
                const server = servers.find(s => s.id === e.target.value);
                if (server?.paths?.length) {
                  setPathKey(server.paths[0]);
                }
              }}
              className="w-full h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
            >
              <option value="">选择服务器</option>
              {servers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">路径标识</label>
            <select
              value={pathKey}
              onChange={e => setPathKey(e.target.value)}
              className="w-full h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
            >
              <option value="">选择路径</option>
              {currentServer?.paths?.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={extract}
                onChange={e => setExtract(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white focus:ring-zinc-900 dark:focus:ring-white"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">自动解压 ZIP</span>
            </label>
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      {tasks.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-900 dark:text-white">
              上传队列 <span className="text-zinc-500 dark:text-zinc-400">({tasks.length})</span>
            </h2>
            <button
              onClick={startUpload}
              disabled={!tasks.some(t => t.status === 'pending')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              开始上传
            </button>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {tasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-4 px-6 py-4"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  {task.isDir ? (
                    <Folder size={20} className="text-amber-500 dark:text-amber-400" />
                  ) : (
                    <File size={20} className="text-zinc-500 dark:text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                      {task.filename}
                      {task.isDir && task.fileCount !== undefined && (
                        <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                          ({task.fileCount} 个文件)
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0 ml-2">
                      {formatSize(task.size)}
                    </span>
                  </div>
                  {task.status === 'uploading' && (
                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
                      <div
                        className="bg-zinc-900 dark:bg-white h-1.5 rounded-full transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}
                  {task.status === 'error' && (
                    <p className="text-sm text-red-600 dark:text-red-400 truncate">{task.error}</p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {task.status === 'pending' && (
                    <button
                      onClick={() => removeTask(task.id)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      <X size={18} />
                    </button>
                  )}
                  {task.status === 'uploading' && (
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">{task.progress.toFixed(0)}%</span>
                  )}
                  {task.status === 'success' && (
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Check className="text-emerald-600 dark:text-emerald-400" size={14} />
                    </div>
                  )}
                  {task.status === 'error' && (
                    <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <AlertCircle className="text-red-600 dark:text-red-400" size={14} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {servers.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
          <p className="text-sm text-amber-800 dark:text-amber-200">尚未配置服务器</p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">请先在「服务器」页面添加服务器配置</p>
        </div>
      )}
    </div>
  );
}
