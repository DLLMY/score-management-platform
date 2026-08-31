import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../ui/Button';

describe('Button Component', () => {
  it('renders button with children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('applies primary variant by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button', { name: 'Primary' });
    expect(button).toHaveClass('bg-primary-500');
  });

  it('applies secondary variant', () => {
    render(<Button variant='secondary'>Secondary</Button>);
    const button = screen.getByRole('button', { name: 'Secondary' });
    expect(button).toHaveClass('bg-slate-100');
  });

  it('applies danger variant', () => {
    render(<Button variant='danger'>Danger</Button>);
    const button = screen.getByRole('button', { name: 'Danger' });
    expect(button).toHaveClass('bg-red-500');
  });

  it('applies success variant', () => {
    render(<Button variant='success'>Success</Button>);
    const button = screen.getByRole('button', { name: 'Success' });
    expect(button).toHaveClass('bg-green-500');
  });

  it('applies small size', () => {
    render(<Button size='sm'>Small</Button>);
    const button = screen.getByRole('button', { name: 'Small' });
    expect(button).toHaveClass('text-sm');
    expect(button).toHaveClass('px-3');
  });

  it('applies large size', () => {
    render(<Button size='lg'>Large</Button>);
    const button = screen.getByRole('button', { name: 'Large' });
    expect(button).toHaveClass('text-base');
    expect(button).toHaveClass('px-6');
  });

  it('applies disabled state', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('opacity-50');
    expect(button).toHaveClass('cursor-not-allowed');
  });

  it('applies loading state', () => {
    render(<Button loading>Loading</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('handles click event', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Clickable</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Clickable' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = jest.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Disabled' }));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies fullWidth', () => {
    render(<Button fullWidth>Full Width</Button>);
    const button = screen.getByRole('button', { name: 'Full Width' });
    expect(button).toHaveClass('w-full');
  });

  it('applies gradient style', () => {
    render(<Button gradient>Gradient</Button>);
    const button = screen.getByRole('button', { name: 'Gradient' });
    expect(button).toHaveClass('bg-gradient-to-r');
  });

  it('applies outline variant', () => {
    render(<Button variant='outline'>Outline</Button>);
    const button = screen.getByRole('button', { name: 'Outline' });
    expect(button).toHaveClass('border-2');
  });

  it('applies ghost variant', () => {
    render(<Button variant='ghost'>Ghost</Button>);
    const button = screen.getByRole('button', { name: 'Ghost' });
    expect(button).toHaveClass('hover:bg-slate-100');
  });
});
