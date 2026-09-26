import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Textarea from './Textarea';

describe('Textarea', () => {
  it('renders the value', () => {
    render(<Textarea value='hello' onChange={vi.fn()} id='t1' />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });

  it('calls onChange with the new value', () => {
    const onChange = vi.fn();
    render(<Textarea value='' onChange={onChange} id='t2' />);
    fireEvent.change(screen.getByDisplayValue(''), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('renders the label when provided', () => {
    render(<Textarea label='备注' onChange={vi.fn()} id='t3' />);
    expect(screen.getByText('备注')).toBeInTheDocument();
  });

  it('shows the error message and marks aria-invalid', () => {
    render(<Textarea error errorMessage='必填' onChange={vi.fn()} id='t4' />);
    expect(screen.getByText('必填')).toBeInTheDocument();
    expect(screen.getByDisplayValue('')).toHaveAttribute('aria-invalid', 'true');
  });

  it('fires onFocus and onBlur', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(<Textarea onChange={vi.fn()} onFocus={onFocus} onBlur={onBlur} id='t5' />);
    const ta = screen.getByDisplayValue('');
    fireEvent.focus(ta);
    expect(onFocus).toHaveBeenCalled();
    fireEvent.blur(ta);
    expect(onBlur).toHaveBeenCalled();
  });

  it('renders a required marker when required', () => {
    render(<Textarea label='名称' required onChange={vi.fn()} id='t6' />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });
});
