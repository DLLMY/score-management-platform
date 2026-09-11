import type { ColumnType } from '../../components';
import type { User } from '../../types';
import type { ScoreItem } from './types';

/** toast 提示函数签名（与 ToastContext.showToast 一致） */
export type ShowToast = (
  type: 'success' | 'error' | 'warning' | 'info',
  message: string,
  options?: {
    undoAction?: () => void;
    undoLabel?: string;
    details?: string;
    errorFields?: string[];
  }
) => void;

export interface BuildScoreEntryColumnsParams {
  /** 当前展示的科目列表（受科目筛选影响） */
  visibleSubjects: string[];
  /** 学生列表（用于粘贴/键盘导航的相邻定位） */
  students: User[];
  /** 已入库成绩，key = `${studentId}-${subject}` */
  scores: Record<string, ScoreItem>;
  /** 未保存更改，key = `${studentId}-${subject}` */
  pendingChanges: Record<string, unknown>;
  /** 单元格失焦提交（含 0-100 校验） */
  handleScoreBlur: (studentId: number, subject: string, value: string) => void;
  /** 状态徽章渲染 */
  getStatusBadge: (status: string | null | undefined) => JSX.Element | null;
  /** 键盘跳格定位（data-sid/data-subject） */
  focusCell: (studentId: number, subjectName: string) => void;
  /** 全局提示 */
  showToast: ShowToast;
}

/**
 * 成绩录入表格列定义。
 *
 * 视图配置与单元格交互（onBlur 提交 / 键盘导航 / 粘贴批量填充）耦合紧密，
 * 故整体抽出为工厂函数；调用方仍以 useMemo 包裹以保持引用稳定。
 */
export function buildScoreEntryColumns({
  visibleSubjects,
  students,
  scores,
  pendingChanges,
  handleScoreBlur,
  getStatusBadge,
  focusCell,
  showToast,
}: BuildScoreEntryColumnsParams): ColumnType<User>[] {
  return [
    {
      title: '学号',
      key: 'card_id',
      dataIndex: 'card_id',
      className: 'sticky left-0 bg-white z-10',
      render: (value) => <span className='text-gray-600'>{String(value ?? '')}</span>,
    },
    {
      title: '姓名',
      key: 'name',
      dataIndex: 'name',
      className: 'sticky left-16 bg-white z-10',
      render: (value) => <span className='font-medium text-gray-900'>{String(value ?? '')}</span>,
    },
    ...visibleSubjects.map((subject) => ({
      title: subject,
      key: `subject-${subject}`,
      width: 100,
      align: 'center' as const,
      render: (_v: unknown, student: User) => {
        const key = `${student.id}-${subject}`;
        const scoreData = scores[key];
        const isPending = !!pendingChanges[key];
        return (
          <div
            className={`flex items-center justify-center gap-1.5 ${
              isPending ? 'bg-orange-50' : ''
            }`}
          >
            <input
              key={`${student.id}-${subject}-${scoreData?.id ?? 'empty'}`}
              type='number'
              min={0}
              max={100}
              step={0.5}
              placeholder='-'
              defaultValue={scoreData?.score ?? ''}
              data-sid={student.id}
              data-subject={subject}
              aria-label={`${student.name} 的 ${subject} 成绩`}
              className='w-16 px-1.5 py-0.5 text-sm text-center border border-gray-300 rounded hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
              onInput={(e) => {
                // 越界即时红框：非受控 input 直接操作 classList（key 稳定时 React 不重渲染该 input）
                const v = e.currentTarget.value.trim();
                const num = parseFloat(v);
                const invalid = v !== '' && (Number.isNaN(num) || num < 0 || num > 100);
                e.currentTarget.classList.toggle('border-red-500', invalid);
                e.currentTarget.classList.toggle('focus:ring-red-400', invalid);
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                const old = scoreData?.score ?? null;
                const num = v === '' ? null : parseFloat(v);
                if (
                  v !== '' &&
                  (Number.isNaN(num as number) || (num as number) < 0 || (num as number) > 100)
                ) {
                  showToast('error', '分数需在 0-100');
                  return;
                }
                if (num === old) return;
                handleScoreBlur(Number(student.id), subject, v);
              }}
              onKeyDown={(e) => {
                const target = e.target as HTMLInputElement;
                if (e.key === 'Escape') {
                  target.value = String(scoreData?.score ?? '');
                  target.blur();
                  return;
                }
                const subjectIdx = visibleSubjects.indexOf(subject);
                const studentIdx = students.findIndex((s) => s.id === student.id);
                if (e.key === 'Enter' || e.key === 'Tab') {
                  // 保存并跳下一格：同学生下一科目；末尾则换行到下一学生首列
                  e.preventDefault();
                  target.blur();
                  if (subjectIdx >= 0 && subjectIdx < visibleSubjects.length - 1) {
                    focusCell(Number(student.id), visibleSubjects[subjectIdx + 1]);
                  } else if (studentIdx >= 0 && studentIdx < students.length - 1) {
                    focusCell(Number(students[studentIdx + 1].id), visibleSubjects[0]);
                  }
                  return;
                }
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  // 保存并切到相邻学生同一科目
                  const nextIdx = e.key === 'ArrowDown' ? studentIdx + 1 : studentIdx - 1;
                  if (studentIdx >= 0 && nextIdx >= 0 && nextIdx < students.length) {
                    target.blur();
                    focusCell(Number(students[nextIdx].id), subject);
                  }
                  return;
                }
              }}
              onPaste={(e) => {
                // 粘贴批量填充：按行/列拆分，从当前格向右、向下填，逐格走与 onBlur 相同的 0-100 校验
                e.preventDefault();
                const text = e.clipboardData.getData('text');
                if (!text) return;
                const studentIdx = students.findIndex((s) => s.id === student.id);
                const subjectIdx = visibleSubjects.indexOf(subject);
                if (studentIdx < 0 || subjectIdx < 0) return;
                const rows = text.split(/\r?\n/);
                rows.forEach((row, rIdx) => {
                  const targetStudentIdx = studentIdx + rIdx;
                  if (targetStudentIdx >= students.length) return;
                  const values = row
                    .split(/\t|,|，/)
                    .map((v) => v.trim())
                    .filter(Boolean);
                  values.forEach((val, cIdx) => {
                    const targetSubjectIdx = subjectIdx + cIdx;
                    if (targetSubjectIdx >= visibleSubjects.length) return;
                    const num = parseFloat(val);
                    if (Number.isNaN(num) || num < 0 || num > 100) {
                      showToast('error', `粘贴值 ${val} 需在 0-100，已跳过`);
                      return;
                    }
                    handleScoreBlur(
                      Number(students[targetStudentIdx].id),
                      visibleSubjects[targetSubjectIdx],
                      val
                    );
                  });
                });
              }}
            />
            {scoreData?.status && getStatusBadge(scoreData.status)}
          </div>
        );
      },
    })),
  ];
}
