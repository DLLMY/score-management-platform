import { CheckCircle, XCircle } from 'lucide-react';
import type { ColumnType } from '../../components';
import { formatDateTime } from '../../utils/format';
import type { Admin } from '../../types';
import type { ClassInfo } from '../../services/api';
import type { Permission, RoleWithPermissions } from '../../services/rbacApi';
import type { PermissionLog } from './types';

export const getRoleLabel = (role: string): string => {
  const roles: Record<string, string> = {
    super_admin: '超级管理员',
    admin: '管理员',
    teacher: '班主任',
    subject_teacher: '任课教师',
    dashboard: '数据大屏用户',
    dashboard_viewer: '数据大屏用户',
    head_teacher: '年级组长',
    viewer: '查看者',
    operator: '运维人员',
  };
  return roles[role] || role;
};

export const getRoleBadgeColor = (role: string): string => {
  const colors: Record<string, string> = {
    super_admin: 'bg-red-100 text-red-800',
    admin: 'bg-pink-100 text-pink-800',
    teacher: 'bg-blue-100 text-blue-800',
    subject_teacher: 'bg-green-100 text-green-800',
    dashboard: 'bg-purple-100 text-purple-800',
    dashboard_viewer: 'bg-purple-100 text-purple-800',
    head_teacher: 'bg-orange-100 text-orange-800',
    viewer: 'bg-gray-100 text-gray-800',
    operator: 'bg-cyan-100 text-cyan-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
};

export const PERMISSION_CATEGORIES: { value: string; label: string }[] = [
  { value: '', label: '全部分类' },
  { value: '学生管理', label: '学生管理' },
  { value: '教务管理', label: '教务管理' },
  { value: '积分管理', label: '积分管理' },
  { value: '设备管理', label: '设备管理' },
  { value: '成绩管理', label: '成绩管理' },
  { value: '数据分析', label: '数据分析' },
  { value: '通知中心', label: '通知中心' },
  { value: '系统管理', label: '系统管理' },
  { value: '班主任工作台', label: '班主任工作台' },
  // 兼容后端RBAC返回的英文category值
  { value: 'homework', label: '班主任工作台·作业' },
  { value: 'attendance', label: '班主任工作台·考勤' },
  { value: 'mental_health', label: '班主任工作台·心理' },
  { value: 'activity', label: '班主任工作台·活动' },
  { value: 'study_group', label: '班主任工作台·学习小组' },
  { value: 'study_guide', label: '班主任工作台·学法指导' },
];

export const createAdminColumns = (
  adminRolesMap: Record<number, string[]>,
  roles: RoleWithPermissions[]
): ColumnType<Admin>[] => [
  {
    title: '用户',
    key: 'user',
    dataIndex: 'real_name',
    width: 200,
    render: (_, admin) => (
      <div className='flex items-center'>
        <div className='flex-shrink-0 h-10 w-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center'>
          <span className='text-white font-bold'>{(admin.real_name || admin.username)[0]}</span>
        </div>
        <div className='ml-4'>
          <div className='text-sm font-medium text-gray-900'>{admin.real_name}</div>
          <div className='text-sm text-gray-500'>{admin.username}</div>
        </div>
      </div>
    ),
  },
  {
    title: '角色',
    key: 'roles',
    width: 220,
    render: (_, admin) => (
      <div className='flex flex-wrap gap-1'>
        {adminRolesMap[admin.id]?.map((roleCode) => {
          const role = roles.find((r) => r.role_code === roleCode);
          const roleName = role?.role_name || getRoleLabel(roleCode);
          const colorClass = getRoleBadgeColor(roleCode);
          return (
            <span
              key={roleCode}
              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClass}`}
            >
              {roleName}
            </span>
          );
        }) || (
          <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
              admin.role
            )}`}
          >
            {getRoleLabel(admin.role)}
          </span>
        )}
      </div>
    ),
  },
  {
    title: '状态',
    key: 'status',
    dataIndex: 'is_active',
    width: 80,
    render: (value) =>
      value ? (
        <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800'>
          启用
        </span>
      ) : (
        <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-600'>
          禁用
        </span>
      ),
  },
  {
    title: '班级',
    key: 'class_name',
    dataIndex: 'class_name',
    width: 120,
    render: (value) => <span className='text-sm text-gray-500'>{String(value || '-')}</span>,
  },
  {
    title: '电话',
    key: 'phone',
    dataIndex: 'phone',
    width: 130,
    render: (value) => <span className='text-sm text-gray-500'>{String(value || '-')}</span>,
  },
];

export const createClassColumns = (): ColumnType<ClassInfo>[] => [
  {
    title: '班级名称',
    key: 'name',
    dataIndex: 'name',
    width: 180,
    render: (value) => <div className='text-sm font-medium text-gray-900'>{value as string}</div>,
  },
  {
    title: '年级',
    key: 'grade',
    dataIndex: 'grade',
    width: 120,
    render: (value) => <span className='text-sm text-gray-500'>{String(value || '-')}</span>,
  },
  {
    title: '描述',
    key: 'description',
    dataIndex: 'description',
    render: (value) => <span className='text-sm text-gray-500'>{String(value || '-')}</span>,
  },
  {
    title: '状态',
    key: 'status',
    dataIndex: 'is_active',
    width: 100,
    render: (value) =>
      value !== false ? (
        <span className='flex items-center text-green-600'>
          <CheckCircle className='w-5 h-5' />
          <span className='ml-1 text-sm'>启用</span>
        </span>
      ) : (
        <span className='flex items-center text-red-600'>
          <XCircle className='w-5 h-5' />
          <span className='ml-1 text-sm'>禁用</span>
        </span>
      ),
  },
];

export const createRoleColumns = (): ColumnType<RoleWithPermissions>[] => [
  {
    title: '角色名称',
    key: 'role_name',
    dataIndex: 'role_name',
    width: 200,
    render: (_, role) => (
      <div>
        <div className='font-medium text-gray-900'>{role.role_name}</div>
        {role.description && <div className='text-sm text-gray-500'>{role.description}</div>}
      </div>
    ),
  },
  {
    title: '角色代码',
    key: 'role_code',
    dataIndex: 'role_code',
    width: 140,
    render: (value) => <span className='text-sm text-gray-500 font-mono'>{value as string}</span>,
  },
  {
    title: '权限数量',
    key: 'permission_count',
    width: 100,
    render: (_, role) => (
      <span className='px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800'>
        {role.permissions?.length || 0}
      </span>
    ),
  },
  {
    title: '状态',
    key: 'status',
    dataIndex: 'is_active',
    width: 80,
    render: (value) => (
      <span
        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
          value ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}
      >
        {value ? '启用' : '禁用'}
      </span>
    ),
  },
];

export const createLogColumns = (): ColumnType<PermissionLog>[] => [
  {
    title: '操作',
    key: 'action',
    dataIndex: 'action',
    width: 120,
    render: (value) => {
      const action = value as string;
      return (
        <span
          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            action.includes('创建')
              ? 'bg-green-100 text-green-800'
              : action.includes('删除')
              ? 'bg-red-100 text-red-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {action}
        </span>
      );
    },
  },
  {
    title: '目标类型',
    key: 'target_type',
    dataIndex: 'target_type',
    width: 120,
    render: (value) => <span className='text-sm text-gray-500'>{value as string}</span>,
  },
  {
    title: '描述',
    key: 'description',
    dataIndex: 'description',
    render: (value) => <span className='text-sm text-gray-500'>{value as string}</span>,
  },
  {
    title: 'IP地址',
    key: 'ip_address',
    dataIndex: 'ip_address',
    width: 150,
    render: (value) => <span className='text-sm text-gray-500 font-mono'>{value as string}</span>,
  },
  {
    title: '时间',
    key: 'created_at',
    dataIndex: 'created_at',
    width: 180,
    render: (value) => (
      <span className='text-sm text-gray-500'>{formatDateTime(value as string)}</span>
    ),
  },
];

// 派生计算：权限过滤 + 分组（纯函数，逻辑层 useMemo 调用）
export const filterPermissions = (
  permissions: Permission[],
  filter: { category: string; search: string }
): Permission[] =>
  permissions.filter((p) => {
    if (filter.category && p.category !== filter.category) {
      return false;
    }
    if (filter.search) {
      const search = filter.search.toLowerCase();
      return (
        p.name.toLowerCase().includes(search) ||
        p.code.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search) ||
        false
      );
    }
    return true;
  });

export const groupPermissions = (permissions: Permission[]): Record<string, Permission[]> =>
  permissions.reduce((acc, p) => {
    const cat = p.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);
