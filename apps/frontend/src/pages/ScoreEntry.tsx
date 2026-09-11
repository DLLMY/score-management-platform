/**
 * 成绩录入页面组件（装配层）。
 *
 * 全部 state / reducer / effect / handler / 列定义已抽到 ./scoreEntry/useScoreEntryLogic；
 * 本文件仅做「hook → ScoreEntryView」的 props 装配。
 */

import React from 'react';
import { default as ScoreEntryView } from './scoreEntry/ScoreEntryView';
import { useScoreEntryLogic } from './scoreEntry/useScoreEntryLogic';

const ScoreEntry: React.FC = () => {
  const props = useScoreEntryLogic();

  return <ScoreEntryView {...props} />;
};

export default ScoreEntry;
