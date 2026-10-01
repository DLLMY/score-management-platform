import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PreloadProvider from '../PreloadProvider';
import { preloadService } from '../../services/preloadService';

vi.mock('../../services/preloadService', () => ({
  preloadService: {
    recordVisit: vi.fn(),
    preloadDependencies: vi.fn(),
  },
}));

describe('PreloadProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('挂载时记录当前路由访问并预加载其依赖（/dashboard）', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <PreloadProvider />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(preloadService.recordVisit).toHaveBeenCalledWith('/dashboard')
    );
    expect(preloadService.preloadDependencies).toHaveBeenCalledWith('/dashboard');
  });

  it('挂载时记录当前路由访问并预加载其依赖（/settings）', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <PreloadProvider />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(preloadService.recordVisit).toHaveBeenCalledWith('/settings')
    );
    expect(preloadService.preloadDependencies).toHaveBeenCalledWith('/settings');
  });
});
