import { render, screen } from '@testing-library/react';
import StatCard from '../StatCard';

const icon = <span data-testid='stat-icon'>ICON</span>;

describe('StatCard', () => {
  it('渲染 label / value / icon 与渐变类', () => {
    const { container } = render(
      <StatCard
        label='总人数'
        value={128}
        icon={icon}
        iconGradient='from-blue-500 to-indigo-500'
        decoGradient='from-blue-500/10 to-indigo-500/10'
      />
    );
    expect(screen.getByText('总人数')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByTestId('stat-icon')).toBeInTheDocument();
    const html = container.innerHTML;
    expect(html).toContain('from-blue-500 to-indigo-500');
    expect(html).toContain('from-blue-500/10 to-indigo-500/10');
  });

  it('size 默认 lg → 应用 lg 尺寸类', () => {
    const { container } = render(
      <StatCard label='L' value={1} icon={icon} iconGradient='g' decoGradient='d' />
    );
    expect(container.innerHTML).toContain('w-14 h-14');
  });

  it('size sm → 应用 sm 尺寸类', () => {
    const { container } = render(
      <StatCard label='L' value={1} icon={icon} iconGradient='g' decoGradient='d' size='sm' />
    );
    expect(container.innerHTML).toContain('w-12 h-12');
  });

  it('glowClass 提供时附加到图标盒', () => {
    const { container } = render(
      <StatCard
        label='L'
        value={1}
        icon={icon}
        iconGradient='g'
        decoGradient='d'
        glowClass='shadow-blue-500/20'
      />
    );
    expect(container.innerHTML).toContain('shadow-blue-500/20');
  });

  it('className 透传', () => {
    const { container } = render(
      <StatCard
        label='L'
        value={1}
        icon={icon}
        iconGradient='g'
        decoGradient='d'
        className='col-span-2'
      />
    );
    expect((container.firstElementChild as HTMLElement).className).toContain('col-span-2');
  });
});
