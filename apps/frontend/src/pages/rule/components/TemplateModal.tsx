// T12-6 拆分（2026-09-12）：自 RuleSections.tsx 原样搬出，行为逐字节等价。
import { LayoutTemplate, X, Check } from 'lucide-react';
import { Button } from '../../../components';
import type { RuleViewProps } from '../types';

export function TemplateModal({
  showTemplateModal,
  closeTemplateModal,
  templates,
  handleApplyTemplate,
  applyingTemplate,
}: RuleViewProps) {
  return (
    <>
      {showTemplateModal && (
        <div className='modal-overlay' onClick={closeTemplateModal}>
          <div className='modal-content max-w-3xl' onClick={(e) => e.stopPropagation()}>
            <div className='modal-header'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center'>
                  <LayoutTemplate className='w-5 h-5 text-white' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold text-gray-800'>选择规则模板</h3>
                  <p className='text-xs text-gray-500'>应用预设的积分规则模板，快速创建常用规则</p>
                </div>
              </div>
              <button
                onClick={closeTemplateModal}
                className='p-2.5 hover:bg-gray-100 rounded-xl transition-all'
              >
                <X className='w-5 h-5 text-gray-500' />
              </button>
            </div>
            <div className='modal-body max-h-[60vh] overflow-y-auto'>
              <div className='grid gap-4'>
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className='border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:bg-primary-50/50 transition-all cursor-pointer group'
                    onClick={() => handleApplyTemplate(template.id)}
                  >
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <h4 className='font-semibold text-gray-800 group-hover:text-primary-600 transition-colors'>
                          {template.name}
                        </h4>
                        <p className='text-sm text-gray-500 mt-1'>{template.description}</p>
                        <div className='mt-3 flex flex-wrap gap-2'>
                          {template.rules.slice(0, 4).map((rule, idx) => (
                            <span
                              key={idx}
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                rule.score >= 0
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {rule.name}
                              <span className='ml-1'>
                                {rule.score >= 0 ? '+' : ''}
                                {rule.score}
                              </span>
                            </span>
                          ))}
                          {template.rules.length > 4 && (
                            <span className='inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600'>
                              +{template.rules.length - 4} 更多
                            </span>
                          )}
                        </div>
                      </div>
                      <div className='flex-shrink-0 ml-4'>
                        <Button
                          variant='primary'
                          size='sm'
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyTemplate(template.id);
                          }}
                          disabled={applyingTemplate}
                        >
                          <Check className='w-4 h-4 mr-1' />
                          {applyingTemplate ? '应用中...' : '应用'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className='modal-footer'>
              <Button variant='outline' onClick={closeTemplateModal}>
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
