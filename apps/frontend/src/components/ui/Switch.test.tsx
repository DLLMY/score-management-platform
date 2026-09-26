import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Switch from './Switch';

describe('Switch', () => {
  it('renders a switch with the correct aria-checked', () => {
    render(<Switch checked={false} onChange={vi.fn()} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with the toggled value on click', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<Switch checked onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the label when provided', () => {
    render(<Switch checked={false} onChange={vi.fn()} label='启用' />);
    expect(screen.getByText('启用')).toBeInTheDocument();
  });

  it('applies the lg size class', () => {
    const { container } = render(<Switch checked={false} onChange={vi.fn()} size='lg' />);
    expect(container.querySelector('.w-14')).not.toBeNull();
  });
});
