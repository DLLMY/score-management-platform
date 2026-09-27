import { describe, expect, it } from 'vitest';
import { getLevel, getRankColor, getScoreColor, getUserCluster } from '../helpers';
import type { ClusterData } from '../useDashboardLogic';

describe('getRankColor', () => {
  const RANKS = [
    'from-yellow-400 via-amber-500 to-orange-500',
    'from-gray-300 via-gray-400 to-gray-500',
    'from-amber-600 via-orange-600 to-amber-700',
    'from-green-400 via-emerald-500 to-green-600',
    'from-blue-400 via-blue-500 to-blue-600',
    'from-purple-400 via-purple-500 to-purple-600',
    'from-pink-400 via-pink-500 to-pink-600',
    'from-cyan-400 via-cyan-500 to-cyan-600',
    'from-red-400 via-red-500 to-red-600',
    'from-indigo-400 via-indigo-500 to-indigo-600',
  ];

  it.each(RANKS.map((color, i) => [i, color] as const))(
    '名次 %i 返回专属渐变色',
    (index, color) => {
      expect(getRankColor(index)).toBe(color);
    }
  );

  it('越界名次（>=10）回落到中性灰渐变', () => {
    expect(getRankColor(10)).toBe('from-slate-500 via-slate-600 to-slate-700');
    expect(getRankColor(99)).toBe('from-slate-500 via-slate-600 to-slate-700');
  });

  it('负数 / 小数索引同样走兜底（colors[i] 取不到值）', () => {
    expect(getRankColor(-1)).toBe('from-slate-500 via-slate-600 to-slate-700');
    expect(getRankColor(1.5)).toBe('from-slate-500 via-slate-600 to-slate-700');
  });
});

describe('getScoreColor', () => {
  it.each([
    [100, 'text-green-500'],
    [90, 'text-green-500'],
    [89.9, 'text-blue-500'],
    [60, 'text-blue-500'],
    [59.9, 'text-yellow-500'],
    [30, 'text-yellow-500'],
  ] as const)('分数 %s → %s', (score, color) => {
    expect(getScoreColor(score)).toBe(color);
  });

  it('低于 30（含负分与 0）统一为红色', () => {
    expect(getScoreColor(29.9)).toBe('text-red-500');
    expect(getScoreColor(0)).toBe('text-red-500');
    expect(getScoreColor(-5)).toBe('text-red-500');
  });
});

describe('getLevel', () => {
  it.each([
    [100, '领航者', '🏆'],
    [95, '领航者', '🏆'],
    [94.9, '自律星', '⭐'],
    [85, '自律星', '⭐'],
    [84.9, '进取者', '🚀'],
    [75, '进取者', '🚀'],
    [74.9, '稳定区', '📊'],
    [65, '稳定区', '📊'],
    [64.9, '安全基准', '✅'],
    [60, '安全基准', '✅'],
    [59.9, '浅观察', '⚠️'],
    [50, '浅观察', '⚠️'],
    [49.9, '深观察', '🔴'],
    [40, '深观察', '🔴'],
    [39.9, '限行区', '🚨'],
    [30, '限行区', '🚨'],
    [29.9, '重启预备', '🔄'],
    [20, '重启预备', '🔄'],
    [19.9, '护航区', '🛡️'],
    [10, '护航区', '🛡️'],
    [9.9, '重生点', '💀'],
    [0, '重生点', '💀'],
  ] as const)('分数 %s → %s', (score, text, icon) => {
    const level = getLevel(score);
    expect(level.text).toBe(text);
    expect(level.icon).toBe(icon);
  });

  it('每个等级返回非空且互不重复的配色', () => {
    const colors = [100, 90, 80, 70, 62, 55, 45, 35, 25, 15, 5].map((s) => getLevel(s).color);
    colors.forEach((c) => expect(c).toBeTruthy());
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('负分与超界分数落到最低档重生点', () => {
    expect(getLevel(-10).text).toBe('重生点');
    expect(getLevel(0).text).toBe('重生点');
  });
});

describe('getUserCluster', () => {
  const makeClusters = (students: unknown[]) => ({ students } as unknown as ClusterData);

  it('clusters 为 null / undefined 时返回 undefined（不抛错）', () => {
    expect(getUserCluster(null, 1)).toBeUndefined();
    expect(getUserCluster(undefined, 1)).toBeUndefined();
  });

  it('缺少 students 字段时返回 undefined', () => {
    expect(getUserCluster({} as unknown as ClusterData, 1)).toBeUndefined();
  });

  it('按 user_id 命中对应学生（数字 id）', () => {
    const clusters = makeClusters([
      { user_id: 1, name: '张三' },
      { user_id: 2, name: '李四' },
    ]);
    expect(getUserCluster(clusters, 2)).toEqual({ user_id: 2, name: '李四' });
  });

  it('字符串 id 经 Number 转换后仍能命中', () => {
    const clusters = makeClusters([{ user_id: 7, name: '王五' }]);
    expect(getUserCluster(clusters, '7')).toEqual({ user_id: 7, name: '王五' });
  });

  it(' students 为空或查无此人时返回 undefined', () => {
    expect(getUserCluster(makeClusters([]), 1)).toBeUndefined();
    expect(getUserCluster(makeClusters([{ user_id: 3 }]), 99)).toBeUndefined();
  });
});
