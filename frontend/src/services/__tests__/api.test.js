import api from '../api';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
});

describe('API Service', () => {
  it('should have users API methods', () => {
    expect(api.users).toBeDefined();
    expect(typeof api.users.getAll).toBe('function');
    expect(typeof api.users.getById).toBe('function');
    expect(typeof api.users.create).toBe('function');
    expect(typeof api.users.update).toBe('function');
    expect(typeof api.users.delete).toBe('function');
  });

  it('should have records API methods', () => {
    expect(api.records).toBeDefined();
    expect(typeof api.records.getAll).toBe('function');
    expect(typeof api.records.getByUser).toBe('function');
    expect(typeof api.records.create).toBe('function');
  });

  it('should have devices API methods', () => {
    expect(api.devices).toBeDefined();
    expect(typeof api.devices.getAll).toBe('function');
    expect(typeof api.devices.getStats).toBe('function');
  });

  it('should have rules API methods', () => {
    expect(api.rules).toBeDefined();
    expect(typeof api.rules.getAll).toBe('function');
    expect(typeof api.rules.create).toBe('function');
    expect(typeof api.rules.update).toBe('function');
    expect(typeof api.rules.delete).toBe('function');
  });

  it('should set admin header when admin is logged in', async () => {
    localStorage.setItem('admin', JSON.stringify({ id: 1, username: 'test' }));
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] })
    });

    await api.users.getAll();

    expect(mockFetch).toHaveBeenCalled();
    const options = mockFetch.mock.calls[0][1];
    expect(options.headers['X-Admin-Id']).toBe('1');
  });

  it('should handle network errors', async () => {
    // 清除缓存
    api.cache.clear();
    
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(api.users.getAll()).rejects.toThrow('网络连接失败，请检查网络或服务器是否可用');
  });

  it('should handle HTTP errors', async () => {
    // 清除缓存
    api.cache.clear();
    
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: '请求失败' })
    });

    await expect(api.users.getAll()).rejects.toThrow('请求失败');
  });
});
