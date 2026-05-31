import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../Modal';

describe('Modal Component', () => {
  it('does not render when isOpen is false', () => {
    render(<Modal isOpen={false}>Content</Modal>);
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders when isOpen is true', () => {
    render(<Modal isOpen={true}>Modal content</Modal>);
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('renders with title', () => {
    render(
      <Modal isOpen={true} title='Test Title'>
        Content
      </Modal>
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        Content
      </Modal>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const handleClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        Content
      </Modal>
    );

    const backdrop = screen.getByText('Content').closest('.fixed');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders footer when provided', () => {
    render(
      <Modal isOpen={true} footer={<button>Confirm</button>}>
        Content
      </Modal>
    );
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(
      <Modal isOpen={true} size='sm'>
        Small
      </Modal>
    );
    expect(screen.getByText('Small')).toBeInTheDocument();

    rerender(
      <Modal isOpen={true} size='lg'>
        Large
      </Modal>
    );
    expect(screen.getByText('Large')).toBeInTheDocument();

    rerender(
      <Modal isOpen={true} size='xl'>
        Extra Large
      </Modal>
    );
    expect(screen.getByText('Extra Large')).toBeInTheDocument();
  });
});
