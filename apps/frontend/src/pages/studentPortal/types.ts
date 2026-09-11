import type {
  StudentInfo,
  ScoreRecordItem,
  NotificationItem,
  LeaveItem,
  PhoneboxUnlockResult,
  MyRankResult,
  StudentInsight,
} from '../../services/api';
import type { UseListFetchResult } from '../../hooks';

export type TabKey = 'score' | 'notifications' | 'leaves' | 'phonebox' | 'rank' | 'growth';

export interface LeaveFormData {
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
}

export interface StudentPortalViewProps {
  tab: TabKey;
  setTab: (t: TabKey) => void;
  student: StudentInfo | null;
  handleLogout: () => void;

  // 积分
  score: number | null;
  scorePage: number;
  setScorePage: (p: number) => void;
  scoreRecords: UseListFetchResult<ScoreRecordItem>;
  loading: boolean;
  totalChange: number;

  // 通知
  notifList: UseListFetchResult<NotificationItem>;

  // 请假
  leaves: LeaveItem[];
  leaveForm: LeaveFormData;
  setLeaveForm: (data: Partial<LeaveFormData>) => void;
  submitLeave: () => Promise<void> | void;

  // 手机箱
  unlockRes: PhoneboxUnlockResult | null;
  requestUnlock: () => Promise<void> | void;

  // 排名
  myRank: MyRankResult | null;

  // 我的成长
  insights: StudentInsight | null;
  growthLoading: boolean;

  // 错误条
  error: string;
}
