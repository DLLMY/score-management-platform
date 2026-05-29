

const getCurrentAdmin = () => {
  const admin = localStorage.getItem('admin');
  if (!admin) return null;
  try {
    return JSON.parse(admin);
  } catch {
    return null;
  }
};

const getAccessToken = () => {
  return localStorage.getItem('access_token');
};

const getRefreshToken = () => {
  return localStorage.getItem('refresh_token');
};

const getCsrfToken = () => {
  return localStorage.getItem('csrf_token');
};

const setCsrfToken = (token) => {
  localStorage.setItem('csrf_token', token);
};

const fetchCsrfToken = async () => {
  try {
    const response = await fetch('/api/system/csrf-token');
    if (response.ok) {
      const data = await response.json();
      if (data.csrf_token) {
        setCsrfToken(data.csrf_token);
        return data.csrf_token;
      }
    }
  } catch (error) {
    console.warn('获取CSRF token失败:', error);
  }
  return null;
};

const clearAuthData = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('admin');
};

const cache = new Map();
const cacheTTL = 60000;
const pendingRequests = new Map();
let isRefreshing = false;
let refreshPromise = null;

const getCacheKey = (url, method) => {
  return `${method}:${url}`;
};

const clearRelatedCache = (url) => {
  const keysToDelete = [];
  for (const key of cache.keys()) {
    if (key.includes(url.split('?')[0])) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach(key => cache.delete(key));
};

const errorMessages = {
  400: '请求参数错误，请检查输入内容',
  401: '登录已过期，请重新登录',
  403: '您没有权限执行此操作',
  404: '请求的资源不存在',
  422: '数据验证失败，请检查输入内容',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误，请稍后重试',
  502: '服务器暂时不可用，请稍后重试',
  503: '服务维护中，请稍后重试',
};

const getErrorMessage = (status, errorData) => {
  if (errorData && errorData.message) {
    return errorData.message;
  }
  if (errorData && errorData.error) {
    return errorData.error;
  }
  return errorMessages[status] || `请求失败 (${status})`;
};

const handleApiError = (error, url, method) => {
  console.error(`API Error [${method}] ${url}:`, error);
  
  const errorInfo = {
    message: error.message,
    type: 'api_error',
    url,
    method,
    timestamp: Date.now()
  };
  
  return errorInfo;
};

const refreshToken = async () => {
  if (isRefreshing) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  const refreshToken = getRefreshToken();
  
  try {
    const response = await fetch('/api/admins/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    
    if (!response.ok) {
      throw new Error('刷新令牌失败');
    }
    
    const data = await response.json();
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      return data.access_token;
    } else {
      throw new Error('刷新令牌失败');
    }
  } catch (error) {
    clearAuthData();
    throw error;
  } finally {
    isRefreshing = false;
  }
};

const request = async (url, options = {}, retryCount = 0) => {
  const admin = getCurrentAdmin();
  const accessToken = getAccessToken();
  const method = options.method || 'GET';
  const cacheKey = getCacheKey(url, method);
  
  if (method === 'GET' && !options.skipCache) {
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < cacheTTL) {
        return cached.data;
      }
      cache.delete(cacheKey);
    }
    
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey);
    }
  }
  
  const promise = (async () => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
      
      // 添加CSRF token
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
      }
      
      // 优先使用JWT令牌，兼容旧的ID认证方式
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else if (admin && admin.id) {
        headers['X-Admin-Id'] = admin.id.toString();
      }
      
      const response = await fetch(url, {
        ...options,
        headers,
      });
      
      if (!response.ok) {
        // 处理401未授权错误 - token过期
        // 跳过登录请求的令牌刷新，避免登录失败时重定向
        if (response.status === 401 && retryCount < 1 && !url.includes('/login')) {
          // 尝试刷新token并重试请求
          const newToken = await refreshToken();
          if (newToken) {
            // 更新headers中的token
            headers['Authorization'] = `Bearer ${newToken}`;
            // 重试原始请求
            const retryResponse = await fetch(url, {
              ...options,
              headers,
            });
            
            if (!retryResponse.ok) {
              const error = await retryResponse.json().catch(() => ({}));
              const errorMsg = getErrorMessage(retryResponse.status, error);
              const apiError = new Error(errorMsg);
              apiError.status = retryResponse.status;
              throw apiError;
            }
            
            const data = await retryResponse.json();
            
            if (method === 'GET') {
              cache.set(cacheKey, { data, timestamp: Date.now() });
            } else {
              clearRelatedCache(url);
            }
            
            return data;
          }
        }
        
        const error = await response.json().catch(() => ({}));
        const errorMsg = getErrorMessage(response.status, error);
        const apiError = new Error(errorMsg);
        apiError.status = response.status;
        apiError.errorData = error;
        throw apiError;
      }
      
      const data = await response.json();
      
      if (method === 'GET') {
        cache.set(cacheKey, { data, timestamp: Date.now() });
      } else {
        clearRelatedCache(url);
      }
      
      return data;
    } catch (error) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        const networkError = new Error('网络连接失败，请检查网络或服务器是否可用');
        networkError.type = 'network';
        throw networkError;
      }
      if (error.message.includes('NetworkError') || error.message.includes('net::ERR')) {
        const networkError = new Error('网络错误，请检查服务器连接');
        networkError.type = 'network';
        throw networkError;
      }
      
      handleApiError(error, url, method);
      
      // 如果是401错误且不是登录请求，重定向到登录页面
      if (error.status === 401 && !url.includes('/login')) {
        clearAuthData();
        window.location.href = '/login';
        return;
      }
      
      throw error;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();
  
  if (method === 'GET') {
    pendingRequests.set(cacheKey, promise);
  }
  
  return promise;
};

const api = {
  users: {
    getAll: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.per_page) queryParams.append('per_page', params.per_page);
      if (params.search) queryParams.append('search', params.search);
      if (params.class_name) queryParams.append('class_name', params.class_name);
      const query = queryParams.toString();
      return request(`/api/users${query ? '?' + query : ''}`);
    },
    getById: (id) => request(`/api/users/${id}`),
    create: (data) => request('/api/users', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id) => request(`/api/users/${id}`, { method: 'DELETE' }),
    getByCard: (cardId) => request(`/api/users/by-card/${cardId}`),
    import: (data) => request('/api/users/import', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    batchDelete: (ids) => request('/api/users/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids })
    }),
    batchUpdateScore: (ids, scoreChange, description) => request('/api/users/batch-score', {
      method: 'POST',
      body: JSON.stringify({ ids, score_change: scoreChange, description })
    }),
    downloadTemplate: () => '/api/users/template/download'
  },
  categories: {
    getAll: () => request('/api/categories'),
    create: (data) => request('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => request(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id) => request(`/api/categories/${id}`, { method: 'DELETE' })
  },
  rules: {
    getAll: (params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.per_page) queryParams.append('per_page', params.per_page);
      if (params.category_id) queryParams.append('category_id', params.category_id);
      if (params.is_active !== undefined && params.is_active !== null) queryParams.append('is_active', params.is_active);
      const query = queryParams.toString();
      return request(`/api/rules${query ? '?' + query : ''}`);
    },
    create: (data) => request('/api/rules', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => request(`/api/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id) => request(`/api/rules/${id}`, { method: 'DELETE' }),
    export: () => request('/api/rules/export'),
    import: (data) => request('/api/rules/import', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    downloadTemplate: () => '/api/rules/template/download'
  },
  rankRules: {
    getAll: () => request('/api/rank-rules'),
    create: (data) => request('/api/rank-rules', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => request(`/api/rank-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id) => request(`/api/rank-rules/${id}`, { method: 'DELETE' }),
    getByScore: (score) => request(`/api/rank-rules/get-rank/${score}`)
  },
  records: {
    create: (data) => request('/api/records', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    getByUser: (userId, params = {}) => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page);
      if (params.per_page) queryParams.append('per_page', params.per_page);
      const query = queryParams.toString();
      return request(`/api/records/user/${userId}${query ? '?' + query : ''}`);
    },
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/records?${query}`);
    },
    getStatistics: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/records/statistics?${query}`);
    }
  },
  admins: {
    login: (data) => request('/api/admins/login', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    getCsrfToken: () => request('/api/admins/csrf-token'),
    getAll: () => request('/api/admins'),
    getById: (id) => request(`/api/admins/${id}`),
    create: (data) => request('/api/admins', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => request(`/api/admins/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id) => request(`/api/admins/${id}`, { method: 'DELETE' }),
    changePassword: (id, data) => request(`/api/admins/${id}/change-password`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  roles: {
    getAll: () => request('/api/roles'),
    create: (data) => request('/api/roles', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => request(`/api/roles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id) => request(`/api/roles/${id}`, {
      method: 'DELETE'
    })
  },
  export: {
    users: () => '/api/export/users/excel',
    records: (userId) => userId ? `/api/export/records/excel?user_id=${userId}` : '/api/export/records/excel'
  },
  analysis: {
    getUserAnalysis: (userId) => request(`/api/analysis/user/${userId}`),
    getClassAnalysis: (className) => request(`/api/analysis/class/${className}`)
  },
  timeRules: {
    getAll: () => request('/api/time-rules'),
    getById: (id) => request(`/api/time-rules/${id}`),
    create: (data) => request('/api/time-rules', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => request(`/api/time-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id) => request(`/api/time-rules/${id}`, { method: 'DELETE' }),
    check: (data) => request('/api/time-rules/check', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  box: {
    verify: (data) => request('/api/box/verify', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  mqtt: {
    getConfig: () => request('/api/mqtt/config'),
    updateConfig: (data) => request('/api/mqtt/config', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    getStatus: () => request(`/api/mqtt/status?_=${Date.now()}`, { skipCache: true }),
    connect: () => request('/api/mqtt/connect', {
      method: 'POST'
    }),
    disconnect: () => request('/api/mqtt/disconnect', {
      method: 'POST'
    }),
    publish: (data) => request('/api/mqtt/publish', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    subscribe: (data) => request('/api/mqtt/subscribe', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    unsubscribe: (data) => request('/api/mqtt/unsubscribe', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    getLogs: (limit = 100) => request(`/api/mqtt/logs?limit=${limit}&_=${Date.now()}`, { skipCache: true }),
    unlock: (data) => request('/api/mqtt/unlock', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  system: {
    backup: () => request('/api/system/backup', {
      method: 'POST'
    }),
    restore: (filename) => request('/api/system/restore', {
      method: 'POST',
      body: JSON.stringify({ filename })
    }),
    listBackups: () => request('/api/system/backups'),
    clearCache: () => {
      cache.clear();
      return request('/api/system/clear-cache', {
        method: 'POST'
      });
    },
    getConfig: () => request('/api/system/config'),
    updateConfig: (data) => request('/api/system/config', {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },
  operationLogs: {
    getAll: (params) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/operation-logs?${query}`);
    }
  },
  notifications: {
    getAll: (params) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/notifications?${query}`);
    },
    send: (data) => request('/api/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    markRead: (id) => request(`/api/notifications/${id}/read`, {
      method: 'POST'
    }),
    delete: (id) => request(`/api/notifications/${id}`, {
      method: 'DELETE'
    })
  },
  approvals: {
    getAll: (params) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/approvals?${query}`);
    },
    getById: (id) => request(`/api/approvals/${id}`),
    create: (data) => request('/api/approvals', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    approve: (id, data) => request(`/api/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    reject: (id, data) => request(`/api/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  devices: {
    getAll: (skipCache = false) => request('/api/devices', { skipCache }),
    getById: (deviceId) => request(`/api/devices/${deviceId}`),
    create: (data) => request('/api/devices', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (deviceId, data) => request(`/api/devices/${deviceId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (deviceId) => request(`/api/devices/${deviceId}`, { method: 'DELETE' }),
    getHeartbeats: (deviceId, page = 1, perPage = 50) => request(`/api/devices/${deviceId}/heartbeats?page=${page}&per_page=${perPage}`),
    getStats: (skipCache = false) => request('/api/devices/stats', { skipCache }),
    bindClass: (deviceId, data) => request(`/api/devices/${deviceId}/bind-class`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    bindAdmin: (deviceId, data) => request(`/api/devices/${deviceId}/bind-admin`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    getByClass: (classId) => request(`/api/devices/class/${classId}`),
    getByAdmin: (adminId) => request(`/api/devices/admin/${adminId}`)
  },
  classes: {
    getAll: () => request('/api/classes'),
    getById: (id) => request(`/api/classes/${id}`),
    create: (data) => request('/api/classes', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => request(`/api/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id) => request(`/api/classes/${id}`, { method: 'DELETE' })
  },
  subAccounts: {
    getAll: () => request('/api/sub-accounts'),
    getById: (id) => request(`/api/sub-accounts/${id}`),
    create: (data) => request('/api/sub-accounts', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id, data) => request(`/api/sub-accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id) => request(`/api/sub-accounts/${id}`, { method: 'DELETE' }),
    login: (data) => request('/api/sub-accounts/login', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  rolePermissions: {
    getAll: () => request('/api/role-permissions'),
    getById: (id) => request(`/api/role-permissions/${id}`)
  },
  permissionLogs: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/api/permission-logs?${query}`);
    }
  },
  adminClasses: {
    assign: (adminId, classId, isPrimary = false) => request(`/api/admins/${adminId}/assign-class`, {
      method: 'POST',
      body: JSON.stringify({ class_id: classId, is_primary: isPrimary })
    }),
    remove: (adminId, classId) => request(`/api/admins/${adminId}/remove-class/${classId}`, {
      method: 'POST'
    }),
    getByAdmin: (adminId) => request(`/api/admin-classes/${adminId}`)
  },
  dashboard: {
    getData: () => request('/api/dashboard/data')
  },
  cache: {
    clear: () => cache.clear(),
    clearByUrl: (url) => clearRelatedCache(url),
    getStats: () => ({
      size: cache.size,
      ttl: cacheTTL
    })
  }
};

export default api;
export { getCsrfToken, setCsrfToken, fetchCsrfToken };