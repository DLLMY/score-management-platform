import { render, screen, fireEvent } from '@testing-library/react';
import Input from '../ui/Input';

describe('Input Component', () => {
  it('renders input with placeholder', () => {
    render(<Input placeholder='Enter text' />);
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
  });

  it('renders input with label', () => {
    render(<Input label='Username' />);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('renders input with value', () => {
    render(<Input value='test value' />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('test value');
  });

  it('handles onChange event', () => {
    const onChange = jest.fn();
    render(<Input onChange={onChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'new value' } });

    expect(onChange).toHaveBeenCalledWith('new value');
  });

  it('renders disabled input', () => {
    render(<Input disabled />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('renders password type input', () => {
    const { container } = render(<Input type='password' />);
    const input = container.querySelector('input');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('renders required field indicator', () => {
    render(<Input label='Email' required />);
    const label = screen.getByText('Email');
    expect(label).toHaveTextContent('*');
  });

  it('applies custom className', () => {
    const { container } = render(<Input className='custom-class' />);
    const div = container.querySelector('div');
    expect(div).toHaveClass('custom-class');
  });
});
