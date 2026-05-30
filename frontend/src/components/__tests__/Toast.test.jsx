import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Toast from '../Toast';

describe('Toast Component', () => {
  it('renders toast with message', () => {
    render(<Toast message={{ text: 'Test toast' }} onClose={() => {}} />);
    expect(screen.getByText('Test toast')).toBeInTheDocument();
  });

  it('renders success toast', () => {
    const { container } = render(<Toast message={{ text: 'Success message', type: 'success' }} onClose={() => {}} />);
    const toast = container.querySelector('.from-green-500');
    expect(toast).toBeInTheDocument();
  });

  it('renders error toast', () => {
    const { container } = render(<Toast message={{ text: 'Error message', type: 'error' }} onClose={() => {}} />);
    const toast = container.querySelector('.from-red-500');
    expect(toast).toBeInTheDocument();
  });

  it('renders warning toast', () => {
    const { container } = render(<Toast message={{ text: 'Warning message', type: 'warning' }} onClose={() => {}} />);
    const toast = container.querySelector('.from-amber-500');
    expect(toast).toBeInTheDocument();
  });

  it('renders info toast by default', () => {
    const { container } = render(<Toast message={{ text: 'Info message' }} onClose={() => {}} />);
    const toast = container.querySelector('.from-blue-500');
    expect(toast).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<Toast message={{ text: 'Closeable' }} onClose={onClose} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto closes after duration', async () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    
    render(<Toast message={{ text: 'Auto close' }} onClose={onClose} />);
    
    expect(screen.getByText('Auto close')).toBeInTheDocument();
    
    jest.advanceTimersByTime(4000);
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    
    jest.useRealTimers();
  });

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