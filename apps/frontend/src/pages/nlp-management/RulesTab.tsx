import React from 'react';
import { Upload, Plus, Edit2, Trash2 } from 'lucide-react';
import { PermissionButton, DataTable } from '../../components';
import type { NLPDeps, Rule } from './types';

export function RulesTab({ deps }: { deps: NLPDeps }): React.ReactElement {
  const {
    setShowBatchImportModal,
    setEditingRule,
    setNewRule,
    setShowRuleForm,
    keywordFilter,
    setKeywordFilter,
    scoreTypeFilter,
    setScoreTypeFilter,
    ruleColumns,
    rules,
    rulesLoading,
    rulePage,
    setRulePage,
    ruleTotal,
    openEditModal,
    handleDeleteRule,
  } = deps;

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-xl shadow-sm p-6'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='text-lg font-semibold text-gray-800'>规则列表</h2>
          <div className='flex gap-2'>
            <PermissionButton
              permission='rule.manage'
              onClick={() => setShowBatchImportModal(true)}
              className='px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2'
            >
              <Upload className='w-4 h-4' />
              批量导入
            </PermissionButton>
            <PermissionButton
              permission='rule.manage'
              onClick={() => {
                setEditingRule(null);
                setNewRule({
                  behavior_keyword: '',
                  behavior_description: '',
                  score_value: 5,
                  score_type: 'add',
                  behavior_tags: '',
                  match_pattern: '',
                  priority: 0,
                });
                setShowRuleForm(true);
              }}
              className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2'
            >
              <Plus className='w-4 h-4' />
              添加规则
            </PermissionButton>
          </div>
        </div>

        <div className='flex gap-3 mb-4'>
          <input
            type='text'
            value={keywordFilter}
            onChange={(e) => {
              setKeywordFilter(e.target.value);
              setRulePage(1);
            }}
            placeholder='搜索关键词'
            className='px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
          />
          <select
            value={scoreTypeFilter}
            onChange={(e) => {
              setScoreTypeFilter(e.target.value);
              setRulePage(1);
            }}
            className='px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
          >
            <option value=''>全部类型</option>
            <option value='add'>加分规则</option>
            <option value='deduct'>扣分规则</option>
          </select>
        </div>

        <DataTable<Rule>
          columns={ruleColumns}
          dataSource={rules}
          loading={rulesLoading}
          rowKey='id'
          total={ruleTotal}
          page={rulePage}
          pageSize={20}
          onPageChange={(newPage) => setRulePage(newPage)}
          empty={{ icon: 'data', title: '暂无规则', description: '还没有添加任何评分规则' }}
          scroll={{ x: 900 }}
          rowActions={(rule) => (
            <div className='flex gap-2'>
              <PermissionButton
                permission='rule.manage'
                onClick={() => openEditModal(rule)}
                className='text-blue-500 hover:text-blue-700'
              >
                <Edit2 className='w-4 h-4' />
              </PermissionButton>
              <PermissionButton
                permission='rule.manage'
                onClick={() => handleDeleteRule(rule.id)}
                className='text-red-500 hover:text-red-700'
              >
                <Trash2 className='w-4 h-4' />
              </PermissionButton>
            </div>
          )}
        />
      </div>
    </div>
  );
}
