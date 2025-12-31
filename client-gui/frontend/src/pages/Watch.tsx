import { useState, useEffect } from 'react';
import { Eye, Plus, Trash2, Folder, Play, Pause, Check, X, Info, ArrowRight } from 'lucide-react';
import { GetWatches, SaveWatch, DeleteWatch, GetServers, SelectFolder } from '../../wailsjs/go/main/App';

interface WatchConfig {
  id: string;
  folderPath: string;
  serverId: string;
  pathKey: string;
  patterns: string[];
  debounceMs: number;
  enabled: boolean;
}

interface Server {
  id: string;
  name: string;
  paths: string[];
}

export default function WatchPage() {
  const [watches, setWatches] = useState<WatchConfig[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    folderPath: '',
    serverId: '',
    pathKey: '',
    patterns: '',
    debounceMs: 1000,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [watchList, serverList] = await Promise.all([
        GetWatches(),
        GetServers(),
      ]);
      setWatches(watchList || []);
      setServers(serverList || []);
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const path = await SelectFolder();
      if (path) {
        setForm({ ...form, folderPath: path });
      }
    } catch (err) {
      console.error('选择文件夹失败:', err);
    }
  };

  const handleSave = async () => {
    if (!form.folderPath || !form.serverId || !form.pathKey) {
      alert('请填写完整信息');
      return;
    }

    try {
      await SaveWatch({
        id: '',
        folderPath: form.folderPath,
        serverId: form.serverId,
        pathKey: form.pathKey,
        patterns: form.patterns.split(',').map(p => p.trim()).filter(Boolean),
        debounceMs: form.debounceMs,
        enabled: true,
      });
      setIsAdding(false);
      setForm({ folderPath: '', serverId: '', pathKey: '', patterns: '', debounceMs: 1000 });
      loadData();
    } catch (err) {
      console.error('保存失败:', err);
      alert('保存失败: ' + err);
    }
  };

  const handleToggle = async (watch: WatchConfig) => {
    try {
      await SaveWatch({ ...watch, enabled: !watch.enabled });
      loadData();
    } catch (err) {
      console.error('切换状态失败:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个监控配置吗？')) return;
    try {
      await DeleteWatch(id);
      loadData();
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const currentServer = servers.find(s => s.id === form.serverId);

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">文件夹监控</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">监控文件夹变化并自动上传</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors shadow-sm"
          >
            <Plus size={16} />
            添加监控
          </button>
        )}
      </div>

      {/* 添加表单 */}
      {isAdding && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-white mb-4">添加监控配置</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">监控文件夹</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.folderPath}
                  onChange={e => setForm({ ...form, folderPath: e.target.value })}
                  placeholder="选择要监控的文件夹"
                  className="flex-1 h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
                  readOnly
                />
                <button
                  onClick={handleSelectFolder}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Folder size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">目标服务器</label>
                <select
                  value={form.serverId}
                  onChange={e => {
                    setForm({ ...form, serverId: e.target.value, pathKey: '' });
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
                  value={form.pathKey}
                  onChange={e => setForm({ ...form, pathKey: e.target.value })}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
                >
                  <option value="">选择路径</option>
                  {currentServer?.paths?.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">文件过滤 (可选)</label>
                <input
                  type="text"
                  value={form.patterns}
                  onChange={e => setForm({ ...form, patterns: e.target.value })}
                  placeholder="例如: *.js, *.css"
                  className="w-full h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">防抖时间 (毫秒)</label>
                <input
                  type="number"
                  value={form.debounceMs}
                  onChange={e => setForm({ ...form, debounceMs: parseInt(e.target.value) || 1000 })}
                  className="w-full h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
              >
                <Check size={16} />
                保存
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setForm({ folderPath: '', serverId: '', pathKey: '', patterns: '', debounceMs: 1000 });
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X size={16} />
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 监控列表 */}
      <div className="space-y-3">
        {watches.map(watch => {
          const server = servers.find(s => s.id === watch.serverId);
          return (
            <div
              key={watch.id}
              className={`bg-white dark:bg-zinc-900 rounded-xl border p-5 transition-colors ${
                watch.enabled
                  ? 'border-emerald-300 dark:border-emerald-700'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye size={16} className={watch.enabled ? 'text-emerald-500' : 'text-zinc-400 dark:text-zinc-500'} />
                    <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{watch.folderPath}</span>
                    {watch.enabled && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                        监控中
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                      {server?.name || watch.serverId}
                    </span>
                    <ArrowRight size={12} />
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{watch.pathKey}</span>
                    {watch.patterns?.length > 0 && (
                      <>
                        <span className="mx-1">·</span>
                        <span>{watch.patterns.join(', ')}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleToggle(watch)}
                    className={`p-2 rounded-lg transition-colors ${
                      watch.enabled
                        ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                        : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    title={watch.enabled ? '暂停' : '启动'}
                  >
                    {watch.enabled ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    onClick={() => handleDelete(watch.id)}
                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {watches.length === 0 && !isAdding && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Eye size={32} className="text-zinc-400 dark:text-zinc-500" />
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无监控配置</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">点击上方按钮添加文件夹监控</p>
          </div>
        )}
      </div>

      {/* 说明 */}
      <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-xl p-5">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-sky-800 dark:text-sky-200 mb-2">功能说明</h3>
            <ul className="text-sm text-sky-700 dark:text-sky-300 space-y-1">
              <li>监控指定文件夹，当文件发生变化时自动上传到服务器</li>
              <li>防抖时间用于避免频繁上传，建议设置 1000ms 以上</li>
              <li>文件过滤支持通配符模式，如 *.js 表示只监控 JS 文件</li>
              <li>注意：此功能需要应用保持运行状态</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
