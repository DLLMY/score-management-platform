import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '../ErrorBoundary';

// Mock console.error to prevent test noise
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  it('should render children normally when no error occurs', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>
    );
    
    expect(getByText('正常内容')).toBeInTheDocument();
  });

  it('should display error fallback when child component throws an error', async () => {
    const ThrowingComponent = () => {
      throw new Error('测试错误');
    };

    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(getByText('页面出错了')).toBeInTheDocument();
    });
    
    expect(getByText('测试错误')).toBeInTheDocument();
  });

  it('should have refresh and go home buttons', async () => {
    const ThrowingComponent = () => {
      throw new Error('测试错误');
    };

    const { getByRole } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(getByRole('button', { name: '刷新页面' })).toBeInTheDocument();
      expect(getByRole('button', { name: '返回首页' })).toBeInTheDocument();
    });
  });
});
