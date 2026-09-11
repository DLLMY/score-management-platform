import React from 'react';
import DashboardView from './dashboard/DashboardView';
import { useDashboardLogic } from './dashboard/useDashboardLogic';

/**
 * 仪表盘页面（装配层）
 * reducer + 数据加载 + handler 见 ./dashboard/useDashboardLogic；
 * 展示组件与纯函数 helper 见 ./dashboard/DashboardView。
 */
function Dashboard(): React.ReactElement {
  const props = useDashboardLogic();
  return <DashboardView {...props} />;
}

export default Dashboard;
