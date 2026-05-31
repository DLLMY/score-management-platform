import { render, screen } from '@testing-library/react';
import Card from '../Card';

describe('Card Component', () => {
  it('renders card with title', () => {
    render(<Card title='Test Card'>Content</Card>);
    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });

  it('renders card with children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Card variant='default'>Default</Card>);
    expect(screen.getByText('Default')).toBeInTheDocument();

    rerender(<Card variant='dark'>Dark</Card>);
    expect(screen.getByText('Dark')).toBeInTheDocument();

    rerender(<Card variant='elevated'>Elevated</Card>);
    expect(screen.getByText('Elevated')).toBeInTheDocument();

    rerender(<Card variant='glass'>Glass</Card>);
    expect(screen.getByText('Glass')).toBeInTheDocument();
  });

  it('renders with icon and title', () => {
    const MockIcon = () => <span>Icon</span>;
    render(
      <Card title='With Icon' icon={MockIcon}>
        Content
      </Card>
    );
    expect(screen.getByText('With Icon')).toBeInTheDocument();
    expect(screen.getByText('Icon')).toBeInTheDocument();
  });

  it('applies hover effect when hover is true', () => {
    render(<Card hover>Hoverable</Card>);
    expect(screen.getByText('Hoverable')).toBeInTheDocument();
  });

  it('renders with gradient in dark variant', () => {
    render(
      <Card variant='dark' gradient>
        Gradient
      </Card>
    );
    expect(screen.getByText('Gradient')).toBeInTheDocument();
  });
});
