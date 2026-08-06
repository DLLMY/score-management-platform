/**
 * 测试工具 - Mock环境设置
 */
/// <reference types="jest" />
import { BrowserRouter } from 'react-router-dom';
import { render, RenderOptions } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '../../context/ToastContext';

export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn((key: string) => store[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        Object.keys(store).forEach(key => delete store[key]);
      }),
      key: jest.fn((index: number) => Object.keys(store)[index] || null),
      length: Object.defineProperty({}, 'value', {
        get: () => Object.keys(store).length,
        enumerable: true,
        configurable: true,
      }),
    },
    writable: true,
  });
  
  return store;
};

export const renderWithProviders = (
  ui: React.ReactElement,
  options?: RenderOptions
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <ToastProvider>{children}</ToastProvider>
    </BrowserRouter>
  );
  
  return render(ui, { wrapper: Wrapper, ...options });
};
