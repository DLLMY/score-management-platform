/**
 * Card 补测（B35）。纯展示组件，零网络依赖。
 * 覆盖条件渲染分支：title/subtitle/icon/actions 存在性、iconVariant 三态、
 * variant=dark+gradient 渐变分支、hover 切换 isHovered 视觉类、glow 叠加层、
 * delay 内联动画延迟、float/glass/borderGradient/pulse/animate 类名拼接。
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Card from '../Card';
import type { LucideIcon } from 'lucide-react';

const StubIcon = (props: { className?: string }) => (
  <svg data-testid='card-icon' className={props.className} />
);
const icon = StubIcon as unknown as LucideIcon;

describe('Card · 渲染分支', () => {
  it('无 title → 不渲染 header（h3 缺失分支）', () => {
    const { container } = render(<Card>body</Card>);
    expect(container.querySelector('h3')).toBeNull();
  });

  it('有 title + subtitle + icon(circle) + actions → 全部渲染', () => {
    const { getByText, container } = render(
      <Card title='标题' subtitle='副标题' icon={icon} actions={<button>操作</button>}>
        内容
      </Card>
    );
    expect(getByText('标题')).toBeInTheDocument();
    expect(getByText('副标题')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="card-icon"]')).toBeTruthy();
    expect(getByText('操作')).toBeInTheDocument();
  });

  it('iconVariant=square / hexagon → 不同圆角类分支', () => {
    const { container, rerender } = render(
      <Card title='T' icon={icon} iconVariant='square'>
        x
      </Card>
    );
    const wrap = () =>
      container.querySelector('[data-testid="card-icon"]')!.parentElement as HTMLElement;
    expect(wrap().className).toContain('rounded-lg');
    rerender(
      <Card title='T' icon={icon} iconVariant='hexagon'>
        x
      </Card>
    );
    expect(wrap().className).toContain('rounded-[20%]');
  });

  it('variant=dark + gradient → dark 渐变分支', () => {
    const { container } = render(
      <Card title='T' variant='dark' gradient>
        x
      </Card>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('from-slate-800');
    expect(root.className).toContain('via-blue-900');
  });

  it('hover → 鼠标进入/离开切换 isHovered 视觉类', () => {
    const { container } = render(
      <Card title='T' icon={icon}>
        x
      </Card>
    );
    const root = container.firstElementChild as HTMLElement;
    const wrap = () =>
      container.querySelector('[data-testid="card-icon"]')!.parentElement as HTMLElement;
    expect(wrap().className).not.toContain('scale-110');
    fireEvent.mouseEnter(root);
    expect(wrap().className).toContain('scale-110');
    fireEvent.mouseLeave(root);
    expect(wrap().className).not.toContain('scale-110');
  });

  it('glow=true → 渲染光晕叠加层（isHovered 透明度分支初始 opacity-0）', () => {
    const { container } = render(
      <Card title='T' glow>
        x
      </Card>
    );
    const glowLayer = container.querySelector('div.absolute.inset-0');
    expect(glowLayer?.className).toContain('from-primary-500');
  });

  it('delay → style.animationDelay 注入', () => {
    const { container } = render(
      <Card title='T' delay={300}>
        x
      </Card>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.animationDelay).toBe('300ms');
  });

  it('float/glass/borderGradient/pulse/animate → 类名拼接分支', () => {
    const { container } = render(
      <Card title='T' float glass borderGradient pulse animate>
        x
      </Card>
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('card-hover-float');
    expect(root.className).toContain('card-glass-enhanced');
    expect(root.className).toContain('card-gradient-border');
    expect(root.className).toContain('pulse-glow-card');
    expect(root.className).toContain('animate-fade-in');
  });
});
