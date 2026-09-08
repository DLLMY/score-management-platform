import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Toast from '../feedback/Toast';

describe('Toast Component', () => {
  it('renders toast with message', () => {
    render(<Toast message={{ text: 'Test toast' }} onClose={() => {}} />);
    expect(screen.getByText('Test toast')).toBeInTheDocument();
  });

  it('renders success toast', () => {
    const { container } = render(
      <Toast message={{ text: 'Success message', type: 'success' }} onClose={() => {}} />
    );
    const toast = container.querySelector('.border-green-100');
    expect(toast).toBeInTheDocument();
  });

  it('renders error toast', () => {
    const { container } = render(
      <Toast message={{ text: 'Error message', type: 'error' }} onClose={() => {}} />
    );
    const toast = container.querySelector('.border-red-100');
    expect(toast).toBeInTheDocument();
  });

  it('renders warning toast', () => {
    const { container } = render(
      <Toast message={{ text: 'Warning message', type: 'warning' }} onClose={() => {}} />
    );
    const toast = container.querySelector('.border-amber-100');
    expect(toast).toBeInTheDocument();
  });

  it('renders info toast by default', () => {
    const { container } = render(<Toast message={{ text: 'Info message' }} onClose={() => {}} />);
    const toast = container.querySelector('.border-blue-100');
    expect(toast).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = jest.fn();
    render(<Toast message={{ text: 'Closeable' }} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button'));
    // handleClose wraps onClose in a 300ms setTimeout before invoking it
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('auto closes after duration', async () => {
    const onClose = jest.fn();

    render(<Toast message={{ text: 'Auto close' }} onClose={onClose} />);

    expect(screen.getByText('Auto close')).toBeInTheDocument();

    // auto-close timer is 5000ms + 300ms slide-out before onClose fires
    await waitFor(
      () => {
        expect(onClose).toHaveBeenCalledTimes(1);
      },
      { timeout: 6000 }
    );
  }, 8000);

  it('renders default message when no text provided', () => {
    render(<Toast message={{}} onClose={() => {}} />);
    expect(screen.getByText('提示')).toBeInTheDocument();
  });

  it('renders success default message', () => {
    render(<Toast message={{ type: 'success' }} onClose={() => {}} />);
    expect(screen.getByText('操作成功')).toBeInTheDocument();
  });

  it('renders error default message', () => {
    render(<Toast message={{ type: 'error' }} onClose={() => {}} />);
    expect(screen.getByText('操作失败')).toBeInTheDocument();
  });

  it('renders warning default message', () => {
    render(<Toast message={{ type: 'warning' }} onClose={() => {}} />);
    expect(screen.getByText('请注意')).toBeInTheDocument();
  });
});
