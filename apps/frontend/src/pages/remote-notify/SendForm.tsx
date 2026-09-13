// 远程通知 - 右侧「发送表单」（广播/指定设备/测试/积分变化 四模式）
// 模式切换（ModeSelector）与发送前预览确认弹窗（PreviewConfirmModal）已外提为独立组件
import {
  Send,
  Bell,
  Volume2,
  VolumeX,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Palette,
} from 'lucide-react';
import { PermissionButton, ClassStatusBadge } from '../../components';
import { PRESET_COLORS, PRESET_TEXT_COLORS, type RemoteNotifyDeps } from './types';
import { ModeSelector } from './ModeSelector';
import { PreviewConfirmModal } from './PreviewConfirmModal';

export function SendForm({ deps }: { deps: RemoteNotifyDeps }) {
  const {
    mode,
    setMode,
    isSending,
    lastResult,
    form,
    setForm,
    scoreForm,
    setScoreForm,
    forceSend,
    setForceSend,
    previewConfirm,
    setPreviewConfirm,
    classNow,
    handleSubmit,
    handleReset,
    performSend,
  } = deps;

  return (
    <div className='lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200/50 dark:border-slate-700/50 p-6'>
      <ModeSelector mode={mode} setMode={setMode} />

      <div className='space-y-5'>
        {mode === 'device' && (
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
              设备ID
            </label>
            <input
              type='text'
              value={form.device_id}
              onChange={(e) => setForm((prev) => ({ ...prev, device_id: e.target.value }))}
              placeholder='输入电脑客户端ID（启动时显示）'
              className='w-full px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all'
            />
          </div>
        )}

        {mode !== 'test' && mode !== 'score_change' && (
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
              通知内容
            </label>
            <textarea
              value={form.text}
              onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
              placeholder='输入要发送的通知文本...'
              rows={4}
              className='w-full px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all resize-none'
            />
          </div>
        )}

        {mode === 'score_change' && (
          <div className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                  学生姓名 *
                </label>
                <input
                  type='text'
                  value={scoreForm.student_name}
                  onChange={(e) =>
                    setScoreForm((prev) => ({ ...prev, student_name: e.target.value }))
                  }
                  placeholder='输入学生姓名'
                  className='w-full px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                  积分变化 *
                </label>
                <div className='flex items-center gap-2'>
                  <button
                    onClick={() =>
                      setScoreForm((prev) => ({
                        ...prev,
                        score_change: Math.max(-100, prev.score_change - 1),
                      }))
                    }
                    className='px-3 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 hover:bg-gray-100 dark:hover:bg-slate-600/50 transition-all'
                  >
                    -
                  </button>
                  <input
                    type='number'
                    value={scoreForm.score_change}
                    onChange={(e) =>
                      setScoreForm((prev) => ({
                        ...prev,
                        score_change: parseInt(e.target.value) || 0,
                      }))
                    }
                    placeholder='0'
                    className='flex-1 px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all text-center'
                  />
                  <button
                    onClick={() =>
                      setScoreForm((prev) => ({
                        ...prev,
                        score_change: Math.min(100, prev.score_change + 1),
                      }))
                    }
                    className='px-3 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 hover:bg-gray-100 dark:hover:bg-slate-600/50 transition-all'
                  >
                    +
                  </button>
                </div>
                <div className='flex gap-2 mt-2'>
                  <button
                    onClick={() => setScoreForm((prev) => ({ ...prev, score_change: 5 }))}
                    className='px-3 py-1 rounded-lg text-xs bg-green-100 dark:bg-green-500/20 text-green-600 hover:bg-green-200 dark:hover:bg-green-500/30 transition-all'
                  >
                    +5
                  </button>
                  <button
                    onClick={() => setScoreForm((prev) => ({ ...prev, score_change: 10 }))}
                    className='px-3 py-1 rounded-lg text-xs bg-green-100 dark:bg-green-500/20 text-green-600 hover:bg-green-200 dark:hover:bg-green-500/30 transition-all'
                  >
                    +10
                  </button>
                  <button
                    onClick={() => setScoreForm((prev) => ({ ...prev, score_change: -5 }))}
                    className='px-3 py-1 rounded-lg text-xs bg-red-100 dark:bg-red-500/20 text-red-600 hover:bg-red-200 dark:hover:bg-red-500/30 transition-all'
                  >
                    -5
                  </button>
                  <button
                    onClick={() => setScoreForm((prev) => ({ ...prev, score_change: -10 }))}
                    className='px-3 py-1 rounded-lg text-xs bg-red-100 dark:bg-red-500/20 text-red-600 hover:bg-red-200 dark:hover:bg-red-500/30 transition-all'
                  >
                    -10
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                变动原因 *
              </label>
              <input
                type='text'
                value={scoreForm.reason}
                onChange={(e) => setScoreForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder='输入积分变动原因（如：课堂表现优秀）'
                className='w-full px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all'
              />
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                  课程名称
                </label>
                <input
                  type='text'
                  value={scoreForm.course}
                  onChange={(e) => setScoreForm((prev) => ({ ...prev, course: e.target.value }))}
                  placeholder='输入课程名称（可选）'
                  className='w-full px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                  指定设备
                </label>
                <input
                  type='text'
                  value={scoreForm.device_id}
                  onChange={(e) => setScoreForm((prev) => ({ ...prev, device_id: e.target.value }))}
                  placeholder='设备ID（不填则广播）'
                  className='w-full px-4 py-3 rounded-xl border border-gray-200/80 dark:border-slate-600/80 bg-white dark:bg-slate-700/50 text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all'
                />
              </div>
            </div>
          </div>
        )}

        {/* 样式设置 */}
        {mode !== 'test' && mode !== 'score_change' && (
          <div className='grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-700/30'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-1'>
                <Palette className='w-4 h-4' />
                背景颜色
              </label>
              <div className='flex items-center gap-2 mb-2'>
                <input
                  type='color'
                  value={form.bg_color}
                  onChange={(e) => setForm((prev) => ({ ...prev, bg_color: e.target.value }))}
                  className='w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200 dark:border-slate-600'
                />
                <input
                  type='text'
                  value={form.bg_color}
                  onChange={(e) => setForm((prev) => ({ ...prev, bg_color: e.target.value }))}
                  className='flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-sm font-mono'
                />
              </div>
              <div className='flex flex-wrap gap-2'>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setForm((prev) => ({ ...prev, bg_color: color.value }))}
                    className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                      form.bg_color === color.value
                        ? 'border-primary-500 ring-2 ring-primary-500/30'
                        : 'border-gray-200 dark:border-slate-600'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 flex items-center gap-1'>
                <Palette className='w-4 h-4' />
                文字颜色
              </label>
              <div className='flex items-center gap-2 mb-2'>
                <input
                  type='color'
                  value={form.text_color}
                  onChange={(e) => setForm((prev) => ({ ...prev, text_color: e.target.value }))}
                  className='w-12 h-12 rounded-lg cursor-pointer border-2 border-gray-200 dark:border-slate-600'
                />
                <input
                  type='text'
                  value={form.text_color}
                  onChange={(e) => setForm((prev) => ({ ...prev, text_color: e.target.value }))}
                  className='flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-sm font-mono'
                />
              </div>
              <div className='flex flex-wrap gap-2'>
                {PRESET_TEXT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setForm((prev) => ({ ...prev, text_color: color.value }))}
                    className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                      form.text_color === color.value
                        ? 'border-primary-500 ring-2 ring-primary-500/30'
                        : 'border-gray-200 dark:border-slate-600'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {mode !== 'score_change' && (
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                <div className='flex items-center gap-2'>
                  {form.speak ? (
                    <Volume2 className='w-4 h-4 text-primary-500' />
                  ) : (
                    <VolumeX className='w-4 h-4 text-gray-400' />
                  )}
                  语音播报
                </div>
              </label>
              <div className='flex items-center gap-3'>
                <label className='relative inline-flex items-center cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={form.speak}
                    onChange={(e) => setForm((prev) => ({ ...prev, speak: e.target.checked }))}
                    className='sr-only peer'
                  />
                  <div className='w-11 h-6 bg-gray-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500' />
                </label>
                {form.speak && (
                  <div className='flex-1'>
                    <div className='flex items-center justify-between text-sm text-gray-500 dark:text-slate-400 mb-1'>
                      <span>音量</span>
                      <span>{Math.round(form.volume * 100)}%</span>
                    </div>
                    <input
                      type='range'
                      min='0'
                      max='1'
                      step='0.1'
                      value={form.volume}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, volume: parseFloat(e.target.value) }))
                      }
                      className='w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-primary-500'
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
                <div className='flex items-center gap-2'>
                  <Bell className='w-4 h-4 text-primary-500' />
                  弹窗显示
                </div>
              </label>
              <div className='flex items-center gap-3'>
                <label className='relative inline-flex items-center cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={form.popup}
                    onChange={(e) => setForm((prev) => ({ ...prev, popup: e.target.checked }))}
                    className='sr-only peer'
                  />
                  <div className='w-11 h-6 bg-gray-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500' />
                </label>
                {form.popup && (
                  <div className='flex-1'>
                    <div className='flex items-center justify-between text-sm text-gray-500 dark:text-slate-400 mb-1'>
                      <span>自动关闭</span>
                      <span>{form.timeout_sec}秒</span>
                    </div>
                    <input
                      type='range'
                      min='3'
                      max='30'
                      step='1'
                      value={form.timeout_sec}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, timeout_sec: parseInt(e.target.value) }))
                      }
                      className='w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-primary-500'
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {mode !== 'score_change' && (
          <div>
            <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2'>
              <div className='flex items-center gap-2'>
                <AlertTriangle className='w-4 h-4 text-red-500' />
                紧急通知
              </div>
            </label>
            <div className='flex items-center gap-3'>
              <label className='relative inline-flex items-center cursor-pointer'>
                <input
                  type='checkbox'
                  checked={form.urgent}
                  onChange={(e) => setForm((prev) => ({ ...prev, urgent: e.target.checked }))}
                  className='sr-only peer'
                />
                <div className='w-11 h-6 bg-gray-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-red-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[""] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500' />
              </label>
              <span className='text-sm text-gray-500 dark:text-slate-400'>
                {form.urgent ? '红色全屏弹窗，高优先级' : '普通通知样式'}
              </span>
            </div>
          </div>
        )}

        {/* 预览效果 */}
        {mode !== 'test' && mode !== 'score_change' && form.popup && (
          <div
            className='p-4 rounded-xl border-2 border-gray-200 dark:border-slate-600 text-center'
            style={{
              backgroundColor: form.bg_color,
              color: form.text_color,
              fontSize: `${Math.min(form.font_size, 24)}px`,
            }}
          >
            {form.text || '预览效果'}
          </div>
        )}

        {lastResult && (
          <div
            className={`p-4 rounded-xl border ${
              lastResult.success
                ? 'bg-green-50/80 dark:bg-green-500/10 border-green-200/80 dark:border-green-500/30'
                : 'bg-red-50/80 dark:bg-red-500/10 border-red-200/80 dark:border-red-500/30'
            }`}
          >
            <div className='flex items-center gap-3'>
              {lastResult.success ? (
                <CheckCircle className='w-5 h-5 text-green-600' />
              ) : (
                <AlertTriangle className='w-5 h-5 text-red-600' />
              )}
              <div>
                <p
                  className={`font-medium ${
                    lastResult.success ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {lastResult.success ? '发送成功' : '发送失败'}
                </p>
                <p className='text-sm text-gray-600 dark:text-slate-400 mt-1'>
                  {lastResult.message}
                </p>
                {lastResult.topic && (
                  <p className='text-xs text-gray-500 dark:text-slate-500 mt-1'>
                    主题: {lastResult.topic}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <ClassStatusBadge state={classNow} forceSend={forceSend} onForceSendChange={setForceSend} />

        <div className='flex gap-3 pt-2'>
          <PermissionButton
            permission='notification.send'
            onClick={handleSubmit}
            disabled={isSending}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
              isSending
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40'
            }`}
          >
            {isSending ? (
              <Loader2 className='w-5 h-5 animate-spin' />
            ) : (
              <Send className='w-5 h-5' />
            )}
            {isSending ? '发送中...' : '发送通知'}
          </PermissionButton>
          <button
            onClick={handleReset}
            className='px-6 py-3 rounded-xl font-medium bg-gray-100/80 dark:bg-slate-700/50 text-gray-600 dark:text-slate-300 hover:bg-gray-200/60 dark:hover:bg-slate-600/50 transition-all duration-200'
          >
            重置
          </button>
        </div>
      </div>

      {/* M6: 发送前预览确认弹窗（防误发；preview 失败时不含名单仍可发送） */}
      {previewConfirm?.open && (
        <PreviewConfirmModal
          previewConfirm={previewConfirm}
          isSending={isSending}
          setPreviewConfirm={setPreviewConfirm}
          performSend={performSend}
        />
      )}
    </div>
  );
}
