import { BookOpen, Plus } from 'lucide-react';
import { LoadingSpinner } from '../../components';
import Toolbar from './Toolbar';
import GuidesTab from './GuidesTab';
import PlansTab from './PlansTab';
import GuideModal from './GuideModal';
import PlanModal from './PlanModal';
import type { StudyGuideViewProps } from './types';

export default function StudyGuideView(props: StudyGuideViewProps) {
  const {
    activeTab,
    setActiveTab,
    handleOpenGuideCreate,
    handleOpenPlanCreate,
    searchTerm,
    setSearchTerm,
    filterClassId,
    setFilterClassId,
    isLoading,
    filteredGuides,
    expandedGuide,
    setExpandedGuide,
    handleOpenGuideEdit,
    handleDeleteGuide,
    guidePage,
    guideTotal,
    setGuidePage,
    filteredPlans,
    editingPlanId,
    setEditingPlanId,
    handleOpenPlanEdit,
    handleDeletePlan,
    handleUpdateProgress,
    planPage,
    planTotal,
    setPlanPage,
    getProgressColor,
    getProgressBg,
    showGuideModal,
    closeGuideModal,
    guideForm,
    selectedClassId,
    setSelectedClassId,
    handleGuideChange,
    guideErrors,
    handleGuideSubmit,
    guideTypes,
    audiences,
    showPlanModal,
    closePlanModal,
    planForm,
    handlePlanChange,
    planErrors,
    handlePlanSubmit,
    planTypes,
    runSubmit,
    submitting,
  } = props;

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20'>
                <BookOpen className='w-6 h-6 text-white' />
              </div>
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                学法指导
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理学法指导文章与学生改进计划
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {activeTab === 'guides' ? (
              <button
                onClick={handleOpenGuideCreate}
                className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
              >
                <Plus className='w-5 h-5' />
                新建指导文章
              </button>
            ) : (
              <button
                onClick={handleOpenPlanCreate}
                className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
              >
                <Plus className='w-5 h-5' />
                新建改进计划
              </button>
            )}
          </div>
        </div>
      </div>

      <Toolbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        filterClassId={filterClassId}
        setFilterClassId={setFilterClassId}
      />

      <div className='flex-1 px-6 pb-6 overflow-y-auto'>
        {isLoading ? (
          <div className='flex items-center justify-center py-20'>
            <LoadingSpinner text='加载中...' />
          </div>
        ) : activeTab === 'guides' ? (
          <GuidesTab
            filteredGuides={filteredGuides}
            expandedGuide={expandedGuide}
            setExpandedGuide={setExpandedGuide}
            handleOpenGuideEdit={handleOpenGuideEdit}
            handleDeleteGuide={handleDeleteGuide}
            handleOpenGuideCreate={handleOpenGuideCreate}
            guidePage={guidePage}
            guideTotal={guideTotal}
            setGuidePage={setGuidePage}
          />
        ) : (
          <PlansTab
            filteredPlans={filteredPlans}
            handleOpenPlanCreate={handleOpenPlanCreate}
            planPage={planPage}
            planTotal={planTotal}
            setPlanPage={setPlanPage}
            getProgressColor={getProgressColor}
            getProgressBg={getProgressBg}
            setEditingPlanId={setEditingPlanId}
            handleOpenPlanEdit={handleOpenPlanEdit}
            handleDeletePlan={handleDeletePlan}
            handleUpdateProgress={handleUpdateProgress}
          />
        )}
      </div>

      {showGuideModal && (
        <GuideModal
          closeGuideModal={closeGuideModal}
          guideForm={guideForm}
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          handleGuideChange={handleGuideChange}
          guideErrors={guideErrors}
          handleGuideSubmit={handleGuideSubmit}
          runSubmit={runSubmit}
          guideTypes={guideTypes}
          audiences={audiences}
          submitting={submitting}
        />
      )}

      {showPlanModal && (
        <PlanModal
          closePlanModal={closePlanModal}
          planForm={planForm}
          handlePlanChange={handlePlanChange}
          planErrors={planErrors}
          handlePlanSubmit={handlePlanSubmit}
          runSubmit={runSubmit}
          editingPlanId={editingPlanId}
          planTypes={planTypes}
          submitting={submitting}
        />
      )}
    </div>
  );
}
