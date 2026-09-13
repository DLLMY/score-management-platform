// T12-5 拆分（2026-09-12）：自 PermissionManagementView.tsx 原样搬出，行为逐字节等价。
import { Users, School, Crown, Shield } from 'lucide-react';
import type { PermissionManagementViewProps } from '../types';

export function TabNav({ activeTab, setActiveTab }: PermissionManagementViewProps) {
  return (
    <>
      <div className='border-b border-gray-200'>
        <nav className='flex space-x-8'>
          {/* 用户管理 */}
          <button
            onClick={() => setActiveTab('admins')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'admins'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className='flex items-center space-x-2'>
              <Users className='w-5 h-5' />
              <span>用户管理</span>
            </div>
          </button>

          {/* 班级管理 */}
          <button
            onClick={() => setActiveTab('classes')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'classes'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className='flex items-center space-x-2'>
              <School className='w-5 h-5' />
              <span>班级管理</span>
            </div>
          </button>

          {/* 角色管理 */}
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'roles'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className='flex items-center space-x-2'>
              <Crown className='w-5 h-5' />
              <span>角色管理</span>
            </div>
          </button>

          {/* 权限管理 */}
          <button
            onClick={() => setActiveTab('permissions')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'permissions'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className='flex items-center space-x-2'>
              <Shield className='w-5 h-5' />
              <span>权限管理</span>
            </div>
          </button>

          {/* 权限日志 */}
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'logs'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className='flex items-center space-x-2'>
              <Shield className='w-5 h-5' />
              <span>权限日志</span>
            </div>
          </button>
        </nav>
      </div>
    </>
  );
}
