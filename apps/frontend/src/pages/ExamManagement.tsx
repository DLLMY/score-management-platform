/**
 * 考试管理页面组件（装配层）
 * 创建和管理考试安排
 *
 * 全部 state / effect / handler / 列定义已抽到 ./examManagement/useExamManagementLogic；
 * 本文件仅做「hook → ExamManagementView」的 props 装配。
 */

import React from 'react';
import { LoadingSpinner } from '../components';
import ExamManagementView from './examManagement/ExamManagementView';
import { useExamManagementLogic } from './examManagement/useExamManagementLogic';

function ExamManagement(): React.ReactElement {
  const {
    loading,
    draftAvailable,
    handleRestoreDraft,
    handleDiscardDraft,
    importExamId,
    setImportExamId,
    exams,
    handleExport,
    handleImportFile,
    handleImportComplete,
    handleCreateExam,
    searchInput,
    setSearchInput,
    selectedClass,
    setSelectedClass,
    classes,
    columns,
    filteredExams,
    showModal,
    closeExamModal,
    editingExam,
    examFormData,
    examFormErrors,
    handleExamFormChange,
    examSubmitting,
    handleSaveExam,
    runExamSubmit,
    subjects,
    handleCreateSubject,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    draggedIndex,
    dragOverIndex,
    handleDeleteSubject,
    showSubjectModal,
    closeSubjectModal,
    editingSubject,
    subjectFormData,
    subjectFormErrors,
    handleSubjectFormChange,
    handleSaveSubject,
  } = useExamManagementLogic();

  if (loading) return <LoadingSpinner />;

  return (
    <ExamManagementView
      draftAvailable={draftAvailable}
      handleRestoreDraft={handleRestoreDraft}
      handleDiscardDraft={handleDiscardDraft}
      importExamId={importExamId}
      setImportExamId={setImportExamId}
      exams={exams}
      handleExport={handleExport}
      handleImportFile={handleImportFile}
      handleImportComplete={handleImportComplete}
      handleCreateExam={handleCreateExam}
      searchInput={searchInput}
      setSearchInput={setSearchInput}
      selectedClass={selectedClass}
      setSelectedClass={setSelectedClass}
      classes={classes}
      columns={columns}
      filteredExams={filteredExams}
      showModal={showModal}
      closeExamModal={closeExamModal}
      editingExam={editingExam}
      examFormData={examFormData}
      examFormErrors={examFormErrors}
      handleExamFormChange={handleExamFormChange}
      examSubmitting={examSubmitting}
      handleSaveExam={handleSaveExam}
      runExamSubmit={runExamSubmit}
      subjects={subjects}
      handleCreateSubject={handleCreateSubject}
      handleDragStart={handleDragStart}
      handleDragOver={handleDragOver}
      handleDragLeave={handleDragLeave}
      handleDrop={handleDrop}
      draggedIndex={draggedIndex}
      dragOverIndex={dragOverIndex}
      handleDeleteSubject={handleDeleteSubject}
      showSubjectModal={showSubjectModal}
      closeSubjectModal={closeSubjectModal}
      editingSubject={editingSubject}
      subjectFormData={subjectFormData}
      subjectFormErrors={subjectFormErrors}
      handleSubjectFormChange={handleSubjectFormChange}
      handleSaveSubject={handleSaveSubject}
    />
  );
}

export default ExamManagement;
