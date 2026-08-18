/**
 * UserList页面骨架屏组件
 * 在用户数据加载时显示占位符
 */

import React from 'react';
import { Skeleton, Card, Table, Space } from 'antd';

interface UserListSkeletonProps {
  loading?: boolean;
}

const UserListSkeleton: React.FC<UserListSkeletonProps> = ({ loading = true }) => {
  if (!loading) return null;

  return (
    <div className='user-list-skeleton' role='status' aria-label='正在加载用户列表数据'>
      {/* 搜索栏骨架屏 */}
      <Card className='mb-4'>
        <Space>
          <Skeleton.Input active size='small' style={{ width: 200 }} />
          <Skeleton.Button active size='small' />
          <Skeleton.Button active size='small' />
        </Space>
      </Card>

      {/* 用户表格骨架屏 */}
      <Card>
        <Table
          loading={true}
          columns={[
            { title: '姓名', dataIndex: 'name', width: 150 },
            { title: '学号', dataIndex: 'card_id', width: 150 },
            { title: '班级', dataIndex: 'class_name', width: 150 },
            { title: '积分', dataIndex: 'current_score', width: 100 },
            { title: '状态', dataIndex: 'is_active', width: 100 },
            { title: '操作', dataIndex: 'actions', width: 200 },
          ]}
          dataSource={[]}
          pagination={{ total: 0 }}
          locale={{ emptyText: <Skeleton active paragraph={{ rows: 10 }} /> }}
        />
      </Card>
    </div>
  );
};

export default UserListSkeleton;
