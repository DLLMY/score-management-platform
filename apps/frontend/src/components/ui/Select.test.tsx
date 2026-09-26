import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Select from './Select';

describe('Select', () => {
  it('renders a combobox with children', () => {
    render(
      <Select>
        <option value='a'>A</option>
      </Select>
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onChange with the selected value', () => {
    const onChange = vi.fn();
    render(
      <Select onChange={onChange}>
        <option value='x'>X</option>
        <option value='y'>Y</option>
      </Select>
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'y' } });
    expect(onChange).toHaveBeenCalledWith('y');
  });

  it('forwards className and extra props to the native select', () => {
    render(
      <Select className='custom' data-testid='sel'>
        <option>Z</option>
      </Select>
    );
    expect(screen.getByTestId('sel')).toHaveClass('custom');
  });
});
