import { SubjectManagementView } from './subjectManagement/SubjectManagementSections';
import { useSubjectManagementLogic } from './subjectManagement/useSubjectManagementLogic';

/**
 * 科目管理页面（装配层）
 * 全部逻辑见 ./subjectManagement/useSubjectManagementLogic；展示组件见 ./subjectManagement/SubjectManagementSections。
 */
function SubjectManagementPage() {
  const props = useSubjectManagementLogic();
  return <SubjectManagementView {...props} />;
}

export default SubjectManagementPage;
