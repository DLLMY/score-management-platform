import type { ReactNode, FormEvent, SetStateAction, Dispatch } from 'react';
/**
 * 学生详情页（UserDetail）的类型契约。
 */

import type { NavigateFunction } from 'react-router-dom';
import type { ScoreRecordItem } from '../../services/api';
import type { User } from '../../types';

export interface ScoreChange {
  score_change: number;
  description: string;
}

export interface RankInfo {
  name: string;
  color: string;
  bg: string;
}

/**
 * 学生详情页视图层（UserDetailView）所需的全部 props。
 */
export interface UserDetailViewProps {
  /** 路由参数中的学生 ID */
  id: string | undefined;
  navigate: NavigateFunction;
  user: User;
  records: ScoreRecordItem[];
  /** 积分记录拉取是否失败 */
  recordsError: boolean;
  fetchUser: () => Promise<void>;
  fetchRecords: () => Promise<void>;
  handleScoreChange: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  /** 积分调整表单值 */
  scoreChange: ScoreChange;
  setScoreChange: Dispatch<SetStateAction<ScoreChange>>;
  showScoreModal: boolean;
  setShowScoreModal: Dispatch<SetStateAction<boolean>>;
  getScoreColor: (score: number) => string;
  getScoreChangeColor: (change: number) => string;
  getScoreChangeIcon: (change: number) => ReactNode;
  formatDate: (dateString: string) => string;
  /** 累计加分 */
  totalPositive: number;
  /** 累计扣分（绝对值） */
  totalNegative: number;
  /** 当前积分对应的等级 */
  rank: RankInfo;
}
