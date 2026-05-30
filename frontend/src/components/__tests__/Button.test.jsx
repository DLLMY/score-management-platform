import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../Button';

describe('Button Component', () => {
  it('renders button with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    const { container } = render(<Button>Primary</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-primary-500');
  });

  it('applies secondary variant', () => {
    const { container } = render(<Button variant="secondary">Secondary</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-slate-100');
  });

  it('applies danger variant', () => {
    const { container } = render(<Button variant="danger">Danger</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-red-500');
  });

  it('applies success variant', () => {
    const { container } = render(<Button variant="success">Success</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-green-500');
  });

  it('applies small size', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('text-sm');
    expect(button).toHaveClass('px-3');
  });

  it('applies large size', () => {
    const { container } = render(<Button size="lg">Large</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('text-base');
    expect(button).toHaveClass('px-6');
  });

  it('applies disabled state', () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    const button = container.querySelector('button');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-50');
    expect(button).toHaveClass('cursor-not-allowed');
  });

  it('applies loading state', () => {
    const { container } = render(<Button loading>Loading</Button>);
    const button = container.querySelector('button');
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('handles click event', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Clickable</Button>);
    
    fireEvent.click(screen.getByText('Clickable'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = jest.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    
    fireEvent.click(screen.getByText('Disabled'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies fullWidth', () => {
    const { container } = render(<Button fullWidth>Full Width</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('w-full');
  });

  it('applies gradient style', () => {
    const { container } = render(<Button gradient>Gradient</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('bg-gradient-to-r');
  });

  it('applies outline variant', () => {
    const { container } = render(<Button variant="outline">Outline</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('border-2');
  });

  it('applies ghost variant', () => {
    const { container } = render(<Button variant="ghost">Ghost</Button>);
    const button = container.querySelector('button');
    expect(button).toHaveClass('hover:bg-slate-100');
  });
});
