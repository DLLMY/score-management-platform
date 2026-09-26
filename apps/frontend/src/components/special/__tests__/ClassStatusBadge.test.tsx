import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ClassStatusBadge from '../ClassStatusBadge';

const usePermissions = vi.hoisted(() => vi.fn());

vi.mock('../../../hooks', () => ({ usePermissions }));

const baseState = {
  status: null,
  loading: false,
  error: null,
  blocked: false,
  label: '上课中',
  refresh: vi.fn(),
};

describe('ClassStatusBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePermissions.mockReturnValue({ hasPermission: () => false, isSuperAdmin: false });
  });

  it('renders the status label', () => {
    render(<ClassStatusBadge state={baseState} />);
    expect(screen.getByText('上课中')).toBeInTheDocument();
  });

  it('renders the blocked tone when blocked', () => {
    const { container } = render(
      <ClassStatusBadge state={{ ...baseState, blocked: true, label: '已下课' }} />
    );
    expect(container.querySelector('.bg-red-50')).not.toBeNull();
  });

  it('renders the loading tone when loading', () => {
    const { container } = render(<ClassStatusBadge state={{ ...baseState, loading: true }} />);
    expect(container.querySelector('.bg-gray-50')).not.toBeNull();
  });

  it('calls state.refresh when the refresh button is clicked', () => {
    const refresh = vi.fn();
    render(<ClassStatusBadge state={{ ...baseState, refresh }} />);
    fireEvent.click(screen.getByLabelText('刷新上课状态'));
    expect(refresh).toHaveBeenCalled();
  });

  it('renders the forceSend checkbox when permitted and both props are present', () => {
    usePermissions.mockReturnValue({ hasPermission: () => true, isSuperAdmin: false });
    render(<ClassStatusBadge state={baseState} forceSend={false} onForceSendChange={vi.fn()} />);
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('does not render the checkbox when not permitted', () => {
    render(<ClassStatusBadge state={baseState} forceSend={false} onForceSendChange={vi.fn()} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('does not render the checkbox when onForceSendChange is missing', () => {
    usePermissions.mockReturnValue({ hasPermission: () => true, isSuperAdmin: false });
    render(<ClassStatusBadge state={baseState} forceSend={false} />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('calls onForceSendChange when the checkbox is toggled', () => {
    usePermissions.mockReturnValue({ hasPermission: () => true, isSuperAdmin: false });
    const onForceSendChange = vi.fn();
    render(
      <ClassStatusBadge state={baseState} forceSend={false} onForceSendChange={onForceSendChange} />
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onForceSendChange).toHaveBeenCalledWith(true);
  });
});
