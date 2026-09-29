import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplatesPanel } from './TemplatesPanel';
import type { RemoteNotifyDeps } from './types';

// 复用 ScheduledPanel 的 PermissionButton 桩：渲染为普通 button。
vi.mock('../../components', () => ({
  PermissionButton: ({
    children,
    onClick,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

type Template = {
  id: number;
  name: string;
  category?: string;
  text?: string;
  bg_color?: string;
  text_color?: string;
  font_size?: number;
  language?: string;
};

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return { id: 1, name: '上课提醒', ...overrides };
}

function makeDeps(overrides: Record<string, unknown> = {}): RemoteNotifyDeps {
  const base = {
    form: {
      text: '默认内容',
      bg_color: '#000000',
      text_color: '#FF0000',
      font_size: 48,
      language: 'zh',
    },
    templates: [] as Template[],
    templatesLoading: false,
    editingTemplate: null,
    setEditingTemplate: vi.fn(),
    templateForm: {
      name: '',
      text: '',
      category: '',
      bg_color: '#000000',
      text_color: '#FF0000',
      font_size: 48,
      language: 'zh',
    },
    setTemplateForm: vi.fn(),
    showTemplateModal: false,
    openTemplateModal: vi.fn(),
    closeTemplateModal: vi.fn(),
    handleUseTemplate: vi.fn(),
    handleSaveTemplate: vi.fn(),
    handleDeleteTemplate: vi.fn(),
  };
  return { ...base, ...overrides } as unknown as RemoteNotifyDeps;
}

function renderPanel(deps: RemoteNotifyDeps) {
  return render(<TemplatesPanel deps={deps} />);
}

// 列表项结构：name <button> + 一个含编辑/删除按钮的 group-hover:flex 容器。
// 该容器内第 1 个 button=编辑，第 2 个=删除。
// 名称按钮文本可能含 (分类) span，故用 role+textContent 定位，避免 getByText 精确匹配失败。
function getItemButtons(templateName: string): {
  editBtn: HTMLButtonElement;
  delBtn: HTMLButtonElement;
} {
  const allButtons = screen.getAllByRole('button');
  const nameBtn = allButtons.find((b) =>
    (b.textContent || '').includes(templateName)
  ) as HTMLButtonElement;
  const item = nameBtn.parentElement as HTMLElement;
  const group = item.querySelector('.group-hover\\:flex') as HTMLElement;
  const buttons = group.querySelectorAll('button');
  return { editBtn: buttons[0] as HTMLButtonElement, delBtn: buttons[1] as HTMLButtonElement };
}

describe('TemplatesPanel 渲染与分支覆盖 B58', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('加载中显示「正在加载模板...」', () => {
    renderPanel(makeDeps({ templatesLoading: true }));
    expect(screen.getByText('正在加载模板...')).toBeInTheDocument();
  });

  it('无模板显示空态引导', () => {
    renderPanel(makeDeps({ templates: [] }));
    expect(screen.getByText('暂无模板，点击新建按钮创建')).toBeInTheDocument();
  });

  it('渲染模板列表：有/无分类两类分支', () => {
    const deps = makeDeps({
      templates: [
        makeTemplate({ id: 1, name: '上课提醒', category: '教学' }),
        makeTemplate({ id: 2, name: '放学提醒' }),
      ],
    });
    renderPanel(deps);
    expect(screen.getByText('上课提醒')).toBeInTheDocument();
    expect(screen.getByText('放学提醒')).toBeInTheDocument();
    // 有分类 -> 渲染 (教学)
    expect(screen.getByText('(教学)')).toBeInTheDocument();
  });

  it('点击模板名触发 handleUseTemplate', () => {
    const tpl = makeTemplate({ id: 5, name: '作业提醒' });
    const deps = makeDeps({ templates: [tpl] });
    renderPanel(deps);
    fireEvent.click(screen.getByText('作业提醒'));
    expect(deps.handleUseTemplate).toHaveBeenCalledWith(tpl);
  });

  it('新建按钮：setEditingTemplate(null) + setTemplateForm(取 form 默认值) + openTemplateModal', () => {
    const deps = makeDeps({
      templates: [],
      form: {
        text: 'F文本',
        bg_color: '#111111',
        text_color: '#222222',
        font_size: 36,
        language: 'en',
      },
    });
    renderPanel(deps);
    fireEvent.click(screen.getByText('新建'));
    expect(deps.setEditingTemplate).toHaveBeenCalledWith(null);
    expect(deps.openTemplateModal).toHaveBeenCalledTimes(1);
    expect(deps.setTemplateForm).toHaveBeenCalledTimes(1);
    const callArg = (deps.setTemplateForm as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.name).toBe('');
    expect(callArg.text).toBe('F文本');
    expect(callArg.bg_color).toBe('#111111');
    expect(callArg.language).toBe('en');
  });

  it('编辑按钮（字段齐全）：setEditingTemplate + setTemplateForm(原值) + openTemplateModal', () => {
    const tpl = makeTemplate({
      id: 7,
      name: '编辑用例',
      category: '行政',
      text: 'T文本',
      bg_color: '#ABCDEF',
      text_color: '#123456',
      font_size: 64,
      language: 'zh',
    });
    const deps = makeDeps({ templates: [tpl] });
    renderPanel(deps);
    const { editBtn } = getItemButtons('编辑用例');
    fireEvent.click(editBtn);
    expect(deps.setEditingTemplate).toHaveBeenCalledWith(tpl);
    expect(deps.openTemplateModal).toHaveBeenCalledTimes(1);
    const callArg = (deps.setTemplateForm as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.name).toBe('编辑用例');
    expect(callArg.category).toBe('行政');
    expect(callArg.bg_color).toBe('#ABCDEF');
    expect(callArg.font_size).toBe(64);
  });

  it('编辑按钮（字段缺失）：|| 兜底分支命中', () => {
    const tpl = makeTemplate({ id: 8, name: '缺字段' });
    const deps = makeDeps({ templates: [tpl] });
    renderPanel(deps);
    const { editBtn } = getItemButtons('缺字段');
    fireEvent.click(editBtn);
    const callArg = (deps.setTemplateForm as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.category).toBe('');
    expect(callArg.bg_color).toBe('#000000');
    expect(callArg.text_color).toBe('#FF0000');
    expect(callArg.font_size).toBe(48);
    expect(callArg.language).toBe('zh');
  });

  it('删除按钮触发 handleDeleteTemplate(id)', () => {
    const tpl = makeTemplate({ id: 9, name: '待删除' });
    const deps = makeDeps({ templates: [tpl] });
    renderPanel(deps);
    const { delBtn } = getItemButtons('待删除');
    fireEvent.click(delBtn);
    expect(deps.handleDeleteTemplate).toHaveBeenCalledWith(9);
  });

  it('showTemplateModal + editingTemplate 真值 -> 标题「编辑模板」', () => {
    const tpl = makeTemplate({ id: 3, name: '模板A' });
    renderPanel(makeDeps({ showTemplateModal: true, editingTemplate: tpl }));
    expect(screen.getByText('编辑模板')).toBeInTheDocument();
  });

  it('showTemplateModal + editingTemplate 空 -> 标题「新建模板」', () => {
    renderPanel(makeDeps({ showTemplateModal: true, editingTemplate: null }));
    expect(screen.getByText('新建模板')).toBeInTheDocument();
  });

  it('表单字段 onChange 派发 setTemplateForm（name/text/category/颜色）', () => {
    const deps = makeDeps({ showTemplateModal: true, editingTemplate: null });
    renderPanel(deps);
    fireEvent.change(screen.getByPlaceholderText('例如：上课提醒'), {
      target: { value: '新名称' },
    });
    fireEvent.change(screen.getByPlaceholderText('输入通知文本...'), {
      target: { value: '新内容' },
    });
    fireEvent.change(screen.getByPlaceholderText('选择或输入分类'), {
      target: { value: '其他' },
    });
    const colorInputs = document.querySelectorAll('input[type="color"]');
    fireEvent.change(colorInputs[0], { target: { value: '#FFFFFF' } });
    expect(deps.setTemplateForm).toHaveBeenCalledTimes(4);
  });

  it('保存按钮触发 handleSaveTemplate，取消触发 closeTemplateModal', () => {
    const deps = makeDeps({ showTemplateModal: true, editingTemplate: null });
    renderPanel(deps);
    fireEvent.click(screen.getByText('保存'));
    expect(deps.handleSaveTemplate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('取消'));
    expect(deps.closeTemplateModal).toHaveBeenCalledTimes(1);
  });
});
