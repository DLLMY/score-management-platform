import React from 'react';
import { Brain, Check, Trash2 } from 'lucide-react';
import { DataTable } from '../../components';
import type { NLPDeps, NlpCorrection } from './types';

export function CorrectionsList({ deps }: { deps: NLPDeps }): React.ReactElement {
  const {
    correctionStatusFilter,
    setCorrectionStatusFilter,
    setCorrectionsPage,
    fetchCorrections,
    correctionColumns,
    corrections,
    correctionsLoading,
    correctionsPage,
    correctionTotal,
    handleUpdateCorrection,
    handleDeleteCorrection,
  } = deps;

  return (
    <div className='bg-white rounded-xl shadow-sm p-6'>
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-lg font-semibold text-gray-800 flex items-center gap-2'>
          <Brain className='w-5 h-5 text-purple-500' />
          纠正记录（自学习）
        </h3>
        <select
          value={correctionStatusFilter}
          onChange={(e) => {
            setCorrectionStatusFilter(e.target.value);
            setCorrectionsPage(1);
            fetchCorrections(1);
          }}
          className='px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500'
        >
          <option value=''>全部状态</option>
          <option value='pending'>待验证</option>
          <option value='verified'>已验证</option>
          <option value='learned'>已学习</option>
          <option value='rejected'>已拒绝</option>
        </select>
      </div>

      <DataTable<NlpCorrection>
        columns={correctionColumns}
        dataSource={corrections}
        loading={correctionsLoading}
        rowKey='id'
        total={correctionTotal}
        page={correctionsPage}
        pageSize={20}
        onPageChange={(newPage) => {
          setCorrectionsPage(newPage);
          fetchCorrections(newPage);
        }}
        empty={{ icon: 'data', title: '暂无纠正记录', description: '暂无自学习纠正记录' }}
        scroll={{ x: 900 }}
        rowActions={(correction) => (
          <div className='flex gap-2'>
            {correction.status === 'pending' && (
              <button
                onClick={() => handleUpdateCorrection(correction.id, 'verified')}
                className='text-green-500 hover:text-green-700'
                title='验证'
              >
                <Check className='w-4 h-4' />
              </button>
            )}
            {correction.status === 'verified' && (
              <button
                onClick={() => handleUpdateCorrection(correction.id, 'learned')}
                className='text-purple-500 hover:text-purple-700'
                title='标记已学习'
              >
                <Brain className='w-4 h-4' />
              </button>
            )}
            <button
              onClick={() => handleDeleteCorrection(correction.id)}
              className='text-red-500 hover:text-red-700'
              title='删除'
            >
              <Trash2 className='w-4 h-4' />
            </button>
          </div>
        )}
      />
    </div>
  );
}
