import { Pagination } from 'antd';
import { EmptyState } from '../../components';
import type { ImprovementPlan } from '../../types';
import PlanCard from './PlanCard';

interface PlansTabProps {
  filteredPlans: ImprovementPlan[];
  handleOpenPlanCreate: () => void;
  planPage: number;
  planTotal: number;
  setPlanPage: (p: number) => void;
  getProgressColor: (progress: number) => string;
  getProgressBg: (progress: number) => string;
  setEditingPlanId: (id: number | null) => void;
  handleOpenPlanEdit: (plan: ImprovementPlan) => void;
  handleDeletePlan: (planId: number) => void;
  handleUpdateProgress: (planId: number, progress: number) => void;
}

export default function PlansTab({
  filteredPlans,
  handleOpenPlanCreate,
  planPage,
  planTotal,
  setPlanPage,
  getProgressColor,
  getProgressBg,
  setEditingPlanId,
  handleOpenPlanEdit,
  handleDeletePlan,
  handleUpdateProgress,
}: PlansTabProps) {
  if (filteredPlans.length === 0) {
    return (
      <EmptyState
        icon='file'
        title='暂无改进计划'
        description='还没有改进计划'
        actionLabel='创建第一个计划'
        onAction={handleOpenPlanCreate}
      />
    );
  }

  return (
    <>
      <div className='space-y-4'>
        {filteredPlans.map((plan, index) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            index={index}
            getProgressColor={getProgressColor}
            getProgressBg={getProgressBg}
            setEditingPlanId={setEditingPlanId}
            handleOpenPlanEdit={handleOpenPlanEdit}
            handleDeletePlan={handleDeletePlan}
            handleUpdateProgress={handleUpdateProgress}
          />
        ))}
      </div>
      {planTotal > 50 && (
        <div className='mt-5 flex justify-center'>
          <Pagination
            current={planPage}
            total={planTotal}
            pageSize={50}
            onChange={(p) => setPlanPage(p)}
            showSizeChanger={false}
          />
        </div>
      )}
    </>
  );
}
