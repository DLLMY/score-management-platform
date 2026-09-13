// T12-5 拆分（2026-09-12）：自 PermissionManagementView.tsx 原样搬出，行为逐字节等价。
import { Card, DataTable, Pagination } from '../../../components';
import type { PermissionLog } from '../types';
import type { PermissionManagementViewProps } from '../types';

export function LogsTab({
  logColumns,
  permissionLogs,
  logTotal,
  logPage,
  logPerPage,
  setLogPage,
}: PermissionManagementViewProps) {
  return (
    <>
      <div>
        <h2 className='text-lg font-semibold text-gray-900 mb-4'>权限操作日志</h2>
        <Card>
          <DataTable<PermissionLog>
            columns={logColumns}
            dataSource={permissionLogs}
            rowKey='id'
            scroll={{ x: 800 }}
            empty={{
              icon: 'data',
              title: '暂无权限日志',
              description: '这里还没有任何操作记录',
            }}
          />
          {logTotal > 0 && (
            <Pagination
              currentPage={logPage}
              totalPages={Math.max(1, Math.ceil(logTotal / logPerPage))}
              onPageChange={setLogPage}
              totalItems={logTotal}
              itemsPerPage={logPerPage}
            />
          )}
        </Card>
      </div>
    </>
  );
}
