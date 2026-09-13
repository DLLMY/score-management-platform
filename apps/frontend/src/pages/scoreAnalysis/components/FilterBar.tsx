// T12-2 拆分（2026-09-12）：自 ScoreAnalysisView「筛选栏」区块原样搬出，行为逐字节等价。
import { Download, RefreshCw } from 'lucide-react';
import { Card, PermissionButton } from '../../../components';
import type { ClassInfo, Exam } from '../../../services/api';

/** 筛选栏（考试/班级选择 + 刷新/导出） */
export function FilterBar({
  exams,
  selectedExam,
  setSelectedExam,
  classes,
  selectedClass,
  setSelectedClass,
  handleRefresh,
  handleExport,
  loading,
}: {
  exams: Exam[];
  selectedExam: string;
  setSelectedExam: (v: string) => void;
  classes: ClassInfo[];
  selectedClass: string;
  setSelectedClass: (v: string) => void;
  handleRefresh: () => void;
  handleExport: () => void;
  loading: boolean;
}) {
  return (
    <Card className='rounded-xl'>
      <div className='p-3 flex flex-wrap gap-3 items-center'>
        <div className='flex-1 min-w-[200px]'>
          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            className='w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white'
          >
            <option value=''>选择考试</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id.toString()}>
                {exam.name}
              </option>
            ))}
          </select>
        </div>
        <div className='w-40'>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className='w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white'
          >
            <option value=''>全部班级</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id.toString()}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
        <div className='flex gap-2'>
          <PermissionButton
            permission='algorithm.view'
            onClick={handleRefresh}
            disabled={loading}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50'
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </PermissionButton>
          <PermissionButton
            permission='report.export'
            onClick={handleExport}
            className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors'
          >
            <Download className='w-3.5 h-3.5' />
            导出报告
          </PermissionButton>
        </div>
      </div>
    </Card>
  );
}
