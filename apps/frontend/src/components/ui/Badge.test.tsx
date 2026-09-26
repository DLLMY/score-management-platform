import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from './Badge';

const variants: Array<[Parameters<typeof Badge>[0]['variant'], string]> = [
  ['default', 'bg-gray-100'],
  ['primary', 'bg-primary-100'],
  ['success', 'bg-green-100'],
  ['warning', 'bg-yellow-100'],
  ['danger', 'bg-red-100'],
  ['blue', 'bg-blue-100'],
  ['purple', 'bg-purple-100'],
];

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>hi</Badge>);
    expect(screen.getByText('hi')).toBeInTheDocument();
  });

  it.each(variants)('applies the %s variant class', (variant, cls) => {
    const { container } = render(<Badge variant={variant}>x</Badge>);
    expect(container.querySelector(`.${cls}`)).not.toBeNull();
  });

  it('merges a custom className', () => {
    render(<Badge className='extra'>y</Badge>);
    expect(screen.getByText('y').className).toContain('extra');
  });

  it('falls back to default variant when none provided', () => {
    const { container } = render(<Badge>z</Badge>);
    expect(container.querySelector('.bg-gray-100')).not.toBeNull();
  });
});
