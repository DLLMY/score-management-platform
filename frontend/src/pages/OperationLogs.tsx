import logger from '../utils/logger';
import { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import {
  Clock,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  Database,
  Settings,
  Activity,
} from 'lucide-react';
import api from '../services/api';
import { EmptyState, PermissionButton } from '../components';
import { useDebouncedValue } from '../hooks';

interface OperationLog {
  id: number;
  operation_type: string;
  target_type: string;
  description: string;
  operator: string;
  ip_address: string;
  created_at: string;
}

interface Filters {
  operation_type: string;
  target_type: string;
  operator: string;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
}

const OperationLogs: React.FC = () => {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [logError, setLogError] = useState<boolean>(false);
  const [filters, setFilters] = useState<Filters>({
    operation_type: '',
    target_type: '',
    operator: '',
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    per_page: 20,
    total: 0,
  });

  // 防抖搜索操作者 - 延迟 300ms 更新
  const debouncedOperator = useDebouncedValue(filters.operator, 300);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: pagination.page,
        per_page: pagination.per_page,
      };
      if (filters.operation_type) params.operation_type = filters.operation_type;
      if (filters.target_type) params.target_type = filters.target_type;
      if (debouncedOperator) params.operator = debouncedOperator;

      const data = await api.operationLogs.getAll(params);
      setLogs(data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: data.total || 0,
      }));
    } catch (error) {
      logger.error('加载操作日志失败:', error);
      setLogError(true);
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.per_page,
    filters.operation_type,
    filters.target_type,
    debouncedOperator,
  ]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleFilterChange = useCallback((key: keyof Filters, value: string): void => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  const handlePageChange = useCallback((newPage: number): void => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  const getOperationIcon = useMemo(() => {
    return (type: string) => {
      switch (type) {
        case 'create':
        case 'update':
        case 'delete':
          return <Database className='w-4 h-4' />;
        case 'mqtt_connect':
        case 'mqtt_disconnect':
        case 'mqtt_message':
          return <Activity className='w-4 h-4' />;
        case 'update_config':
          return <Settings className='w-4 h-4' />;
        default:
          return <User className='w-4 h-4' />;
      }
    };
  }, []);

  const getOperationColor = useMemo(() => {
    return (type: string) => {
      switch (type) {
        case 'create':
          return 'text-green-600 bg-green-50';
        case 'update':
          return 'text-blue-600 bg-blue-50';
        case 'delete':
          return 'text-red-600 bg-red-50';
        case 'mqtt_connect':
          return 'text-green-600 bg-green-50';
        case 'mqtt_disconnect':
          return 'text-orange-600 bg-orange-50';
        case 'update_config':
          return 'text-purple-600 bg-purple-50';
        default:
          return 'text-gray-600 bg-gray-50';
      }
    };
  }, []);

  const totalPages = useMemo(() => {
    return Math.ceil(pagination.total / pagination.per_page);
  }, [pagination.total, pagination.per_page]);

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-6xl mx-auto px-4 py-6'>
        <header className='mb-6'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center shadow-lg'>
                <Clock className='w-6 h-6 text-white' />
              </div>
              <div>
                <h1 className='text-xl font-bold text-gray-900'>操作日志</h1>
                <p className='text-sm text-gray-500'>查看系统操作记录</p>
              </div>
            </div>
            <PermissionButton
              permission='system.logs'
              onClick={loadLogs}
              className='flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors'
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </PermissionButton>
          </div>
        </header>

        {/* 过滤器 */}
        <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6'>
          <div className='flex items-center gap-2 mb-4'>
            <Filter className='w-4 h-4 text-gray-500' />
            <h3 className='font-medium text-gray-900'>筛选条件</h3>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>操作类型</label>
              <select
                value={filters.operation_type}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  handleFilterChange('operation_type', e.target.value)
                }
                className='w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
              >
                <option value=''>全部</option>
                <option value='create'>创建</option>
                <option value='update'>更新</option>
                <option value='delete'>删除</option>
                <option value='mqtt_connect'>MQTT连接</option>
                <option value='mqtt_disconnect'>MQTT断开</option>
                <option value='mqtt_message'>MQTT消息</option>
                <option value='update_config'>更新配置</option>
              </select>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>目标类型</label>
              <select
                value={filters.target_type}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  handleFilterChange('target_type', e.target.value)
                }
                className='w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
              >
                <option value=''>全部</option>
                <option value='user'>学生</option>
                <option value='rule'>规则</option>
                <option value='category'>分类</option>
                <option value='device'>设备</option>
                <option value='system'>系统</option>
                <option value='mqtt'>MQTT</option>
              </select>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>操作者</label>
              <input
                type='text'
                value={filters.operator}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  handleFilterChange('operator', e.target.value)
                }
                placeholder='搜索操作者'
                className='w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
              />
            </div>
          </div>
        </div>

        {/* 日志列表 */}
        <div className='bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden'>
          {loading ? (
            <div className='flex flex-col items-center justify-center py-20'>
              <RefreshCw className='w-10 h-10 text-primary-500 animate-spin mb-4' />
              <p className='text-gray-500'>加载中...</p>
            </div>
          ) : logError ? (
            <div role='alert' className='px-4 py-12 text-center'>
              <p className='text-sm text-amber-600'>日志加载失败，请刷新重试</p>
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              icon='search'
              title='暂无操作记录'
              description='没有找到符合条件的操作记录'
            />
          ) : (
            <>
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead className='bg-gray-50 border-b border-gray-100'>
                    <tr>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        操作
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        目标类型
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        描述
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        操作者
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        IP地址
                      </th>
                      <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                        时间
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-100'>
                    {logs.map((log) => (
                      <tr key={log.id} className='hover:bg-gray-50 transition-colors'>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <div className='flex items-center gap-2'>
                            <div
                              className={`p-2 rounded-lg ${getOperationColor(log.operation_type)}`}
                            >
                              {getOperationIcon(log.operation_type)}
                            </div>
                            <span className='text-sm font-medium text-gray-900'>
                              {log.operation_type}
                            </span>
                          </div>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <span className='text-sm text-gray-600'>{log.target_type || '-'}</span>
                        </td>
                        <td className='px-6 py-4'>
                          <span className='text-sm text-gray-600'>{log.description || '-'}</span>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <span className='text-sm text-gray-600'>{log.operator || '-'}</span>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <span className='text-sm text-gray-500'>{log.ip_address || '-'}</span>
                        </td>
                        <td className='px-6 py-4 whitespace-nowrap'>
                          <span className='text-sm text-gray-500'>
                            {log.created_at
                              ? new Date(log.created_at).toLocaleString('zh-CN')
                              : '--'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className='px-6 py-4 border-t border-gray-100 flex items-center justify-between'>
                  <div className='text-sm text-gray-500'>共 {pagination.total} 条记录</div>
                  <div className='flex items-center gap-2'>
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className='p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      <ChevronLeft className='w-4 h-4' />
                    </button>
                    <span className='text-sm text-gray-600'>
                      第 {pagination.page} 页 / 共 {totalPages} 页
                    </span>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= totalPages}
                      className='p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      <ChevronRight className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperationLogs;
