/* eslint-disable no-restricted-globals */
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '../ErrorBoundary';

const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  it('should render children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });

  it('should display error fallback when child component throws an error', async () => {
    const ThrowingComponent = () => {
      throw new Error('测试错误');
    };

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('页面出错了')).toBeInTheDocument();
    });
    
    expect(screen.getByText('测试错误')).toBeInTheDocument();
  });

  it('should have refresh and go home buttons', async () => {
    const ThrowingComponent = () => {
      throw new Error('测试错误');
    };

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '刷新页面' })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '返回首页' })).toBeInTheDocument();
    });
  });
});
