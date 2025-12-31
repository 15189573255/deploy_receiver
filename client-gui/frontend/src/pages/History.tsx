import { useState, useEffect } from 'react';
import { History as HistoryIcon, Trash2, Check, X, RefreshCw, ArrowRight } from 'lucide-react';
import { GetHistory, ClearHistory } from '../../wailsjs/go/main/App';

interface HistoryEntry {
  id: number;
  serverId: string;
  serverName: string;
  pathKey: string;
  filename: string;
  fileSize: number;
  status: string;
  errorMsg: string;
  uploadedAt: string;
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const list = await GetHistory(100);
      setEntries(list || []);
    } catch (err) {
      console.error('加载历史失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!confirm('确定要清空所有历史记录吗？')) return;
    try {
      await ClearHistory();
      setEntries([]);
    } catch (err) {
      console.error('清空失败:', err);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const successCount = entries.filter(e => e.status === 'success').length;
  const failedCount = entries.filter(e => e.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">上传历史</h1>
          {entries.length > 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              共 {entries.length} 条记录 ·
              <span className="text-emerald-600 dark:text-emerald-400"> {successCount} 成功</span> ·
              <span className="text-red-600 dark:text-red-400"> {failedCount} 失败</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadHistory}
            className="p-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw size={18} />
          </button>
          {entries.length > 0 && (
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={16} />
              清空
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-zinc-400" size={32} />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">加载中...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <HistoryIcon size={32} className="text-zinc-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无上传记录</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {entries.map(entry => (
              <div
                key={entry.id}
                className="flex items-center gap-4 px-6 py-4"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  entry.status === 'success'
                    ? 'bg-emerald-100 dark:bg-emerald-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {entry.status === 'success' ? (
                    <Check className="text-emerald-600 dark:text-emerald-400" size={16} />
                  ) : (
                    <X className="text-red-600 dark:text-red-400" size={16} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{entry.filename}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatSize(entry.fileSize)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{entry.serverName}</span>
                    <ArrowRight size={12} />
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{entry.pathKey}</span>
                  </div>
                  {entry.status === 'failed' && entry.errorMsg && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1 truncate">{entry.errorMsg}</p>
                  )}
                </div>

                <div className="text-right text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                  {formatDate(entry.uploadedAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
