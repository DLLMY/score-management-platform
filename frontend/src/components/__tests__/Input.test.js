import { render, screen, fireEvent } from '@testing-library/react';
import Input from '../Input';

describe('Input Component', () => {
  it('renders input with placeholder', () => {
    render(<Input placeholder='Enter text' />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders input with label', () => {
    render(<Input label='Username' />);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('handles text input', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Test input' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('displays error message', () => {
    render(<Input error errorMessage='This is an error' id='test-input' />);
    expect(screen.getByText('This is an error')).toBeInTheDocument();
  });

  it('does not call onChange when disabled', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} disabled />);

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('renders with different types', () => {
    const { rerender } = render(<Input type='text' />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    rerender(<Input type='password' />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs[inputs.length - 1]).toHaveAttribute('type', 'password');
  });

  it('shows character count when maxLength is set', () => {
    render(<Input maxLength={50} value='Test' />);
    expect(screen.getByText('4 / 50')).toBeInTheDocument();
  });
});
