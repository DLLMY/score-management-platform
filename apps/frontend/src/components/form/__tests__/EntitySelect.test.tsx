import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * EntitySelect 含模块级 listCache + 对 services/api 的依赖。
 * 每个用例通过 vi.resetModules + vi.doMock 注入独立的 api mock，规避跨用例缓存串扰，
 * 同时用动态 import 取得全新模块实例（listCache 重置为空）。
 */
const loadEntitySelect = async (apiMock: Record<string, unknown>) => {
  vi.resetModules();
  vi.doMock('../../../services/api', () => ({ default: apiMock }));
  return (await import('../EntitySelect')) as typeof import('../EntitySelect');
};

const baseApi = () => ({
  classes: { getAll: vi.fn() },
  users: { getAll: vi.fn() },
  subjects: { getAll: vi.fn() },
});

describe('EntitySelect', () => {
  it('ClassSelect 渲染班级选项并触发 onChange(id) + onChangeValue(name)', async () => {
    const api = baseApi();
    api.classes.getAll.mockResolvedValue({ classes: [{ id: 1, name: '一班' }] });
    const { ClassSelect } = await loadEntitySelect(api);
    const onChange = vi.fn();
    const onChangeValue = vi.fn();
    const { container } = render(
      <ClassSelect value={null} onChange={onChange} onChangeValue={onChangeValue} />
    );
    await waitFor(() => expect(screen.getByText('一班')).toBeInTheDocument());
    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith(1);
    expect(onChangeValue).toHaveBeenCalledWith('一班');
  });

  it('列表为空且 !allowEmpty → 渲染"暂无班级"占位', async () => {
    const api = baseApi();
    api.classes.getAll.mockResolvedValue({ classes: [] });
    const { ClassSelect } = await loadEntitySelect(api);
    render(<ClassSelect value={null} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('暂无班级')).toBeInTheDocument());
  });

  it('StudentSelect 选项含 class_name 后缀（姓名（班级））', async () => {
    const api = baseApi();
    api.users.getAll.mockResolvedValue({ users: [{ id: 2, name: '张三', class_name: '高一(1)' }] });
    const { StudentSelect } = await loadEntitySelect(api);
    render(<StudentSelect value={null} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('张三（高一(1)）')).toBeInTheDocument());
  });

  it('SubjectSelect allowEmpty → 含"请选择科目"空选项并渲染科目', async () => {
    const api = baseApi();
    api.subjects.getAll.mockResolvedValue([{ id: 3, name: '数学' }]);
    const { SubjectSelect } = await loadEntitySelect(api);
    render(<SubjectSelect value={null} onChange={vi.fn()} allowEmpty />);
    await waitFor(() => expect(screen.getByText('请选择科目')).toBeInTheDocument());
    expect(screen.getByText('数学')).toBeInTheDocument();
  });

  it('api 请求失败（catch）→ 选项为空，渲染"暂无班级"占位', async () => {
    const api = baseApi();
    api.classes.getAll.mockRejectedValue(new Error('network'));
    const { ClassSelect } = await loadEntitySelect(api);
    render(<ClassSelect value={null} onChange={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('暂无班级')).toBeInTheDocument());
  });

  it('选项就绪后 value 为空且 !allowEmpty → 自动默认第一项（onChange(firstId)）', async () => {
    const api = baseApi();
    api.classes.getAll.mockResolvedValue({ classes: [{ id: 7, name: '七班' }] });
    const { ClassSelect } = await loadEntitySelect(api);
    const onChange = vi.fn();
    render(<ClassSelect value={null} onChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(7));
  });

  it('disabled 透传 → select 元素 disabled', async () => {
    const api = baseApi();
    api.classes.getAll.mockResolvedValue({ classes: [{ id: 1, name: '一班' }] });
    const { ClassSelect } = await loadEntitySelect(api);
    const { container } = render(<ClassSelect value={null} onChange={vi.fn()} disabled />);
    await waitFor(() => expect(screen.getByText('一班')).toBeInTheDocument());
    expect(container.querySelector('select') as HTMLSelectElement).toBeDisabled();
  });
});
