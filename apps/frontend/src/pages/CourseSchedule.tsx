/**
 * 课程表页面组件（装配层）。
 *
 * 全部 state / effect / handler / 列定义已抽到 ./courseSchedule/useCourseScheduleLogic；
 * 本文件仅做「hook → CourseScheduleView」的 props 装配。
 */

import React from 'react';
import { default as CourseScheduleView } from './courseSchedule/CourseScheduleView';
import { useCourseScheduleLogic } from './courseSchedule/useCourseScheduleLogic';

const CourseSchedulePage: React.FC = () => {
  const viewProps = useCourseScheduleLogic();

  return <CourseScheduleView {...viewProps} />;
};

export default CourseSchedulePage;
