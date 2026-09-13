import ClassManagementView from './classManagement/ClassManagementView';
import { useClassManagementLogic } from './classManagement/useClassManagementLogic';

/**
 * 班级管理页面（装配层，T12-3）：逻辑见 ./classManagement/useClassManagementLogic，
 * 展示见 ./classManagement/ClassManagementView。
 */
function ClassManagementPage() {
  const props = useClassManagementLogic();
  return <ClassManagementView {...props} />;
}

export default ClassManagementPage;
