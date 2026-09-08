import React, { useEffect, useState } from 'react';
import { X, ThumbsUp, ThumbsDown, AlertTriangle, Brain, Save } from 'lucide-react';
import { PermissionButton } from '../../components';
import api from '../../services/api';
import type { NLPDeps } from './types';

export function CorrectionModal({ deps }: { deps: NLPDeps }): React.ReactElement {
  const {
    setShowCorrectionModal,
    inputText,
    manualCorrection,
    setManualCorrection,
    handleRecordFeedback,
    isSubmittingFeedback,
    handleManualExecute,
  } = deps;

  // #912 手动修正接管学生：弹窗内加载全量活跃学生，下拉选择真实学生覆盖 NLP 误识
  const [students, setStudents] = useState<Array<{ id: number; name: string; class_name?: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    api.users
      .getAll({ per_page: 200, skipCache: true } as never)
      .then((res: unknown) => {
        if (cancelled) return;
        const list = (res as { data?: unknown[] })?.data || (res as { items?: unknown[] })?.items || (res as unknown[]) || [];
        const arr = (Array.isArray(list) ? list : []).map((u) => {
          const o = u as { id: number; name: string; class_name?: string };
          return { id: o.id, name: o.name, class_name: o.class_name };
        });
        setStudents(arr);
      })
      .catch(() => setStudents([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedStudent = students.find((s) => s.id === manualCorrection.user_id);

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-xl p-6 w-full max-w-md mx-4'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold text-gray-800'>手动修正</h3>
          <button
            onClick={() => setShowCorrectionModal(false)}
            className='text-gray-400 hover:text-gray-600'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='space-y-4'>
          <div>
            <p className='text-sm text-gray-500 mb-2'>原输入文本</p>
            <p className='p-3 bg-gray-50 rounded-lg text-gray-700'>{inputText}</p>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              学生 <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              list='manual-correction-students'
              value={
                selectedStudent
                  ? `${selectedStudent.name}（${selectedStudent.class_name || ''}）`
                  : manualCorrection.corrected_name || ''
              }
              onChange={(e) => {
                const v = e.target.value;
                // 允许自由输入（按名兜底）；若匹配下拉项则写入 user_id
                const m = students.find((s) => `${s.name}（${s.class_name || ''}）` === v || s.name === v);
                setManualCorrection({
                  ...manualCorrection,
                  user_id: m?.id,
                  corrected_name: m?.name || v,
                });
              }}
              placeholder='从下拉选择或输入学生姓名'
              className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
            />
            <datalist id='manual-correction-students'>
              {students.map((s) => (
                <option key={s.id} value={`${s.name}（${s.class_name || ''}）`} />
              ))}
            </datalist>
            {selectedStudent && (
              <p className='mt-1 text-xs text-gray-500'>
                已选：{selectedStudent.name}
                {selectedStudent.class_name ? ` · ${selectedStudent.class_name}` : ''}（id={selectedStudent.id}）
              </p>
            )}
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>评分意图</label>
            <div className='flex gap-2'>
              {[
                { value: 'add', label: '加分', icon: ThumbsUp },
                { value: 'deduct', label: '扣分', icon: ThumbsDown },
                { value: 'other', label: '其他', icon: AlertTriangle },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    onClick={() =>
                      setManualCorrection({ ...manualCorrection, intent: option.value })
                    }
                    className={`flex-1 px-4 py-2 rounded-lg border flex items-center justify-center gap-2 transition-colors ${
                      manualCorrection.intent === option.value
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className='w-4 h-4' />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>分数值</label>
            <input
              type='number'
              value={manualCorrection.score_value}
              onChange={(e) =>
                setManualCorrection({
                  ...manualCorrection,
                  score_value: parseFloat(e.target.value) || 0,
                })
              }
              className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>行为标签</label>
            <input
              type='text'
              value={manualCorrection.behavior_tags.join(',')}
              onChange={(e) =>
                setManualCorrection({
                  ...manualCorrection,
                  behavior_tags: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              placeholder='多个标签用逗号分隔'
              className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>行为描述</label>
            <textarea
              value={manualCorrection.behavior_description}
              onChange={(e) =>
                setManualCorrection({
                  ...manualCorrection,
                  behavior_description: e.target.value,
                })
              }
              placeholder='描述学生行为'
              rows={3}
              className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>反馈备注</label>
            <textarea
              value={manualCorrection.feedback_note}
              onChange={(e) =>
                setManualCorrection({ ...manualCorrection, feedback_note: e.target.value })
              }
              placeholder='可选：添加反馈备注'
              rows={2}
              className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
            />
          </div>
        </div>

        <div className='flex gap-3 mt-6'>
          <button
            onClick={() => setShowCorrectionModal(false)}
            className='px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50'
          >
            取消
          </button>
          <PermissionButton
            permission='score.entry'
            onClick={handleRecordFeedback}
            disabled={isSubmittingFeedback}
            className='px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center justify-center gap-2 disabled:opacity-50'
          >
            <Brain className='w-4 h-4' />
            {isSubmittingFeedback ? '反馈中...' : '反馈并学习'}
          </PermissionButton>
          <PermissionButton
            permission='score.entry'
            onClick={handleManualExecute}
            className='flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2'
          >
            <Save className='w-4 h-4' />
            保存并执行
          </PermissionButton>
        </div>
      </div>
    </div>
  );
}
