import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkbenchBreadcrumb from '../WorkbenchBreadcrumb';

describe('WorkbenchBreadcrumb', () => {
  it('渲染总览链接指向 /workbench 与当前标题', () => {
    render(
      <MemoryRouter>
        <WorkbenchBreadcrumb current='考勤管理' />
      </MemoryRouter>
    );
    const link = screen.getByText('工作台总览');
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/workbench');
    expect(screen.getByText('考勤管理')).toBeInTheDocument();
  });

  it('渲染导航图标（LayoutDashboard / ChevronRight）', () => {
    const { container } = render(
      <MemoryRouter>
        <WorkbenchBreadcrumb current='X' />
      </MemoryRouter>
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });
});
