import { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Play, Pause, File, Check, X, Info, ArrowRight } from 'lucide-react';
import { GetSchedules, SaveSchedule, DeleteSchedule, GetServers, SelectFile } from '../../wailsjs/go/main/App';

interface Schedule {
  id: string;
  name: string;
  cronExpr: string;
  filePath: string;
  serverId: string;
  pathKey: string;
  extract: boolean;
  enabled: boolean;
}

interface Server {
  id: string;
  name: string;
  paths: string[];
}

const cronPresets = [
  { label: '每分钟', value: '* * * * *' },
  { label: '每小时', value: '0 * * * *' },
  { label: '每天 0:00', value: '0 0 * * *' },
  { label: '每天 8:00', value: '0 8 * * *' },
  { label: '每周一 9:00', value: '0 9 * * 1' },
  { label: '每月 1 号 0:00', value: '0 0 1 * *' },
];

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    cronExpr: '0 8 * * *',
    filePath: '',
    serverId: '',
    pathKey: '',
    extract: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [scheduleList, serverList] = await Promise.all([
        GetSchedules(),
        GetServers(),
      ]);
      setSchedules(scheduleList || []);
      setServers(serverList || []);
    } catch (err) {
      console.error('加载数据失败:', err);
    }
  };

  const handleSelectFile = async () => {
    try {
      const path = await SelectFile();
      if (path) {
        setForm({ ...form, filePath: path });
      }
    } catch (err) {
      console.error('选择文件失败:', err);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.cronExpr || !form.filePath || !form.serverId || !form.pathKey) {
      alert('请填写完整信息');
      return;
    }

    try {
      await SaveSchedule({
        id: '',
        name: form.name,
        cronExpr: form.cronExpr,
        filePath: form.filePath,
        serverId: form.serverId,
        pathKey: form.pathKey,
        extract: form.extract,
        enabled: true,
      });
      setIsAdding(false);
      setForm({ name: '', cronExpr: '0 8 * * *', filePath: '', serverId: '', pathKey: '', extract: false });
      loadData();
    } catch (err) {
      console.error('保存失败:', err);
      alert('保存失败: ' + err);
    }
  };

  const handleToggle = async (schedule: Schedule) => {
    try {
      await SaveSchedule({ ...schedule, enabled: !schedule.enabled });
      loadData();
    } catch (err) {
      console.error('切换状态失败:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个定时任务吗？')) return;
    try {
      await DeleteSchedule(id);
      loadData();
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const currentServer = servers.find(s => s.id === form.serverId);

  const describeCron = (cron: string) => {
    const preset = cronPresets.find(p => p.value === cron);
    if (preset) return preset.label;
    return cron;
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">定时任务</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">按计划自动上传文件</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors shadow-sm"
          >
            <Plus size={16} />
            添加任务
          </button>
        )}
      </div>

      {/* 添加表单 */}
      {isAdding && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h2 className="text-sm font-medium text-zinc-900 dark:text-white mb-4">添加定时任务</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">任务名称</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="例如：每日备份"
                className="w-full h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">执行时间 (Cron 表达式)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.cronExpr}
                  onChange={e => setForm({ ...form, cronExpr: e.target.value })}
                  placeholder="0 8 * * *"
                  className="flex-1 h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
                />
                <select
                  onChange={e => setForm({ ...form, cronExpr: e.target.value })}
                  className="h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
                >
                  <option value="">快速选择</option>
                  {cronPresets.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">格式: 分 时 日 月 周</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">上传文件</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={form.filePath}
                  onChange={e => setForm({ ...form, filePath: e.target.value })}
                  placeholder="选择要上传的文件"
                  className="flex-1 h-10 px-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent"
                  readOnly
                />
                <button
                  onClick={handleSelectFile}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <File size={18} />
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

            <div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.extract}
                  onChange={e => setForm({ ...form, extract: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-white focus:ring-zinc-900 dark:focus:ring-white"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">自动解压 ZIP 文件</span>
              </label>
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
                  setForm({ name: '', cronExpr: '0 8 * * *', filePath: '', serverId: '', pathKey: '', extract: false });
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

      {/* 任务列表 */}
      <div className="space-y-3">
        {schedules.map(schedule => {
          const server = servers.find(s => s.id === schedule.serverId);
          return (
            <div
              key={schedule.id}
              className={`bg-white dark:bg-zinc-900 rounded-xl border p-5 transition-colors ${
                schedule.enabled
                  ? 'border-violet-300 dark:border-violet-700'
                  : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={16} className={schedule.enabled ? 'text-violet-500' : 'text-zinc-400 dark:text-zinc-500'} />
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">{schedule.name}</span>
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                      {describeCron(schedule.cronExpr)}
                    </span>
                    {schedule.enabled && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400">
                        启用
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="truncate max-w-[200px]">{schedule.filePath.split(/[\\/]/).pop()}</span>
                    <ArrowRight size={12} />
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                      {server?.name || schedule.serverId}
                    </span>
                    <ArrowRight size={12} />
                    <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">{schedule.pathKey}</span>
                    {schedule.extract && (
                      <span className="text-emerald-600 dark:text-emerald-400">(解压)</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleToggle(schedule)}
                    className={`p-2 rounded-lg transition-colors ${
                      schedule.enabled
                        ? 'text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                        : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                    title={schedule.enabled ? '禁用' : '启用'}
                  >
                    {schedule.enabled ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    onClick={() => handleDelete(schedule.id)}
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

        {schedules.length === 0 && !isAdding && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <Clock size={32} className="text-zinc-400 dark:text-zinc-500" />
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无定时任务</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">点击上方按钮添加定时任务</p>
          </div>
        )}
      </div>

      {/* Cron 说明 */}
      <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-5">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-violet-800 dark:text-violet-200 mb-3">Cron 表达式说明</h3>
            <div className="grid grid-cols-5 gap-4 mb-3">
              <div className="text-center">
                <div className="text-lg font-mono text-violet-600 dark:text-violet-400">*</div>
                <div className="text-xs text-violet-600 dark:text-violet-400">分钟</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-mono text-violet-600 dark:text-violet-400">*</div>
                <div className="text-xs text-violet-600 dark:text-violet-400">小时</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-mono text-violet-600 dark:text-violet-400">*</div>
                <div className="text-xs text-violet-600 dark:text-violet-400">日期</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-mono text-violet-600 dark:text-violet-400">*</div>
                <div className="text-xs text-violet-600 dark:text-violet-400">月份</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-mono text-violet-600 dark:text-violet-400">*</div>
                <div className="text-xs text-violet-600 dark:text-violet-400">星期</div>
              </div>
            </div>
            <p className="text-xs text-violet-700 dark:text-violet-300">
              注意：此功能需要应用保持运行状态才能执行定时任务
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
