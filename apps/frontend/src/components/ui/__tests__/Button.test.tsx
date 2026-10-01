import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CheckCircle } from 'lucide-react';
import Button from '../Button';

describe('Button', () => {
  it('渲染 children 文本', () => {
    render(<Button>点击我</Button>);
    expect(screen.getByText('点击我')).toBeInTheDocument();
  });

  it('默认 variant=primary → 应用 bg-primary-500', () => {
    const { container } = render(<Button>默认</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('bg-primary-500');
  });

  it('variant=secondary → 应用 bg-slate-100', () => {
    const { container } = render(<Button variant='secondary'>次</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('bg-slate-100');
  });

  it('variant=danger 显式 → 应用 bg-red-500', () => {
    const { container } = render(<Button variant='danger'>危</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('bg-red-500');
  });

  it('danger 属性覆盖 variant（即便 variant=secondary 仍 danger 配色）', () => {
    const { container } = render(
      <Button variant='secondary' danger>
        危
      </Button>
    );
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('bg-red-500');
    expect(btn.className).not.toContain('bg-slate-100');
  });

  it('primary 属性覆盖 variant', () => {
    const { container } = render(
      <Button variant='outline' primary>
        主
      </Button>
    );
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('bg-primary-500');
  });

  it('gradient 属性 → 应用渐变配色（primary gradient）', () => {
    const { container } = render(
      <Button variant='primary' gradient>
        渐变
      </Button>
    );
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('bg-gradient-to-r');
  });

  it('size xs / sm / lg / xl → 对应内边距类', () => {
    const sizes: Array<['xs' | 'sm' | 'lg' | 'xl', string]> = [
      ['xs', 'px-2 py-1'],
      ['sm', 'px-3 py-1.5'],
      ['lg', 'px-6 py-3'],
      ['xl', 'px-8 py-4'],
    ];
    for (const [size, cls] of sizes) {
      const { container } = render(<Button size={size}>s</Button>);
      const btn = container.querySelector('button')!;
      expect(btn.className).toContain(cls);
    }
  });

  it('loading → 按钮 disabled 且渲染 Loader2 旋转图标（onClick 不触发）', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button loading onClick={onClick}>
        加载
      </Button>
    );
    const btn = container.querySelector('button')!;
    expect(btn).toBeDisabled();
    // Loader2 渲染为 svg（animate-spin）
    expect(btn.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled → 按钮 disabled 且 onClick 不触发', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Button disabled onClick={onClick}>
        禁用
      </Button>
    );
    const btn = container.querySelector('button')!;
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('icon（默认 iconPosition=left）→ 渲染 1 个 svg 图标', () => {
    const { container } = render(<Button icon={CheckCircle}>带图标</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.querySelectorAll('svg').length).toBe(1);
  });

  it('iconPosition=right → 仍渲染 1 个 svg 图标（覆盖 right 分支）', () => {
    const { container } = render(
      <Button icon={CheckCircle} iconPosition='right'>
        右图标
      </Button>
    );
    const btn = container.querySelector('button')!;
    expect(btn.querySelectorAll('svg').length).toBe(1);
  });

  it('无 icon → 无 svg（仅 children 文本）', () => {
    const { container } = render(<Button>纯文本</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.querySelectorAll('svg').length).toBe(0);
  });

  it('onClick 正常点击触发', () => {
    const onClick = vi.fn();
    const { container } = render(<Button onClick={onClick}>点</Button>);
    fireEvent.click(container.querySelector('button')!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fullWidth → 应用 w-full', () => {
    const { container } = render(<Button fullWidth>满宽</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('w-full');
  });

  it('glow 且非 disabled → 应用 animate-pulse-glow', () => {
    const { container } = render(<Button glow>发光</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('animate-pulse-glow');
  });

  it('ripple → 按钮应用 btn-ripple 类', () => {
    const { container } = render(<Button ripple>波纹</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('btn-ripple');
  });

  it('rounded=full → 应用 rounded-full', () => {
    const { container } = render(<Button rounded='full'>圆</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.className).toContain('rounded-full');
  });

  it('type=submit → 按钮 type 属性为 submit', () => {
    const { container } = render(<Button type='submit'>提交</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('type')).toBe('submit');
  });

  it('ariaLabel → 设置 aria-label', () => {
    const { container } = render(<Button ariaLabel='确认'>确认</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('aria-label')).toBe('确认');
  });

  it('ariaDisabled 显式覆盖 → 反映到 aria-disabled', () => {
    const { container } = render(<Button ariaDisabled>禁显</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.getAttribute('aria-disabled')).toBe('true');
  });

  it('tabIndex → 设置到按钮', () => {
    const { container } = render(<Button tabIndex={5}>序</Button>);
    const btn = container.querySelector('button')!;
    expect(btn.tabIndex).toBe(5);
  });

  it('鼠标交互（enter/leave/down/up）触发内联状态处理器', () => {
    const { container } = render(<Button>悬停</Button>);
    const btn = container.querySelector('button')!;
    fireEvent.mouseEnter(btn);
    fireEvent.mouseDown(btn);
    fireEvent.mouseUp(btn);
    fireEvent.mouseLeave(btn);
    expect(btn).toBeInTheDocument();
  });
});
