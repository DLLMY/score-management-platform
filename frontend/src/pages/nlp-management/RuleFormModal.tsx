import React from 'react';
import { X, Save } from 'lucide-react';
import type { NLPDeps } from './types';

export function RuleFormModal({ deps }: { deps: NLPDeps }): React.ReactElement {
  const {
    setShowRuleForm,
    setEditingRule,
    editingRule,
    newRule,
    setNewRule,
    handleEditRule,
    handleCreateRule,
  } = deps;

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-xl p-6 w-full max-w-lg mx-4'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold text-gray-800'>
            {editingRule ? '编辑规则' : '添加规则'}
          </h3>
          <button
            onClick={() => {
              setShowRuleForm(false);
              setEditingRule(null);
            }}
            className='text-gray-400 hover:text-gray-600'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>行为关键词 *</label>
            <input
              type='text'
              value={newRule.behavior_keyword}
              onChange={(e) => setNewRule({ ...newRule, behavior_keyword: e.target.value })}
              className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>行为描述</label>
            <textarea
              value={newRule.behavior_description}
              onChange={(e) => setNewRule({ ...newRule, behavior_description: e.target.value })}
              rows={2}
              className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>分数值 *</label>
              <input
                type='number'
                value={newRule.score_value}
                onChange={(e) =>
                  setNewRule({ ...newRule, score_value: parseFloat(e.target.value) || 0 })
                }
                className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>评分类型 *</label>
              <select
                value={newRule.score_type}
                onChange={(e) => setNewRule({ ...newRule, score_type: e.target.value })}
                className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
              >
                <option value='add'>加分</option>
                <option value='deduct'>扣分</option>
              </select>
            </div>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>行为标签</label>
            <input
              type='text'
              value={newRule.behavior_tags}
              onChange={(e) => setNewRule({ ...newRule, behavior_tags: e.target.value })}
              placeholder='多个标签用逗号分隔'
              className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>匹配模式</label>
              <input
                type='text'
                value={newRule.match_pattern}
                onChange={(e) => setNewRule({ ...newRule, match_pattern: e.target.value })}
                className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>优先级</label>
              <input
                type='number'
                value={newRule.priority}
                onChange={(e) =>
                  setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })
                }
                className='w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
              />
            </div>
          </div>
        </div>

        <div className='flex gap-3 mt-6'>
          <button
            onClick={() => {
              setShowRuleForm(false);
              setEditingRule(null);
            }}
            className='flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50'
          >
            取消
          </button>
          <button
            onClick={editingRule ? handleEditRule : handleCreateRule}
            className='flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center gap-2'
          >
            <Save className='w-4 h-4' />
            {editingRule ? '保存修改' : '创建规则'}
          </button>
        </div>
      </div>
    </div>
  );
}
