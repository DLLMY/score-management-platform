import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../ui/Modal';

describe('Modal Component', () => {
  it('renders modal when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('does not render modal when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    );
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('renders modal with title', () => {
    render(
      <Modal isOpen={true} title='Modal Title' onClose={() => {}}>
        <p>Content</p>
      </Modal>
    );
    expect(screen.getByText('Modal Title')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Content</p>
      </Modal>
    );

    const backdrop = container.querySelector('.bg-black\\/50');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prevents closing when clicking content', () => {
    const onClose = jest.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div data-testid='content'>Content</div>
      </Modal>
    );

    fireEvent.click(screen.getByTestId('content'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies custom size', () => {
    const { container } = render(
      <Modal isOpen={true} size='lg' onClose={() => {}}>
        <p>Content</p>
      </Modal>
    );

    const modalContent = container.querySelector('.max-w-4xl');
    expect(modalContent).toBeInTheDocument();
  });

  it('renders footer content', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} footer={<button>OK</button>}>
        <p>Content</p>
      </Modal>
    );
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('applies default size md', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Content</p>
      </Modal>
    );

    const modalContent = container.querySelector('.max-w-2xl');
    expect(modalContent).toBeInTheDocument();
  });
});
