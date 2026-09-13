// T12-6 拆分（2026-09-12）：自 RuleSections.tsx 原样搬出，行为逐字节等价。
import {
  Sliders,
  RefreshCw,
  Download,
  Upload,
  LayoutTemplate,
  FileJson,
  FileSpreadsheet,
  Plus,
} from 'lucide-react';
import { Button, PermissionButton } from '../../../components';
import type { RuleViewProps } from '../types';

export function HeaderActions({
  fetchRules,
  rulesLoading,
  handleDownloadTemplate,
  openImportModal,
  openTemplateModal,
  handleExport,
  handleExportFile,
  setEditingRule,
  openModal,
}: RuleViewProps) {
  return (
    <>
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-5 mb-7'>
        <div className='flex items-center gap-4'>
          <div className='w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30'>
            <Sliders className='w-6 h-6 text-white' />
          </div>
          <div>
            <h2 className='page-title'>积分规则</h2>
            <p className='page-subtitle'>管理积分规则的创建和配置</p>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <Button variant='outline' onClick={() => fetchRules()} disabled={rulesLoading}>
            <RefreshCw className={`w-4 h-4 ${rulesLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button variant='outline' onClick={handleDownloadTemplate}>
            <Download className='w-4 h-4' />
            下载模板
          </Button>
          <PermissionButton
            permission='rule.manage'
            variant='outline'
            onClick={() => openImportModal()}
          >
            <Upload className='w-4 h-4' />
            导入规则
          </PermissionButton>
          <PermissionButton
            permission='rule.manage'
            variant='outline'
            onClick={() => openTemplateModal()}
          >
            <LayoutTemplate className='w-4 h-4' />
            使用模板
          </PermissionButton>
          <Button variant='outline' onClick={handleExport}>
            <FileJson className='w-4 h-4' />
            导出JSON
          </Button>
          <Button variant='outline' onClick={() => handleExportFile('excel')}>
            <FileSpreadsheet className='w-4 h-4' />
            导出Excel
          </Button>
          <PermissionButton
            permission='rule.manage'
            onClick={() => {
              setEditingRule(null);
              openModal();
            }}
          >
            <Plus className='w-5 h-5 mr-2' />
            添加规则
          </PermissionButton>
        </div>
      </div>
    </>
  );
}
