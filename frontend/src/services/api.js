const API_URL = '';

const getCurrentAdmin = () => {
  const admin = localStorage.getItem('admin');
  if (!admin) return null;
  try {
    return JSON.parse(admin);
  } catch {
    return null;
  }
};

const request = async (url, options = {}) => {
  const admin = getCurrentAdmin();
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(admin && admin.id ? { 'X-Admin-Id': admin.id.toString() } : {}),
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const errorMsg = error.message || error.error || `请求失败 (${response.status})`;
      throw new Error(errorMsg);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('网络连接失败，请检查网络或服务器是否可用');
    }
    if (error.message.includes('NetworkError') || error.message.includes('net::ERR')) {
      throw new Error('网络错误，请检查服务器连接');
    }
    
    console.error(`API Error [${options.method || 'GET'}] ${url}:`, error);
    throw error;
  }
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
    getStatus: () => request('/api/mqtt/status'),
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
    getLogs: (limit = 100) => request(`/api/mqtt/logs?limit=${limit}`),
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
    clearCache: () => request('/api/system/clear-cache', {
      method: 'POST'
    }),
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
    getAll: () => request('/api/devices'),
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
    getStats: () => request('/api/devices/stats')
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
  }
};

export default api;
