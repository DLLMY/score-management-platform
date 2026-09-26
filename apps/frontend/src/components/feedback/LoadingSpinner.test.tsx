import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders an animated spinner element', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('renders the text when provided', () => {
    const { container } = render(<LoadingSpinner text='加载中' />);
    expect(container.textContent).toContain('加载中');
  });

  it('does not render any text node when text is empty', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('span')).toBeNull();
  });

  it('applies the lg size class', () => {
    const { container } = render(<LoadingSpinner size='lg' />);
    expect(container.querySelector('.w-8')).not.toBeNull();
  });

  it('applies the sm size class', () => {
    const { container } = render(<LoadingSpinner size='sm' />);
    expect(container.querySelector('.w-4')).not.toBeNull();
  });
});
