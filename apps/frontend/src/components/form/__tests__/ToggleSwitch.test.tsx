import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ToggleSwitch from '../ToggleSwitch';

describe('ToggleSwitch', () => {
  it('role=switch 且 checked=true → aria-checked=true 并应用 activeClass', () => {
    const { container } = render(<ToggleSwitch checked={true} onChange={vi.fn()} />);
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('role')).toBe('switch');
    expect(btn.getAttribute('aria-checked')).toBe('true');
    expect(btn.className).toContain('bg-gradient-to-r');
  });

  it('checked=false → aria-checked=false 并应用 inactiveClass', () => {
    const { container } = render(<ToggleSwitch checked={false} onChange={vi.fn()} />);
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('aria-checked')).toBe('false');
    expect(btn.className).toContain('bg-slate-300');
  });

  it('点击 → 调用 onChange(!checked)（false→true）', () => {
    const onChange = vi.fn();
    const { container } = render(<ToggleSwitch checked={false} onChange={onChange} />);
    fireEvent.click(container.querySelector('button')!);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('点击 → 调用 onChange(!checked)（true→false）', () => {
    const onChange = vi.fn();
    const { container } = render(<ToggleSwitch checked={true} onChange={onChange} />);
    fireEvent.click(container.querySelector('button')!);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('disabled=true → 按钮 disabled 且点击不触发 onChange', () => {
    const onChange = vi.fn();
    const { container } = render(<ToggleSwitch checked={false} onChange={onChange} disabled />);
    const btn = container.querySelector('button')!;
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('size=md → 应用 w-12 h-6', () => {
    const { container } = render(<ToggleSwitch checked={false} onChange={vi.fn()} size='md' />);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('w-12 h-6');
  });

  it('size=lg（默认）→ 应用 w-14 h-7', () => {
    const { container } = render(<ToggleSwitch checked={false} onChange={vi.fn()} size='lg' />);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('w-14 h-7');
  });

  it('自定义 activeClass / inactiveClass → 覆盖默认配色', () => {
    const { container } = render(
      <ToggleSwitch
        checked={true}
        onChange={vi.fn()}
        activeClass='bg-green-500'
        inactiveClass='bg-red-300'
      />
    );
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('bg-green-500');
    expect(btn.className).not.toContain('bg-gradient-to-r');
  });
});
