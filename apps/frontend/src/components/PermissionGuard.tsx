import React, { useState, useEffect } from 'react';
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
  const {
    permissions,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    roles,
    reload,
    error,
  } = usePermissions();
  const location = useLocation();
  const [stuck, setStuck] = useState(false);

  // 加载超时保护：避免任何异常导致永久转圈
  useEffect(() => {
    if (!isLoading) {
      setStuck(false);
      return;
    }
    const timer = setTimeout(() => setStuck(true), 12000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  const isSuperAdmin = roles.some((role) => ADMIN_ROLES.includes(role));

  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // 加载中：短暂转圈；超过 12s 仍未完成则给出可操作的恢复界面
  if (isLoading || stuck) {
    const timedOut = stuck && isLoading;
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900'>
        <div className='text-center max-w-md px-4'>
          <div className='w-8 h-8 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3'></div>
          <p className='text-sm text-gray-500 dark:text-slate-400 mb-4'>
            {timedOut ? '权限加载超时，请重试或重新登录' : '加载权限...'}
          </p>
          {timedOut && (
            <div className='flex justify-center gap-2'>
              <button
                onClick={() => {
                  setStuck(false);
                  reload();
                }}
                className='px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors'
              >
                重新加载
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('admin');
                  window.location.href = '/login';
                }}
                className='px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 transition-colors'
              >
                重新登录
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!permissions || permissions.length === 0) {
    const adminStr = localStorage.getItem('admin');
    if (adminStr) {
      // 已登录但权限为空：绝不无限转圈，给出可操作的恢复界面
      return (
        <div
          className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4'
          role='alert'
          aria-live='polite'
        >
          <div className='text-center max-w-md'>
            <div className='text-amber-400 text-5xl mb-4' aria-hidden='true'>
              ⚠️
            </div>
            <h2 className='text-xl font-bold text-gray-800 dark:text-white mb-2'>
              权限加载未完成
            </h2>
            <p className='text-gray-500 dark:text-slate-400 mb-1'>
              当前账号未获取到有效权限，可能是本地缓存异常或接口返回为空。
            </p>
            {error && (
              <p className='text-xs text-red-400 mb-4 break-words'>{error.message}</p>
            )}
            <div className='flex justify-center gap-2'>
              <button
                onClick={() => reload()}
                className='px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors'
              >
                重新加载权限
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('admin');
                  window.location.href = '/login';
                }}
                className='px-6 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 transition-colors'
              >
                重新登录
              </button>
            </div>
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
      role='alert'
      aria-live='polite'
      aria-label='权限不足提示'
    >
      <div className='text-center max-w-md'>
        <div className='text-red-400 text-6xl mb-4' aria-hidden='true'>
          🚫
        </div>
        <h2 className='text-xl font-bold text-gray-800 dark:text-white mb-2'>权限不足</h2>
        <p className='text-gray-500 dark:text-slate-400 mb-4'>您没有权限访问此页面</p>
        <button
          onClick={() => window.history.back()}
          className='px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors'
          aria-label='返回上一页'
        >
          返回上一页
        </button>
      </div>
    </div>
  );
}

interface ButtonProps {
  children: React.ReactNode;
  variant?:
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'blue'
    | 'purple'
    | 'outline'
    | 'ghost'
    | 'link';
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
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading, isSuperAdmin } =
    usePermissions();

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
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
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
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading, isSuperAdmin } =
    usePermissions();

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
    hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);
  }

  if (!hasAccess) {
    return fallback;
  }

  return <>{children}</>;
};

export default PermissionGuard;
