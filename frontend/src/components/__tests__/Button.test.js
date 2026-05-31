import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../Button';

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>点击我</Button>);
    expect(screen.getByText('点击我')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>点击</Button>);

    fireEvent.click(screen.getByText('点击'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call handler when disabled', () => {
    const handleClick = jest.fn();
    render(
      <Button onClick={handleClick} disabled>
        禁用
      </Button>
    );

    fireEvent.click(screen.getByText('禁用'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Button variant='primary'>主要</Button>);
    expect(screen.getByText('主要')).toBeInTheDocument();

    rerender(<Button variant='secondary'>次要</Button>);
    expect(screen.getByText('次要')).toBeInTheDocument();
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<Button size='small'>小</Button>);
    expect(screen.getByText('小')).toBeInTheDocument();

    rerender(<Button size='large'>大</Button>);
    expect(screen.getByText('大')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(<Button loading>加载中</Button>);
    expect(screen.getByText('加载中')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
