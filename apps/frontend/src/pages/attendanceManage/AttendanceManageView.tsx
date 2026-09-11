import { Calendar, AlertCircle, FileText, Plus } from 'lucide-react';
import { ClassSelect, WorkbenchBreadcrumb, CurrentClassLabel } from '../../components';
import DraftBanner from './DraftBanner';
import StatisticsCards from './StatisticsCards';
import PendingLeavesPanel from './PendingLeavesPanel';
import AttendanceTableCard from './AttendanceTableCard';
import RecordModal from './RecordModal';
import LeaveModal from './LeaveModal';
import type { AttendanceManageViewProps } from './types';

export default function AttendanceManageView(props: AttendanceManageViewProps) {
  const {
    draftAvailable,
    handleRestoreDraft,
    handleDiscardDraft,
    stats,
    filterClassId,
    setFilterClassId,
    showLeavesPanel,
    setShowLeavesPanel,
    pendingLeaves,
    handleOpenLeaveModal,
    handleOpenRecordModal,
    leavesError,
    leavesPage,
    leavesTotal,
    setLeavesPage,
    handleApproveLeave,
    columns,
    filteredAttendances,
    isLoading,
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    attendancePage,
    attendanceTotal,
    setAttendancePage,
    showRecordModal,
    closeRecordModal,
    recordForm,
    setRecordForm,
    handleBatchRecord,
    handleRecordSubmit,
    showLeaveModal,
    closeLeaveModal,
    leaveForm,
    setLeaveForm,
    handleLeaveSubmit,
    errors,
    submitting,
    runSubmit,
  } = props;

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      {draftAvailable && (
        <DraftBanner
          handleRestoreDraft={handleRestoreDraft}
          handleDiscardDraft={handleDiscardDraft}
        />
      )}

      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20'>
              <Calendar className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                考勤管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>记录考勤、请假审批与统计</p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <div className='w-44'>
              <ClassSelect
                allowEmpty
                emptyLabel='全部班级'
                value={filterClassId}
                onChange={setFilterClassId}
              />
            </div>
            <WorkbenchBreadcrumb current='考勤管理' />
            <CurrentClassLabel />
            {pendingLeaves.length > 0 && (
              <button
                onClick={() => setShowLeavesPanel(!showLeavesPanel)}
                className='relative flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl hover:shadow-md transition-all font-medium'
              >
                <AlertCircle className='w-5 h-5' />
                <span>待审批</span>
                <span className='absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center'>
                  {pendingLeaves.length}
                </span>
              </button>
            )}
            <button
              onClick={handleOpenLeaveModal}
              className='flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <FileText className='w-5 h-5' />
              请假申请
            </button>
            <button
              onClick={handleOpenRecordModal}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              快速记录
            </button>
          </div>
        </div>
      </div>

      <StatisticsCards stats={stats} />

      {showLeavesPanel && (
        <PendingLeavesPanel
          leavesError={leavesError}
          pendingLeaves={pendingLeaves}
          submitting={submitting}
          handleApproveLeave={handleApproveLeave}
          runSubmit={runSubmit}
          setShowLeavesPanel={setShowLeavesPanel}
          leavesPage={leavesPage}
          leavesTotal={leavesTotal}
          setLeavesPage={setLeavesPage}
        />
      )}

      <AttendanceTableCard
        columns={columns}
        filteredAttendances={filteredAttendances}
        isLoading={isLoading}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        attendancePage={attendancePage}
        attendanceTotal={attendanceTotal}
        setAttendancePage={setAttendancePage}
      />

      {showRecordModal && (
        <RecordModal
          closeRecordModal={closeRecordModal}
          recordForm={recordForm}
          setRecordForm={setRecordForm}
          errors={errors}
          submitting={submitting}
          handleBatchRecord={handleBatchRecord}
          handleRecordSubmit={handleRecordSubmit}
          runSubmit={runSubmit}
        />
      )}

      {showLeaveModal && (
        <LeaveModal
          closeLeaveModal={closeLeaveModal}
          leaveForm={leaveForm}
          setLeaveForm={setLeaveForm}
          errors={errors}
          submitting={submitting}
          handleLeaveSubmit={handleLeaveSubmit}
          runSubmit={runSubmit}
        />
      )}
    </div>
  );
}
