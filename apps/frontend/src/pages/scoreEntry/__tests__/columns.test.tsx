import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { buildScoreEntryColumns } from '../columns';
import type { BuildScoreEntryColumnsParams, ShowToast } from '../columns';
import type { User } from '../../../types';
import type { ScoreItem } from '../types';

const makeUser = (id: number, name: string, card_id = `2021${String(id).padStart(4, '0')}`): User =>
  ({
    id,
    name,
    card_id,
    role: 'student',
  } as unknown as User);

const makeScore = (score: number | null, status?: string): ScoreItem =>
  ({ id: 5, score, status } as unknown as ScoreItem);

const makeParams = (
  over: Partial<BuildScoreEntryColumnsParams> = {}
): BuildScoreEntryColumnsParams => {
  const handleScoreBlur = vi.fn();
  const focusCell = vi.fn();
  const showToast = vi.fn() as unknown as ShowToast;
  const getStatusBadge = vi.fn(() => null);
  return {
    visibleSubjects: ['数学', '英语'],
    students: [makeUser(1, '张三'), makeUser(2, '李四')],
    scores: {},
    pendingChanges: {},
    handleScoreBlur,
    getStatusBadge,
    focusCell,
    showToast,
    ...over,
  };
};

describe('buildScoreEntryColumns 结构', () => {
  beforeEach(() => cleanup());

  it('返回 2 个静态列 + 每个可见科目一个列', () => {
    const cols = buildScoreEntryColumns(makeParams());
    expect(cols).toHaveLength(4); // 学号 + 姓名 + 数学 + 英语
  });

  it('前两列是学号/姓名且 dataIndex 正确', () => {
    const cols = buildScoreEntryColumns(makeParams());
    expect(cols[0].title).toBe('学号');
    expect(cols[0].dataIndex).toBe('card_id');
    expect(cols[1].title).toBe('姓名');
    expect(cols[1].dataIndex).toBe('name');
  });

  it('科目列含 title/key/width/align', () => {
    const cols = buildScoreEntryColumns(makeParams({ visibleSubjects: ['数学', '英语'] }));
    const math = cols[2];
    expect(math.title).toBe('数学');
    expect(math.key).toBe('subject-数学');
    expect(math.width).toBe(100);
    expect(math.align).toBe('center');
  });

  it('visibleSubjects 为空时仅 2 个静态列（不崩溃）', () => {
    const cols = buildScoreEntryColumns(makeParams({ visibleSubjects: [] }));
    expect(cols).toHaveLength(2);
  });
});

describe('buildScoreEntryColumns 静态列 render', () => {
  beforeEach(() => cleanup());

  it('学号列渲染 String(value)', () => {
    const cols = buildScoreEntryColumns(makeParams());
    render(<>{cols[0].render!('20210001', makeUser(1, '张三'), 0)}</>);
    expect(screen.getByText('20210001')).toBeTruthy();
  });

  it('姓名列对 undefined 回退为空串', () => {
    const cols = buildScoreEntryColumns(makeParams());
    const { container } = render(<>{cols[1].render!(undefined, makeUser(1, '张三'), 0)}</>);
    expect(container.querySelector('span')?.textContent).toBe('');
  });
});

describe('buildScoreEntryColumns 科目列 render 交互', () => {
  beforeEach(() => cleanup());

  const getSubjectCol = (params: BuildScoreEntryColumnsParams, colIndex = 2) => {
    const cols = buildScoreEntryColumns(params);
    return cols[colIndex]; // 默认数学列
  };

  const renderSubjectCell = (
    params: BuildScoreEntryColumnsParams,
    studentIndex = 0,
    colIndex = 2
  ) => {
    const col = getSubjectCol(params, colIndex);
    const student = params.students[studentIndex];
    const node = col.render
      ? (col.render as unknown as (v: unknown, s: User) => JSX.Element)(undefined, student)
      : null;
    const utils = render(<>{node}</>);
    const input = utils.container.querySelector('input') as HTMLInputElement;
    return { ...utils, input };
  };

  it('渲染 input 且 aria-label 含学生名与科目', () => {
    const params = makeParams();
    const { input } = renderSubjectCell(params);
    expect(input).toBeTruthy();
    expect(input.getAttribute('aria-label')).toBe('张三 的 数学 成绩');
    expect(input.getAttribute('data-sid')).toBe('1');
    expect(input.getAttribute('data-subject')).toBe('数学');
  });

  it('scoreData 存在时 input defaultValue 为该成绩', () => {
    const params = makeParams({ scores: { '1-数学': makeScore(95) } });
    const { input } = renderSubjectCell(params);
    expect(input.defaultValue).toBe('95');
  });

  it('pendingChanges 命中时外层 div 带 bg-orange-50', () => {
    const params = makeParams({ pendingChanges: { '1-数学': { value: '95' } } });
    const col = getSubjectCol(params);
    const node = (col.render as unknown as (v: unknown, s: User) => JSX.Element)(
      undefined,
      params.students[0]
    );
    const { container } = render(<>{node}</>);
    expect((container.firstChild as HTMLElement).className).toContain('bg-orange-50');
  });

  it('onBlur 有效值调用 handleScoreBlur(value)', () => {
    const params = makeParams();
    const { input } = renderSubjectCell(params);
    input.value = '95';
    fireEvent.blur(input);
    expect(params.handleScoreBlur).toHaveBeenCalledTimes(1);
    expect(params.handleScoreBlur).toHaveBeenCalledWith(1, '数学', '95');
  });

  it('onBlur 空值（原无成绩）不调用 handleScoreBlur', () => {
    const params = makeParams();
    const { input } = renderSubjectCell(params);
    input.value = '';
    fireEvent.blur(input);
    expect(params.handleScoreBlur).not.toHaveBeenCalled();
  });

  it('onBlur 清空已有成绩调用 handleScoreBlur("")', () => {
    const params = makeParams({ scores: { '1-数学': makeScore(95) } });
    const { input } = renderSubjectCell(params);
    input.value = '';
    fireEvent.blur(input);
    expect(params.handleScoreBlur).toHaveBeenCalledWith(1, '数学', '');
  });

  it('onBlur 与旧值相同不重复调用', () => {
    const params = makeParams({ scores: { '1-数学': makeScore(95) } });
    const { input } = renderSubjectCell(params);
    input.value = '95';
    fireEvent.blur(input);
    expect(params.handleScoreBlur).not.toHaveBeenCalled();
  });

  it('onBlur 越界(>100)报错且不调用 handleScoreBlur', () => {
    const params = makeParams();
    const { input } = renderSubjectCell(params);
    input.value = '150';
    fireEvent.blur(input);
    expect(params.showToast).toHaveBeenCalledWith('error', '分数需在 0-100');
    expect(params.handleScoreBlur).not.toHaveBeenCalled();
  });

  it('onBlur 非数字报错且不调用 handleScoreBlur', () => {
    const params = makeParams();
    const { input } = renderSubjectCell(params);
    // type=number 的 input 会把非数字值清洗为空串，故用 defineProperty 直接置值绕过 setter
    Object.defineProperty(input, 'value', { configurable: true, value: 'abc' });
    fireEvent.blur(input);
    expect(params.showToast).toHaveBeenCalledWith('error', '分数需在 0-100');
    expect(params.handleScoreBlur).not.toHaveBeenCalled();
  });

  it('onInput 越界值给 input 加 border-red-500', () => {
    const params = makeParams();
    const { input } = renderSubjectCell(params);
    fireEvent.input(input, { target: { value: '150' } });
    expect(input.classList.contains('border-red-500')).toBe(true);
  });

  it('onInput 合法值移除 border-red-500', () => {
    const params = makeParams();
    const { input } = renderSubjectCell(params);
    input.classList.add('border-red-500');
    fireEvent.input(input, { target: { value: '95' } });
    expect(input.classList.contains('border-red-500')).toBe(false);
  });

  it('onKeyDown Escape 重置为旧成绩并失焦', () => {
    const params = makeParams({ scores: { '1-数学': makeScore(95) } });
    const { input } = renderSubjectCell(params);
    input.value = '9999';
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.value).toBe('95');
  });

  it('onKeyDown Enter 跳到下一科目', () => {
    const params = makeParams({ visibleSubjects: ['数学', '英语'] });
    const { input } = renderSubjectCell(params);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(params.focusCell).toHaveBeenCalledWith(1, '英语');
  });

  it('onKeyDown Tab 末列跳到下一学生首列', () => {
    const params = makeParams({ visibleSubjects: ['数学', '英语'] });
    const { input } = renderSubjectCell(params, 0, 3); // 英语列（末列）
    input.value = '95';
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(params.focusCell).toHaveBeenCalledWith(params.students[1].id, '数学');
  });

  it('onKeyDown ArrowDown 切到下一学生同科目', () => {
    const params = makeParams();
    const { input } = renderSubjectCell(params);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(params.focusCell).toHaveBeenCalledWith(params.students[1].id, '数学');
  });

  it('onKeyDown ArrowUp 首学生不越界（不调用 focusCell）', () => {
    const params = makeParams();
    const { input } = renderSubjectCell(params);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(params.focusCell).not.toHaveBeenCalled();
  });

  it('onPaste 批量填充多格（全部合法）', () => {
    const params = makeParams({
      visibleSubjects: ['数学', '英语'],
      students: [makeUser(1, '张三'), makeUser(2, '李四')],
    });
    const { input } = renderSubjectCell(params);
    fireEvent.paste(input, {
      clipboardData: { getData: () => '90\t80\n70\t60' },
    } as unknown as EventInit);
    expect(params.handleScoreBlur).toHaveBeenCalledTimes(4);
    expect(params.handleScoreBlur).toHaveBeenCalledWith(1, '数学', '90');
    expect(params.handleScoreBlur).toHaveBeenCalledWith(1, '英语', '80');
    expect(params.handleScoreBlur).toHaveBeenCalledWith(2, '数学', '70');
    expect(params.handleScoreBlur).toHaveBeenCalledWith(2, '英语', '60');
  });

  it('onPaste 越界值跳过并 toast 报错', () => {
    const params = makeParams();
    const { input } = renderSubjectCell(params);
    fireEvent.paste(input, {
      clipboardData: { getData: () => '999' },
    } as unknown as EventInit);
    expect(params.showToast).toHaveBeenCalledWith('error', expect.stringContaining('999'));
    expect(params.handleScoreBlur).not.toHaveBeenCalled();
  });

  it('scoreData.status 存在时调用 getStatusBadge', () => {
    const params = makeParams({ scores: { '1-数学': makeScore(95, 'pending') } });
    const col = getSubjectCol(params);
    const node = (col.render as unknown as (v: unknown, s: User) => JSX.Element)(
      undefined,
      params.students[0]
    );
    render(<>{node}</>);
    expect(params.getStatusBadge).toHaveBeenCalledWith('pending');
  });
});
