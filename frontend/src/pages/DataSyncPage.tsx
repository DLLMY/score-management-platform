import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle, Database, Users, Building2, Shield } from 'lucide-react';
import { request } from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import { PermissionButton } from '../components';

interface ConsistencyStats {
  classes: { total: number; used_by_users: number; used_by_admins: number; missing: number };
  users: { total_with_class: number; linked: number; unlinked: number; link_rate: string };
  admins: { total_with_class: number; linked: number; unlinked: number; link_rate: string };
  admin_class_links: number;
  missing_classes: string[];
}

interface ConsistencyIssue {
  type: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  model: string;
  id: number;
  message: string;
}

const DataSyncPage: React.FC = () => {
  const { showToast } = useStableToast();
  const [stats, setStats] = useState<ConsistencyStats | null>(null);
  const [issues, setIssues] = useState<ConsistencyIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [healthy, setHealthy] = useState(true);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const result = await request('/api/consistency/status') as { success: boolean; status?: ConsistencyStats };
      if (result.success) {
        setStats(result.status || null);
      }
    } catch (error: unknown) {
      console.error('Failed to fetch status:', error);
    }
    setLoading(false);
  }, []);

  const fetchCheck = useCallback(async () => {
    try {
      const result = await request('/api/consistency/check') as { success: boolean; issues?: ConsistencyIssue[]; healthy?: boolean; total_issues?: number };
      if (result.success) {
        setIssues(result.issues || []);
        setHealthy(result.healthy ?? true);
        if (!result.healthy) {
          showToast('warning', `发现 ${result.total_issues} 个数据一致性问题`);
        }
      }
    } catch (error: unknown) {
      showToast('error', '一致性检查失败');
    }
  }, [showToast]);

  const handleFix = useCallback(async () => {
    setFixing(true);
    try {
      const result = await request('/api/consistency/fix', { method: 'POST' }) as { success: boolean };
      if (result.success) {
        showToast('success', '数据修复完成');
        fetchStatus();
        fetchCheck();
      } else {
        showToast('error', '数据修复失败');
      }
    } catch (error: unknown) {
      showToast('error', '数据修复请求失败');
    }
    setFixing(false);
  }, [fetchStatus, fetchCheck, showToast]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const severityColors = {
    critical: 'bg-red-100 text-red-700 border-red-300',
    error: 'bg-orange-100 text-orange-700 border-orange-300',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    info: 'bg-blue-100 text-blue-700 border-blue-300',
  };

  const severityIcons = {
    critical: '🔴',
    error: '🟠',
    warning: '🟡',
    info: '🔵',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">数据同步管理</h1>
          <p className="text-gray-500 mt-1">管理班级、教师、学生数据关联</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <PermissionButton
            permission='system.manage'
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新状态
          </PermissionButton>
          <PermissionButton
            permission='system.manage'
            onClick={fetchCheck}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Shield className="w-4 h-4" />
            一致性检查
          </PermissionButton>
          <PermissionButton
            permission='system.manage'
            onClick={handleFix}
            disabled={fixing}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            {fixing ? '修复中...' : '执行修复'}
          </PermissionButton>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`rounded-xl p-4 mb-6 ${healthy ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        <div className="flex items-center gap-3">
          {healthy ? (
            <>
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div>
                <div className="font-semibold text-green-700">数据一致性良好</div>
                <div className="text-sm text-green-600">所有数据关联正常</div>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
              <div>
                <div className="font-semibold text-yellow-700">发现数据一致性问题</div>
                <div className="text-sm text-yellow-600">建议执行修复操作</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <div className="text-sm text-gray-500">学生数据</div>
                <div className="text-xl font-bold">{stats.users.total_with_class}</div>
                <div className="text-xs text-gray-400">
                  已关联 {stats.users.linked} / 未关联 {stats.users.unlinked}
                </div>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-1">关联率</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: stats.users.link_rate || '0%' }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">{stats.users.link_rate || '0%'}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-green-500" />
              <div>
                <div className="text-sm text-gray-500">管理员数据</div>
                <div className="text-xl font-bold">{stats.admins.total_with_class}</div>
                <div className="text-xs text-gray-400">
                  已关联 {stats.admins.linked} / 未关联 {stats.admins.unlinked}
                </div>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xs text-gray-500 mb-1">关联率</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: stats.admins.link_rate || '0%' }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">{stats.admins.link_rate || '0%'}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-purple-500" />
              <div>
                <div className="text-sm text-gray-500">班级数据</div>
                <div className="text-xl font-bold">{stats.classes.total}</div>
                <div className="text-xs text-gray-400">
                  学生使用 {stats.classes.used_by_users} / 教师使用 {stats.classes.used_by_admins}
                </div>
              </div>
            </div>
            {stats.classes.missing > 0 && (
              <div className="mt-2 text-xs text-orange-500">
                缺失 {stats.classes.missing} 个班级
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-8 h-8 ${issues.length > 0 ? 'text-yellow-500' : 'text-green-500'}`} />
              <div>
                <div className="text-sm text-gray-500">一致性状态</div>
                <div className="text-xl font-bold">{issues.length} 问题</div>
                <div className="text-xs text-gray-400">
                  AdminClass 关联: {stats.admin_class_links}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Missing Classes */}
      {stats && stats.missing_classes && stats.missing_classes.length > 0 && (
        <div className="bg-orange-50 rounded-xl p-4 mb-6 border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <span className="font-semibold text-orange-700">缺失的班级</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.missing_classes.map((cls, idx) => (
              <span key={idx} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                {cls}
              </span>
            ))}
          </div>
          <p className="text-sm text-orange-600 mt-2">
            点击"执行修复"将自动创建这些班级并建立关联
          </p>
        </div>
      )}

      {/* Issues List */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b">
          <h2 className="font-semibold">发现的问题</h2>
        </div>
        <div className="p-4">
          {issues.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p>数据一致性良好，未发现问题</p>
            </div>
          ) : (
            <div className="space-y-2">
              {issues.slice(0, 20).map((issue, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${severityColors[issue.severity]}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {severityIcons[issue.severity]} {issue.type}
                    </span>
                    <span className="text-xs opacity-75">{issue.model} ID:{issue.id}</span>
                  </div>
                  <div className="text-sm mt-1">{issue.message}</div>
                </div>
              ))}
              {issues.length > 20 && (
                <div className="text-center text-gray-500 py-2">
                  还有 {issues.length - 20} 个问题未显示
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-6 bg-gray-50 rounded-xl p-4 border">
        <h3 className="font-semibold text-gray-700 mb-2">关于数据关联</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• 学生 (User) 的 class_name 字段现在通过 class_info_id 外键关联到 ClassInfo 表</li>
          <li>• 管理员 (Admin) 的 class_name 字段现在通过 primary_class_id 外键关联到 ClassInfo 表</li>
          <li>• 子账号 (SubAccount) 通过父级管理员继承班级关联</li>
          <li>• 班级名称变更时会自动同步更新关联数据</li>
          <li>• 系统每小时自动检查一次数据一致性</li>
        </ul>
      </div>
    </div>
  );
};

export default DataSyncPage;
