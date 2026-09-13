// T12-5 拆分（2026-09-12）：自 PermissionManagementView.tsx 原样搬出，行为逐字节等价。
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { PermissionButton, Card, DataTable } from '../../../components';
import type { ClassInfo } from '../../../services/api';
import type { PermissionManagementViewProps } from '../types';

export function ClassesTab({
  classColumns,
  classes,
  handleCreateClass,
  handleEditClass,
  handleDeleteClass,
}: PermissionManagementViewProps) {
  return (
    <>
      <div>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-semibold text-gray-900'>班级列表</h2>
          <PermissionButton permission='class.manage' onClick={handleCreateClass}>
            <Plus className='w-4 h-4 mr-2' />
            添加班级
          </PermissionButton>
        </div>

        <Card>
          <DataTable<ClassInfo>
            columns={classColumns}
            dataSource={classes}
            rowKey='id'
            scroll={{ x: 720 }}
            empty={{
              icon: 'data',
              title: '暂无班级',
              description: '点击「添加班级」创建第一个班级',
            }}
            rowActions={(cls) => (
              <div className='flex items-center justify-end gap-2'>
                <PermissionButton
                  permission='class.manage'
                  variant='secondary'
                  size='sm'
                  onClick={() => handleEditClass(cls)}
                >
                  <Edit2 className='w-4 h-4' />
                </PermissionButton>
                <PermissionButton
                  permission='class.manage'
                  variant='danger'
                  size='sm'
                  onClick={() => handleDeleteClass(cls)}
                >
                  <Trash2 className='w-4 h-4' />
                </PermissionButton>
              </div>
            )}
          />
        </Card>
      </div>
    </>
  );
}
