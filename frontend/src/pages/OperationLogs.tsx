import logger from '../utils/logger';
import { useState, useEffect, useCallback, useMemo, ChangeEvent } from 'react';
import {
  Clock,
  Filter,
  RefreshCw,
  User,
  Database,
  Settings,
  Activity,
} from 'lucide-react';
import api from '../services/api';
import { PermissionButton, DataTable } from '../components';
import type { ColumnType } from '../components/data-display/DataTable';
import { useDebouncedValue, useTableUrlState } from '../hooks';

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

  // 分页 / 排序状态持久化到 URL query（报告要求）
  const { page, pageSize, sortField, sortOrder, setPage, setPageSize, setSort } =
    useTableUrlState('oplogs');

  // 防抖搜索操作者 - 延迟 300ms 更新
  const debouncedOperator = useDebouncedValue(filters.operator, 300);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page,
        per_page: pageSize,
      };
      if (filters.operation_type) params.operation_type = filters.operation_type;
      if (filters.target_type) params.target_type = filters.target_type;
      if (debouncedOperator) params.operator = debouncedOperator;
      if (sortField) {
        params.sort_by = sortField;
        params.sort_order = sortOrder === 'descend' ? 'desc' : 'asc';
      }

      const data = await api.operationLogs.getAll(params);
      setLogs(data.data || []);
      setPagination((prev) => ({
        ...prev,
        page,
        per_page: pageSize,
        total: data.total || 0,
      }));
    } catch (error) {
      logger.error('加载操作日志失败:', error);
      setLogError(true);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    sortField,
    sortOrder,
    filters.operation_type,
    filters.target_type,
    debouncedOperator,
  ]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleFilterChange = useCallback((key: keyof Filters, value: string): void => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, [setPage]);

  const handlePageChange = useCallback((newPage: number, newPageSize: number): void => {
    setPage(newPage);
    if (newPageSize !== pageSize) setPageSize(newPageSize);
  }, [pageSize, setPage, setPageSize]);

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

  const columns = useMemo<ColumnType<OperationLog>[]>(
    () => [
      {
        title: '操作',
        key: 'operation_type',
        dataIndex: 'operation_type',
        width: 160,
        sorter: true,
        render: (_, log) => (
          <div className='flex items-center gap-2'>
            <div className={`p-2 rounded-lg ${getOperationColor(log.operation_type)}`}>
              {getOperationIcon(log.operation_type)}
            </div>
            <span className='text-sm font-medium text-gray-900'>{log.operation_type}</span>
          </div>
        ),
      },
      {
        title: '目标类型',
        key: 'target_type',
        dataIndex: 'target_type',
        width: 120,
        render: (value) => <span className='text-sm text-gray-600'>{String(value ?? '-')}</span>,
      },
      {
        title: '描述',
        key: 'description',
        dataIndex: 'description',
        render: (value) => <span className='text-sm text-gray-600'>{String(value ?? '-')}</span>,
      },
      {
        title: '操作者',
        key: 'operator',
        dataIndex: 'operator',
        width: 140,
        render: (value) => <span className='text-sm text-gray-600'>{String(value ?? '-')}</span>,
      },
      {
        title: 'IP地址',
        key: 'ip_address',
        dataIndex: 'ip_address',
        width: 140,
        render: (value) => <span className='text-sm text-gray-500'>{String(value ?? '-')}</span>,
      },
      {
        title: '时间',
        key: 'created_at',
        dataIndex: 'created_at',
        width: 180,
        sorter: true,
        render: (value) => (
          <span className='text-sm text-gray-500'>
            {value ? new Date(value as string).toLocaleString('zh-CN') : '--'}
          </span>
        ),
      },
    ],
    [getOperationColor, getOperationIcon]
  );

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
        <DataTable<OperationLog>
          columns={columns}
          dataSource={logs}
          loading={loading}
          rowKey='id'
          total={pagination.total}
          page={pagination.page}
          pageSize={pagination.per_page}
          onPageChange={handlePageChange}
          sortField={sortField || undefined}
          sortOrder={sortOrder}
          onSortChange={(field, order) => setSort(field, order)}
          error={logError ? { message: '日志加载失败，请刷新重试', onRetry: loadLogs } : null}
          empty={{
            icon: 'search',
            title: '暂无操作记录',
            description: '没有找到符合条件的操作记录',
          }}
          scroll={{ x: 900 }}
        />
      </div>
    </div>
  );
};

export default OperationLogs;
