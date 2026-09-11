/**
 * 评分规则列表页面（装配层）。
 *
 * 全部 state / effect / handler 已抽到 ./ruleList/useRuleListLogic；
 * 本文件保留页面级类型导出（RuleSections 等依赖）并做「hook → RuleView」装配。
 */

import { useRuleListLogic } from './ruleList/useRuleListLogic';
import RuleView from './rule/RuleSections';

export interface Rule {
  id: number;
  name: string;
  description: string;
  category_id: number | null;
  score: number;
  is_active: boolean;
  daily_limit: number;
  min_interval: number;
  score_min?: number;
  score_max?: number;
}

export interface Category {
  id: number;
  name: string;
  color: string;
}

export interface FormData {
  name: string;
  description: string;
  category_id: string;
  score: number;
  is_active: boolean;
  daily_limit: number;
  min_interval: number;
  [key: string]: unknown;
}

export interface FormErrors {
  name?: string;
  score?: string;
  description?: string;
  daily_limit?: string;
  min_interval?: string;
  [key: string]: string | undefined;
}

interface TemplateRule {
  name: string;
  description: string;
  score: number;
  daily_limit: number;
  min_interval: number;
}

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  rules: TemplateRule[];
}

function RuleList() {
  const props = useRuleListLogic();

  return <RuleView {...props} />;
}

export default RuleList;
