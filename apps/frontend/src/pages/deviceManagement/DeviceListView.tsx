import { Clock } from 'lucide-react';
import { SearchFilter, DataTable, type ColumnType } from '../../components';
import type { DeviceRow } from './DeviceColumns';

interface DeviceListViewProps {
  filteredDevices: DeviceRow[];
  loading: boolean;
  lastUpdateTime: Date | null;
  searchInput: string;
  onSearchChange: (value: string) => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (value: boolean) => void;
  columns: ColumnType<DeviceRow>[];
  onAddDevice: () => void;
}

export function DeviceListView({
  filteredDevices,
  loading,
  lastUpdateTime,
  searchInput,
  onSearchChange,
  autoRefresh,
  onAutoRefreshChange,
  columns,
  onAddDevice,
}: DeviceListViewProps) {
  return (
    <div className='card'>
      <div className='card-header flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <h2 className='text-lg font-semibold text-gray-900'>设备列表</h2>
          {lastUpdateTime && (
            <span className='text-sm text-gray-500 flex items-center'>
              <Clock className='w-4 h-4 mr-1' />
              最后更新: {lastUpdateTime.toLocaleTimeString('zh-CN')}
            </span>
          )}
        </div>
        <div className='flex items-center gap-3'>
          <SearchFilter
            searchTerm={searchInput}
            onSearchChange={onSearchChange}
            placeholder='搜索设备ID或名称...'
          />
          <label className='flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={autoRefresh}
              onChange={(e) => onAutoRefreshChange(e.target.checked)}
              className='w-4 h-4 text-blue-600 rounded'
            />
            <span className='text-sm text-gray-600'>自动刷新</span>
          </label>
        </div>
      </div>

      <div className='card-body'>
        <DataTable<DeviceRow>
          rowKey='device_id'
          columns={columns}
          dataSource={filteredDevices}
          loading={loading}
          scroll={{ x: 'max-content' }}
          empty={{
            icon: 'wifi',
            title: '暂无设备',
            description: '添加设备开始监控系统',
            actionLabel: '添加设备',
            onAction: onAddDevice,
          }}
        />
      </div>
    </div>
  );
}
