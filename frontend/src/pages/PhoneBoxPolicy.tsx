import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Clock, Save, Zap, XCircle, Smartphone, AlertCircle } from 'lucide-react';
import api, { PhoneBoxPolicy as PhoneBoxPolicyType, UnlockWindow } from '../services/api';
import { Button, Card, Input, Select, Switch, Badge } from '../components';
import { PermissionGuard } from '../components/PermissionGuard';
import { useStableToast } from '../hooks/useStableToast';
import { usePermissions } from '../hooks/usePermissions';

const weekDays = [
  { value: '-1', label: '每天' },
  { value: '0', label: '周一' },
  { value: '1', label: '周二' },
  { value: '2', label: '周三' },
  { value: '3', label: '周四' },
  { value: '4', label: '周五' },
  { value: '5', label: '周六' },
  { value: '6', label: '周日' },
];

const formatTime = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

const emptyWindow = (): UnlockWindow => ({
  day: -1,
  start_hour: 12,
  start_minute: 0,
  end_hour: 12,
  end_minute: 20,
});

const PhoneBoxPolicyInner: React.FC = () => {
  const { showToast } = useStableToast();
  const { roles } = usePermissions();
  const isAdmin = roles.some((r) => ['admin', 'super_admin'].includes(r));

  const [policy, setPolicy] = useState<PhoneBoxPolicyType | null>(null);
  const [loading, setLoading] = useState(true);
  const [classInfoId, setClassInfoId] = useState<number | undefined>(undefined);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);

  const [allowSelfUnlock, setAllowSelfUnlock] = useState(true);
  const [windows, setWindows] = useState<UnlockWindow[]>([]);
  const [minutes, setMinutes] = useState<number>(15);
  const [saving, setSaving] = useState(false);
  const [overriding, setOverriding] = useState(false);
  // 无法定位班级时（管理员未选班 / 班主任未绑班）展示空状态，而不是给一个点了就报错的表单
  const [loadError, setLoadError] = useState<string | null>(null);

  // admin / super_admin 需要选择班级；班主任（teacher）由后端解析自己班级
  useEffect(() => {
    if (isAdmin) {
      api.classes
        .getAll({ page_size: 200 })
        .then((res) => setClasses((res.classes || []).map((c) => ({ id: c.id, name: c.name }))))
        .catch(() => setClasses([]));
    }
  }, [isAdmin]);

  const loadPolicy = useCallback(() => {
    // 管理员必须先选班级，直接跳过请求避免无谓 403
    if (isAdmin && !classInfoId) {
      setPolicy(null);
      setLoadError('请先在上方选择要管理的班级');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    api.phoneBoxPolicy
      .get(classInfoId)
      .then((data) => {
        setPolicy(data);
        setAllowSelfUnlock(data.allow_self_unlock);
        setWindows(data.unlock_windows || []);
      })
      .catch((err) => {
        // 班主任未绑定班级时后端返回 403，用空状态提示替代错误弹窗
        setLoadError(err?.message || '加载策略失败');
      })
      .finally(() => setLoading(false));
  }, [classInfoId, isAdmin]);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  const handleSaveBase = async () => {
    setSaving(true);
    try {
      const data = await api.phoneBoxPolicy.update(
        { allow_self_unlock: allowSelfUnlock, unlock_windows: windows },
        classInfoId,
      );
      setPolicy(data);
      showToast('策略已保存', 'success');
    } catch (err) {
      showToast(err?.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOverride = async () => {
    if (!minutes || minutes <= 0) {
      showToast('请输入有效的放行分钟数', 'error');
      return;
    }
    setOverriding(true);
    try {
      const data = await api.phoneBoxPolicy.override(minutes, classInfoId);
      setPolicy(data);
      showToast(`已允许本班开箱 ${minutes} 分钟`, 'success');
    } catch (err) {
      showToast(err?.message || '一键放行失败', 'error');
    } finally {
      setOverriding(false);
    }
  };

  const handleCancelOverride = async () => {
    try {
      const data = await api.phoneBoxPolicy.cancelOverride(classInfoId);
      setPolicy(data);
      showToast('已取消临时放行', 'success');
    } catch (err) {
      showToast(err?.message || '取消失败', 'error');
    }
  };

  const updateWindow = (idx: number, patch: Partial<UnlockWindow>) => {
    setWindows((ws) => ws.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  };

  const parseTime = (value: string): { h: number; m: number } => {
    const [h, m] = (value || '00:00').split(':').map((x) => parseInt(x, 10) || 0);
    return { h, m };
  };

  return (
    <div className='p-6 max-w-4xl mx-auto space-y-6'>
      <div className='flex items-center gap-3'>
        <Smartphone className='w-7 h-7 text-primary-600' />
        <div>
          <h1 className='text-2xl font-bold text-gray-800 dark:text-slate-100'>手机箱开箱策略</h1>
          <p className='text-sm text-gray-500 dark:text-slate-400'>
            由班主任自由决定本班手机箱自助开箱：总开关、预设时段与一键临时放行（含上课期间）。
          </p>
        </div>
      </div>

      {isAdmin && (
        <Card className='p-4'>
          <label className='block text-sm font-medium text-gray-700 dark:text-slate-200 mb-2'>
            管理班级
          </label>
          <Select
            value={classInfoId !== undefined ? String(classInfoId) : ''}
            onChange={(v) => setClassInfoId(v ? parseInt(v, 10) : undefined)}
            className='max-w-xs'
          >
            <option value=''>请选择班级</option>
            {classes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </Select>
        </Card>
      )}

      {loading ? (
        <Card className='p-8 text-center text-gray-400'>加载中…</Card>
      ) : loadError ? (
        <Card className='p-8'>
          <div className='flex flex-col items-center gap-2 text-center'>
            <AlertCircle className='w-8 h-8 text-amber-500' />
            <p className='text-gray-700 dark:text-slate-200'>{loadError}</p>
            <p className='text-sm text-gray-400'>
              若你是班主任但看到此提示，请联系管理员为你的账号绑定班级。
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* 一键放行 */}
          <Card className='p-5'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center gap-2'>
                <Zap className='w-5 h-5 text-amber-500' />
                <h2 className='text-lg font-semibold text-gray-800 dark:text-slate-100'>一键临时放行</h2>
              </div>
              {policy?.override_active ? (
                <Badge variant='success'>放行中（至 {policy.override_until?.slice(11, 16)}）</Badge>
              ) : (
                <Badge variant='default'>未放行</Badge>
              )}
            </div>
            <p className='text-sm text-gray-500 dark:text-slate-400 mb-4'>
              临时允许本班学生在指定时长内自助开箱（即使处于上课时间也会放行）。到点后自动恢复原有策略。
            </p>
            <div className='flex items-end gap-3 flex-wrap'>
              <div>
                <label className='block text-xs text-gray-500 mb-1'>放行时长（分钟）</label>
                <Input
                  type='number'
                  min={1}
                  value={minutes}
                  onChange={(v) => setMinutes(parseInt(v, 10) || 0)}
                  className='w-32'
                />
              </div>
              <Button variant='primary' onClick={handleOverride} disabled={overriding}>
                <Zap className='w-4 h-4 mr-1' /> 立即允许本班开箱
              </Button>
              {policy?.override_active && (
                <Button variant='outline' onClick={handleCancelOverride}>
                  <XCircle className='w-4 h-4 mr-1' /> 取消放行
                </Button>
              )}
            </div>
          </Card>

          {/* 总开关 */}
          <Card className='p-5'>
            <div className='flex items-center justify-between'>
              <div>
                <h2 className='text-lg font-semibold text-gray-800 dark:text-slate-100'>自助开箱总开关</h2>
                <p className='text-sm text-gray-500 dark:text-slate-400 mt-1'>
                  关闭后本班学生任何时段都无法自助开箱（管理员远程开锁不受影响）。
                </p>
              </div>
              <Switch checked={allowSelfUnlock} onChange={setAllowSelfUnlock} />
            </div>
          </Card>

          {/* 预设时段 */}
          <Card className='p-5'>
            <div className='flex items-center justify-between mb-3'>
              <div className='flex items-center gap-2'>
                <Clock className='w-5 h-5 text-primary-600' />
                <h2 className='text-lg font-semibold text-gray-800 dark:text-slate-100'>预设允许时段</h2>
              </div>
              <Button variant='outline' onClick={() => setWindows((ws) => [...ws, emptyWindow()])}>
                <Plus className='w-4 h-4 mr-1' /> 添加时段
              </Button>
            </div>
            <p className='text-sm text-gray-500 dark:text-slate-400 mb-4'>
              在以下时段内，本班学生可自助开箱；其余时段将按全校上课规则与课表判定。
            </p>

            {windows.length === 0 ? (
              <div className='flex items-center gap-2 text-sm text-gray-400 py-4'>
                <AlertCircle className='w-4 h-4' /> 尚未设置预设时段
              </div>
            ) : (
              <div className='space-y-3'>
                {windows.map((w, idx) => (
                  <div key={idx} className='flex items-center gap-3 flex-wrap bg-gray-50 dark:bg-slate-800 rounded-lg p-3'>
                    <Select
                      value={String(w.day)}
                      onChange={(v) => updateWindow(idx, { day: parseInt(v, 10) })}
                      className='w-28'
                    >
                      {weekDays.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </Select>
                    <input
                      type='time'
                      className='px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200'
                      value={formatTime(w.start_hour, w.start_minute)}
                      onChange={(e) => {
                        const { h, m } = parseTime(e.target.value);
                        updateWindow(idx, { start_hour: h, start_minute: m });
                      }}
                    />
                    <span className='text-gray-400'>至</span>
                    <input
                      type='time'
                      className='px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200'
                      value={formatTime(w.end_hour, w.end_minute)}
                      onChange={(e) => {
                        const { h, m } = parseTime(e.target.value);
                        updateWindow(idx, { end_hour: h, end_minute: m });
                      }}
                    />
                    <Button variant='ghost' onClick={() => setWindows((ws) => ws.filter((_, i) => i !== idx))}>
                      <Trash2 className='w-4 h-4 text-red-500' />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className='mt-4'>
              <Button variant='primary' onClick={handleSaveBase} disabled={saving}>
                <Save className='w-4 h-4 mr-1' /> 保存总开关与时段
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

const PhoneBoxPolicy: React.FC = () => (
  <PermissionGuard requiredPermission='phonebox.unlock.manage'>
    <PhoneBoxPolicyInner />
  </PermissionGuard>
);

export default PhoneBoxPolicy;
