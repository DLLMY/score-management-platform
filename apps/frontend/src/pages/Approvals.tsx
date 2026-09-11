import ApprovalsView from './approvals/ApprovalsView';
import { useApprovalsLogic } from './approvals/useApprovalsLogic';

/**
 * 审批中心页面（装配层）
 * 全部逻辑见 ./approvals/useApprovalsLogic；展示组件见 ./approvals/ApprovalsView。
 */
function Approvals() {
  const props = useApprovalsLogic();
  return <ApprovalsView {...props} />;
}

export default Approvals;
