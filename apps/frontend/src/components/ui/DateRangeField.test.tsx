import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DateRangeField from './DateRangeField';

const baseProps = {
  startValue: '',
  endValue: '',
  onStartChange: vi.fn(),
  onEndChange: vi.fn(),
  focusColor: 'focus:ring-violet-500/50',
};

describe('DateRangeField', () => {
  it('renders two date inputs with default labels', () => {
    const { container } = render(<DateRangeField {...baseProps} />);
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(2);
    expect(screen.getByText('开始日期')).toBeInTheDocument();
    expect(screen.getByText('结束日期')).toBeInTheDocument();
  });

  it('calls onStartChange when the start date changes', () => {
    const onStartChange = vi.fn();
    const { container } = render(<DateRangeField {...baseProps} onStartChange={onStartChange} />);
    const inputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(inputs[0], { target: { value: '2026-01-01' } });
    expect(onStartChange).toHaveBeenCalledWith('2026-01-01');
  });

  it('calls onEndChange when the end date changes', () => {
    const onEndChange = vi.fn();
    const { container } = render(<DateRangeField {...baseProps} onEndChange={onEndChange} />);
    const inputs = container.querySelectorAll('input[type="date"]');
    fireEvent.change(inputs[1], { target: { value: '2026-02-02' } });
    expect(onEndChange).toHaveBeenCalledWith('2026-02-02');
  });

  it('shows the start error message', () => {
    render(<DateRangeField {...baseProps} startError='开始必填' />);
    expect(screen.getByText('开始必填')).toBeInTheDocument();
  });

  it('shows the end error message', () => {
    render(<DateRangeField {...baseProps} endError='结束必填' />);
    expect(screen.getByText('结束必填')).toBeInTheDocument();
  });

  it('uses custom labels', () => {
    render(<DateRangeField {...baseProps} startLabel='起' endLabel='止' />);
    expect(screen.getByText('起')).toBeInTheDocument();
    expect(screen.getByText('止')).toBeInTheDocument();
  });
});
