// 远程通知 - 左侧「我的模板」卡片 + 模板编辑弹窗
import { Bookmark, Plus, Edit2, Trash2 } from 'lucide-react';
import { PermissionButton } from '../../components';
import { type RemoteNotifyDeps } from './types';

export function TemplatesPanel({ deps }: { deps: RemoteNotifyDeps }) {
  const {
    form,
    templates,
    templatesLoading,
    editingTemplate,
    setEditingTemplate,
    templateForm,
    setTemplateForm,
    showTemplateModal,
    openTemplateModal,
    closeTemplateModal,
    handleUseTemplate,
    handleSaveTemplate,
    handleDeleteTemplate,
  } = deps;

  return (
    <>
      <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-gray-200/50 dark:border-slate-700/50 p-4'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2'>
            <Bookmark className='w-5 h-5 text-primary-500' />
            我的模板
          </h3>
          <PermissionButton
            permission='notification.send'
            onClick={() => {
              setEditingTemplate(null);
              setTemplateForm({
                name: '',
                text: form.text,
                category: '',
                bg_color: form.bg_color,
                text_color: form.text_color,
                font_size: form.font_size,
                language: form.language,
              });
              openTemplateModal();
            }}
            className='flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-100 dark:bg-primary-500/20 text-primary-600 text-sm hover:bg-primary-200 dark:hover:bg-primary-500/30'
          >
            <Plus className='w-4 h-4' />
            新建
          </PermissionButton>
        </div>
        {templatesLoading ? (
          <p className='text-sm text-gray-400 dark:text-slate-500 text-center py-4 animate-pulse'>
            正在加载模板...
          </p>
        ) : templates.length === 0 ? (
          <p className='text-sm text-gray-500 dark:text-slate-400 text-center py-4'>
            暂无模板，点击新建按钮创建
          </p>
        ) : (
          <div className='space-y-2 max-h-60 overflow-y-auto'>
            {templates.map((template) => (
              <div
                key={template.id}
                className='flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-slate-700/50 group'
              >
                <button
                  onClick={() => handleUseTemplate(template)}
                  className='flex-1 text-left text-sm text-gray-700 dark:text-slate-300 hover:text-primary-600 truncate'
                >
                  {template.name}
                  {template.category && (
                    <span className='ml-2 text-xs text-gray-500'>({template.category})</span>
                  )}
                </button>
                <div className='hidden group-hover:flex items-center gap-1'>
                  <PermissionButton
                    permission='notification.send'
                    onClick={() => {
                      setEditingTemplate(template);
                      setTemplateForm({
                        name: template.name,
                        text: template.text,
                        category: template.category || '',
                        bg_color: template.bg_color || '#000000',
                        text_color: template.text_color || '#FF0000',
                        font_size: template.font_size || 48,
                        language: template.language || 'zh',
                      });
                      openTemplateModal();
                    }}
                    className='p-1 rounded text-gray-500 hover:text-primary-600'
                  >
                    <Edit2 className='w-4 h-4' />
                  </PermissionButton>
                  <PermissionButton
                    permission='notification.send'
                    onClick={() => handleDeleteTemplate(template.id)}
                    className='p-1 rounded text-gray-500 hover:text-red-600'
                  >
                    <Trash2 className='w-4 h-4' />
                  </PermissionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 模板编辑弹窗 */}
      {showTemplateModal && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          {' '}
          {/* L6: 移动端留边 */}
          <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-auto'>
            <h3 className='text-lg font-semibold text-gray-800 dark:text-white mb-4'>
              {editingTemplate ? '编辑模板' : '新建模板'}
            </h3>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>
                  模板名称
                </label>
                <input
                  type='text'
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder='例如：上课提醒'
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>
                  通知内容
                </label>
                <textarea
                  value={templateForm.text}
                  onChange={(e) => setTemplateForm((prev) => ({ ...prev, text: e.target.value }))}
                  placeholder='输入通知文本...'
                  rows={3}
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600 resize-none'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>
                  分类
                </label>
                <input
                  type='text'
                  list='notify-template-categories'
                  value={templateForm.category}
                  onChange={(e) =>
                    setTemplateForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                  placeholder='选择或输入分类'
                  className='w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-600'
                />
                <datalist id='notify-template-categories'>
                  <option value='教学' />
                  <option value='行政' />
                  <option value='紧急' />
                  <option value='活动' />
                  <option value='其他' />
                </datalist>
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>
                    背景颜色
                  </label>
                  <input
                    type='color'
                    value={templateForm.bg_color}
                    onChange={(e) =>
                      setTemplateForm((prev) => ({ ...prev, bg_color: e.target.value }))
                    }
                    className='w-full h-10 rounded cursor-pointer'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'>
                    文字颜色
                  </label>
                  <input
                    type='color'
                    value={templateForm.text_color}
                    onChange={(e) =>
                      setTemplateForm((prev) => ({ ...prev, text_color: e.target.value }))
                    }
                    className='w-full h-10 rounded cursor-pointer'
                  />
                </div>
              </div>
            </div>
            <div className='flex gap-3 mt-6'>
              <button
                onClick={handleSaveTemplate}
                className='flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600'
              >
                保存
              </button>
              <button
                onClick={closeTemplateModal}
                className='px-4 py-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
