/**
 * Input 补测（B35）。纯展示受控组件，零网络依赖。
 * 覆盖条件渲染/属性分支：label+required 星号、error+errorMessage 关联 aria、
 * icon 左/右位置、focus/blur 切换 isFocused 视觉类、onChange 回传、
 * disabled/readOnly/aria 透传、onFocus/onBlur 外部回调。
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Input from '../Input';
import type { LucideIcon } from 'lucide-react';

const StubIcon = (props: { className?: string }) => (
  <svg data-testid='input-icon' className={props.className} />
);
const icon = StubIcon as unknown as LucideIcon;

describe('Input · 渲染分支', () => {
  it('label + required → 渲染 label 与必填星号', () => {
    const { getByText } = render(<Input label='姓名' required />);
    expect(getByText('姓名')).toBeInTheDocument();
    expect(getByText('*')).toBeInTheDocument();
  });

  it('error + errorMessage → 渲染错误提示并关联 aria-describedby', () => {
    const { container } = render(<Input id='f1' label='邮箱' error errorMessage='格式错误' />);
    const p = container.querySelector('#f1-error') as HTMLElement;
    expect(p).toBeTruthy();
    expect(p.textContent).toContain('格式错误');
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('f1-error');
  });

  it('icon 左/右位置 → 图标容器定位分支', () => {
    const { container, rerender } = render(<Input icon={icon} iconPosition='left' />);
    let wrap = container.querySelector('[data-testid="input-icon"]')!.parentElement as HTMLElement;
    expect(wrap.className).toContain('left-4');
    rerender(<Input icon={icon} iconPosition='right' />);
    wrap = container.querySelector('[data-testid="input-icon"]')!.parentElement as HTMLElement;
    expect(wrap.className).toContain('right-4');
  });

  it('聚焦/失焦 → isFocused 切换，图标与边框类变化', () => {
    const { container } = render(<Input icon={icon} />);
    const input = container.querySelector('input') as HTMLInputElement;
    const wrap = () =>
      container.querySelector('[data-testid="input-icon"]')!.parentElement as HTMLElement;
    expect(wrap().className).toContain('text-slate-400');
    fireEvent.focus(input);
    expect(wrap().className).toContain('text-primary-500');
    fireEvent.blur(input);
    expect(wrap().className).toContain('text-slate-400');
  });

  it('onChange → 回传 e.target.value', () => {
    const onChange = vi.fn();
    const { container } = render(<Input onChange={onChange} />);
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('disabled / readOnly → 属性透传', () => {
    const { container } = render(<Input disabled readOnly />);
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.hasAttribute('disabled')).toBe(true);
    expect(input.hasAttribute('readOnly')).toBe(true);
  });

  it('aria 属性透传（ariaLabel/ariaRequired/maxLength/pattern）', () => {
    const { container } = render(
      <Input ariaLabel='搜索' ariaRequired maxLength={10} pattern='[a-z]+' />
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('搜索');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(input.getAttribute('maxlength')).toBe('10');
    expect(input.getAttribute('pattern')).toBe('[a-z]+');
  });

  it('onFocus/onBlur 外部回调触发', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const { container } = render(<Input onFocus={onFocus} onBlur={onBlur} />);
    const input = container.querySelector('input') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
