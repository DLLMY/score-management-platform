import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import Button from './ui/Button';
import { ADMIN_ROLES } from '../config/permissions';

interface PermissionGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAll?: boolean;
  fallback?: React.ReactElement | null;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  requiredPermission,
  requiredPermissions,
  requireAll = true,
  fallback,
}) => {
  const { permissions, isLoading, hasPermission, hasAnyPermission, hasAllPermissions, roles } = usePermissions();
  const location = useLocation();

  const isSuperAdmin = roles.some((role) => ADMIN_ROLES.includes(role));

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900'>
        <div className='text-center'>
          <div className='w-8 h-8 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3'></div>
          <p className='text-sm text-gray-500 dark:text-slate-400'>加载权限...</p>
        </div>
      </div>
    );
  }

  if (!permissions || permissions.length === 0) {
    const adminStr = localStorage.getItem('admin');
    if (adminStr) {
      return (
        <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900'>
          <div className='text-center'>
            <div className='w-8 h-8 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3'></div>
            <p className='text-sm text-gray-500 dark:text-slate-400'>加载权限...</p>
          </div>
        </div>
      );
    }
    return <Navigate to='/login' state={{ from: location }} replace />;
  }

  if (requiredPermission) {
    if (!hasPermission(requiredPermission)) {
      return fallback || renderForbidden();
    }
  } else if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAccess = requireAll
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);

    if (!hasAccess) {
      return fallback || renderForbidden();
    }
  }

  return <>{children}</>;
};

function renderForbidden(): React.ReactElement {
  return (
    <div 
      className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4'
      role="alert"
      aria-live="polite"
      aria-label="权限不足提示"
    >
      <div className='text-center max-w-md'>
        <div className='text-red-400 text-6xl mb-4' aria-hidden="true">🚫</div>
        <h2 className='text-xl font-bold text-gray-800 dark:text-white mb-2'>权限不足</h2>
        <p className='text-gray-500 dark:text-slate-400 mb-4'>您没有权限访问此页面</p>
        <button
          onClick={() => window.history.back()}
          className='px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors'
          aria-label="返回上一页"
        >
          返回上一页
        </button>
      </div>
    </div>
  );
}

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'blue' | 'purple' | 'outline' | 'ghost' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  fullWidth?: boolean;
  gradient?: boolean;
  danger?: boolean;
  [props: string]: unknown;
}

interface PermissionButtonProps extends ButtonProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  fallback?: React.ReactElement | null;
}

export const PermissionButton: React.FC<PermissionButtonProps> = ({
  permission,
  permissions,
  requireAll = true,
  children,
  fallback = null,
  ...rest
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading, isSuperAdmin } = usePermissions();

  // 超级管理员直接放行，跳过加载状态检查
  if (isSuperAdmin) {
    return <Button {...rest}>{children}</Button>;
  }

  if (isLoading) {
    // 渲染禁用状态的Button而非span，保持DOM结构一致性
    return (
      <Button disabled loading {...rest}>
        {children}
      </Button>
    );
  }

  let hasAccess = true;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  if (!hasAccess) {
    return fallback;
  }

  return <Button {...rest}>{children}</Button>;
};

interface PermissionViewProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactElement | null;
}

export const PermissionView: React.FC<PermissionViewProps> = ({
  permission,
  permissions,
  requireAll = true,
  children,
  fallback = null,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading, isSuperAdmin } = usePermissions();

  // 超级管理员直接放行
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin'></div>
      </div>
    );
  }

  let hasAccess = true;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  }

  if (!hasAccess) {
    return fallback;
  }

  return <>{children}</>;
};

export default PermissionGuard;
