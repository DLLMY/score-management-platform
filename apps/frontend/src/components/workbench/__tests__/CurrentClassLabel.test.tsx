import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import CurrentClassLabel from '../CurrentClassLabel';
import { useWorkbenchClass } from '../../../hooks';
import { useClassOptions } from '../../form/EntitySelect';

vi.mock('../../../hooks', () => ({
  useWorkbenchClass: vi.fn(),
  ALL_CLASSES: 0,
}));
vi.mock('../../form/EntitySelect', () => ({
  useClassOptions: vi.fn(),
}));

const mockWorkbenchClass = useWorkbenchClass as unknown as ReturnType<typeof vi.fn>;
const mockClassOptions = useClassOptions as unknown as ReturnType<typeof vi.fn>;

describe('CurrentClassLabel', () => {
  it('filterClassId === ALL_CLASSES → 全部班级', () => {
    mockWorkbenchClass.mockReturnValue([0]);
    mockClassOptions.mockReturnValue([{ id: 1, name: '一班' }]);
    render(<CurrentClassLabel />);
    expect(screen.getByText('全部班级')).toBeInTheDocument();
  });

  it('filterClassId === 0 → 全部班级（第二个 or 分支）', () => {
    mockWorkbenchClass.mockReturnValue([0]);
    mockClassOptions.mockReturnValue([]);
    render(<CurrentClassLabel />);
    expect(screen.getByText('全部班级')).toBeInTheDocument();
  });

  it('找到对应班级 → 显示名称', () => {
    mockWorkbenchClass.mockReturnValue([5]);
    mockClassOptions.mockReturnValue([{ id: 5, name: '五班' }]);
    render(<CurrentClassLabel />);
    expect(screen.getByText('五班')).toBeInTheDocument();
  });

  it('未找到对应班级 → 显示 班级 #id', () => {
    mockWorkbenchClass.mockReturnValue([9]);
    mockClassOptions.mockReturnValue([{ id: 5, name: '五班' }]);
    render(<CurrentClassLabel />);
    expect(screen.getByText('班级 #9')).toBeInTheDocument();
  });
});
