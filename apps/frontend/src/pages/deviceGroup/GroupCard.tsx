import { Layers, Monitor, Plus, Edit2, Trash2 } from 'lucide-react';
import { Badge, PermissionButton } from '../../components';
import type { DeviceGroup, GroupStats } from './types';

interface GroupCardProps {
  group: DeviceGroup;
  groupStat: GroupStats | undefined;
  onViewDevices: (group: DeviceGroup) => void;
  onAddDevices: (group: DeviceGroup) => void;
  onEdit: (group: DeviceGroup) => void;
  onDelete: (group: DeviceGroup) => void;
}

export default function GroupCard({
  group,
  groupStat,
  onViewDevices,
  onAddDevices,
  onEdit,
  onDelete,
}: GroupCardProps) {
  return (
    <div className='bg-white rounded-lg shadow hover:shadow-md transition-shadow'>
      <div className='p-4'>
        <div className='flex items-start justify-between mb-3'>
          <div className='flex items-center'>
            <div
              className='w-10 h-10 rounded-lg flex items-center justify-center mr-3'
              style={{ backgroundColor: group.color + '20' }}
            >
              <Layers className='w-5 h-5' style={{ color: group.color }} />
            </div>
            <div>
              <h3 className='font-semibold text-gray-800'>{group.name}</h3>
              {group.location && <p className='text-sm text-gray-500'>{group.location}</p>}
            </div>
          </div>
          <Badge variant={group.is_active ? 'success' : 'default'}>
            {group.is_active ? '启用' : '禁用'}
          </Badge>
        </div>

        {group.description && (
          <p className='text-sm text-gray-600 mb-3 line-clamp-2'>{group.description}</p>
        )}

        <div className='flex items-center justify-between text-sm'>
          <div className='flex items-center space-x-4'>
            <span className='text-gray-500'>
              设备:{' '}
              <span className='font-medium text-gray-700'>
                {groupStat ? groupStat.total_devices || 0 : '--'}
              </span>
            </span>
            <span className='text-green-600'>
              在线:{' '}
              <span className='font-medium'>
                {groupStat ? groupStat.online_devices || 0 : '--'}
              </span>
            </span>
            <span className='text-red-600'>
              离线:{' '}
              <span className='font-medium'>
                {groupStat ? groupStat.offline_devices || 0 : '--'}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className='border-t border-gray-100 px-4 py-3 flex justify-end space-x-2'>
        <PermissionButton
          permission='device-group.view'
          variant='ghost'
          size='sm'
          icon={Monitor}
          onClick={() => onViewDevices(group)}
        >
          设备
        </PermissionButton>
        <PermissionButton
          permission='device-group.manage'
          variant='ghost'
          size='sm'
          icon={Plus}
          onClick={() => onAddDevices(group)}
        >
          添加
        </PermissionButton>
        <PermissionButton
          permission='device-group.manage'
          variant='ghost'
          size='sm'
          icon={Edit2}
          onClick={() => onEdit(group)}
          ariaLabel='编辑'
        >
          {' '}
        </PermissionButton>
        <PermissionButton
          permission='device-group.manage'
          variant='ghost'
          size='sm'
          icon={Trash2}
          onClick={() => onDelete(group)}
          ariaLabel='删除'
        >
          {' '}
        </PermissionButton>
      </div>
    </div>
  );
}
