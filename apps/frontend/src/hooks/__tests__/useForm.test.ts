import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useForm } from '../useForm';

interface FormShape {
  name: string;
  age: number;
  tags: string[];
  email: string;
}

const initial: FormShape = { name: '', age: 0, tags: [], email: '' };

describe('useForm · 通用表单状态机', () => {
  beforeEach(() => vi.clearAllMocks());

  it('返回初始表单数据与控制字段', () => {
    const { result } = renderHook(() => useForm<FormShape>(initial));
    expect(result.current.formData).toEqual(initial);
    expect(result.current.errors).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.touched.size).toBe(0);
  });

  it('handleChange 更新单个字段', () => {
    const { result } = renderHook(() => useForm<FormShape>(initial));
    act(() => result.current.handleChange('name', '张三'));
    expect(result.current.formData.name).toBe('张三');
  });

  it('handleChangeEvent 处理 text / number / checkbox / 空 number', () => {
    const { result } = renderHook(() => useForm<FormShape>(initial));
    const text = document.createElement('input');
    text.type = 'text';
    text.value = '李四';
    act(() => result.current.handleChangeEvent('name')({ target: text } as unknown as React.ChangeEvent));

    const num = document.createElement('input');
    num.type = 'number';
    num.value = '42';
    act(() => result.current.handleChangeEvent('age')({ target: num } as unknown as React.ChangeEvent));
    expect(result.current.formData.age).toBe(42);

    const emptyNum = document.createElement('input');
    emptyNum.type = 'number';
    emptyNum.value = '';
    act(() => result.current.handleChangeEvent('age')({ target: emptyNum } as unknown as React.ChangeEvent));
    expect(result.current.formData.age).toBe('' as unknown as number);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    act(() => result.current.handleChangeEvent('email')({ target: cb } as unknown as React.ChangeEvent));
    expect(result.current.formData.email).toBe(true as unknown as string);
  });

  it('validateAll：必填项为空时收集错误', () => {
    const { result } = renderHook(() =>
      useForm<FormShape>(initial, { name: { required: true }, email: { required: true } })
    );
    let ok = false;
    act(() => {
      ok = result.current.validateAll();
    });
    expect(ok).toBe(false);
    expect(result.current.errors.name).toBe('此字段为必填项');
    expect(result.current.errors.email).toBe('此字段为必填项');
  });

  it('validateAll：数组必填空数组报错', () => {
    const { result } = renderHook(() =>
      useForm<FormShape>(initial, { tags: { required: true } })
    );
    let ok = false;
    act(() => {
      ok = result.current.validateAll();
    });
    expect(ok).toBe(false);
    expect(result.current.errors.tags).toBe('此字段为必填项');
  });

  it('validateAll：minLength / maxLength / pattern / 数值上下限 / 自定义校验', () => {
    const rules = {
      name: { minLength: 2, maxLength: 5 },
      email: { pattern: /^\d+$/ },
      age: { min: 1, max: 120 },
    } as const;
    const { result } = renderHook(() => useForm<FormShape>({ name: 'a', age: 0, tags: [], email: 'x' }, rules));

    act(() => {
      expect(result.current.validateAll()).toBe(false);
    });
    expect(result.current.errors.name).toBe('最少需要 2 个字符');
    expect(result.current.errors.email).toBe('格式不正确');
    expect(result.current.errors.age).toBe('最小值为 1');

    act(() => {
      result.current.setFormData({ name: 'abcdef', age: 200, email: '123' });
    });
    act(() => {
      expect(result.current.validateAll()).toBe(false);
    });
    expect(result.current.errors.name).toBe('最多允许 5 个字符');
    expect(result.current.errors.age).toBe('最大值为 120');

    // 自定义校验
    const { result: r2 } = renderHook(() =>
      useForm<FormShape>(initial, { name: { validate: (v) => (v === 'bad' ? '不允许' : undefined) } })
    );
    act(() => r2.current.setFormData({ name: 'bad' }));
    act(() => expect(r2.current.validateAll()).toBe(false));
    expect(r2.current.errors.name).toBe('不允许');
  });

  it('handleSubmit：校验失败不调用 onSubmit', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useForm<FormShape>(initial, { name: { required: true } }));
    await act(async () => {
      await result.current.handleSubmit(onSubmit)({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('handleSubmit：校验通过调用 onSubmit 并管理 isSubmitting', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useForm<FormShape>({ name: 'ok', age: 10, tags: [], email: '1' })
    );
    await act(async () => {
      await result.current.handleSubmit(onSubmit)({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(onSubmit).toHaveBeenCalledWith({ name: 'ok', age: 10, tags: [], email: '1' });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('setFormData：对象与函数两种形态', () => {
    const { result } = renderHook(() => useForm<FormShape>(initial));
    act(() => result.current.setFormData({ name: 'a' }));
    expect(result.current.formData.name).toBe('a');
    act(() => result.current.setFormData((prev) => ({ ...prev, age: 5 })));
    expect(result.current.formData.age).toBe(5);
  });

  it('resetForm：恢复到初始数据并清空错误与 touched', () => {
    const { result } = renderHook(() => useForm<FormShape>(initial));
    act(() => result.current.setFormData({ name: 'x', age: 9 }));
    act(() => result.current.markTouched('name'));
    act(() => result.current.resetForm());
    expect(result.current.formData).toEqual(initial);
    expect(result.current.errors).toEqual({});
    expect(result.current.touched.size).toBe(0);
  });

  it('validateField / markTouched：touched 后 handleChange 触发即时校验', () => {
    const { result } = renderHook(() => useForm<FormShape>(initial, { name: { required: true } }));
    act(() => result.current.markTouched('name'));
    expect(result.current.touched.has('name')).toBe(true);
    // 空值被 touch → 必填错误
    expect(result.current.errors.name).toBe('此字段为必填项');
    // handleChange 内即时校验读取的是变更前快照：显式再校验一次以反映新值
    act(() => result.current.handleChange('name', 'ok'));
    act(() => result.current.validateField('name'));
    expect(result.current.errors.name).toBeUndefined();
    act(() => result.current.handleChange('name', ''));
    act(() => result.current.validateField('name'));
    expect(result.current.errors.name).toBe('此字段为必填项');
  });

  it('setErrors：直接覆写错误集合', () => {
    const { result } = renderHook(() => useForm<FormShape>(initial));
    act(() => result.current.setErrors({ name: '自定义错误' }));
    expect(result.current.errors.name).toBe('自定义错误');
  });
});
