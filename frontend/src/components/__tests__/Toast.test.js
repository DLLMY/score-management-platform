import { render, screen, fireEvent } from '@testing-library/react';
import Toast from '../Toast';

describe('Toast Component', () => {
  it('renders toast with message', () => {
    render(<Toast message='Success message' />);
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('renders with different types', () => {
    const { rerender } = render(<Toast type='success' message='Success' />);
    expect(screen.getByText('Success')).toBeInTheDocument();

    rerender(<Toast type='error' message='Error' />);
    expect(screen.getByText('Error')).toBeInTheDocument();

    rerender(<Toast type='warning' message='Warning' />);
    expect(screen.getByText('Warning')).toBeInTheDocument();

    rerender(<Toast type='info' message='Info' />);
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = jest.fn();
    render(<Toast message='Close me' onClose={handleClose} />);

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(handleClose).toHaveBeenCalled();
  });

  it('auto removes after duration', () => {
    jest.useFakeTimers();
    const handleClose = jest.fn();
    render(<Toast message='Auto close' onClose={handleClose} duration={3000} />);

    expect(screen.getByText('Auto close')).toBeInTheDocument();

    jest.advanceTimersByTime(3000);
    expect(handleClose).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('renders with title', () => {
    render(<Toast title='Title' message='Content' />);
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('does not auto remove when duration is 0', () => {
    jest.useFakeTimers();
    const handleClose = jest.fn();
    render(<Toast message='No auto close' onClose={handleClose} duration={0} />);

    jest.advanceTimersByTime(10000);
    expect(handleClose).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});
