/**
 * Dashboard页面骨架屏组件
 * 在数据加载时显示占位符，提升用户体验
 */

import React from 'react';
import { Skeleton, Card, Row, Col, Statistic } from 'antd';

interface DashboardSkeletonProps {
  loading?: boolean;
}

const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({ loading = true }) => {
  if (!loading) return null;

  return (
    <div className="dashboard-skeleton" role="status" aria-label="正在加载仪表盘数据">
      {/* 统计卡片骨架屏 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={12} sm={6}>
          <Card>
            <Skeleton active paragraph={{ rows: 1 }}>
              <Statistic title="用户总数" value={0} />
            </Skeleton>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Skeleton active paragraph={{ rows: 1 }}>
              <Statistic title="积分记录" value={0} />
            </Skeleton>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Skeleton active paragraph={{ rows: 1 }}>
              <Statistic title="在线设备" value={0} />
            </Skeleton>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Skeleton active paragraph={{ rows: 1 }}>
              <Statistic title="待审批" value={0} />
            </Skeleton>
          </Card>
        </Col>
      </Row>

      {/* 用户排名骨架屏 */}
      <Card title="用户排名" className="mb-6">
        <Skeleton active paragraph={{ rows: 5 }} />
      </Card>

      {/* 设备状态骨架屏 */}
      <Card title="设备状态">
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    </div>
  );
};

export default DashboardSkeleton;