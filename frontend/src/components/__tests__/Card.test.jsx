import { render, screen } from '@testing-library/react';
import Card from '../Card';

describe('Card Component', () => {
  it('renders basic card', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders card with title', () => {
    render(
      <Card title="Card Title">
        <p>Card content</p>
      </Card>
    );
    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('applies elevated variant with shadow', () => {
    const { container } = render(<Card variant="elevated">Content</Card>);
    const card = container.querySelector('div');
    expect(card).toHaveClass('shadow-lg');
  });

  it('applies hover effect', () => {
    const { container } = render(<Card hover>Content</Card>);
    const card = container.querySelector('div');
    expect(card).toHaveClass('hover:shadow-xl');
  });

  it('applies dark variant', () => {
    const { container } = render(<Card variant="dark">Content</Card>);
    const card = container.querySelector('div');
    expect(card).toHaveClass('from-slate-800/90');
  });

  it('applies glass variant', () => {
    const { container } = render(<Card variant="glass">Content</Card>);
    const card = container.querySelector('div');
    expect(card).toHaveClass('backdrop-blur-xl');
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    const card = container.querySelector('div');
    expect(card).toHaveClass('custom-class');
  });

  it('applies gradient with dark variant', () => {
    const { container } = render(<Card variant="dark" gradient>Content</Card>);
    const card = container.querySelector('div');
    expect(card).toHaveClass('bg-gradient-to-br');
  });
});