import type { Dispatch, SetStateAction } from 'react';
import { Users, Shield, School, Plus, Edit2, Trash2, UserPlus, Crown } from 'lucide-react';
import {
  Card,
  Button,
  Modal,
  LoadingSpinner,
  SearchFilter,
  PermissionButton,
  DataTable,
  Pagination,
  type ColumnType,
} from '../../components';
import type { Admin, UserRole } from '../../types';
import type { ClassInfo } from '../../services/api';
import type { Permission, RoleWithPermissions } from '../../services/rbacApi';
import type {
  PermissionLog,
  AdminFormData,
  ClassFormData,
  RoleFormData,
  PermissionFormData,
} from './types';
import { PERMISSION_CATEGORIES } from './helpers';

export interface PermissionManagementViewProps {
  loading: boolean;
  activeTab: string;
  setActiveTab: Dispatch<SetStateAction<string>>;

  // admins
  admins: Admin[];
  adminColumns: ColumnType<Admin>[];
  handleCreateAdmin: () => void;
  handleEditAdmin: (admin: Admin) => void;
  handleOpenRoleAssign: (admin: Admin) => void;
  handleDeleteAdmin: (admin: Admin) => void;

  // classes
  classes: ClassInfo[];
  classColumns: ColumnType<ClassInfo>[];
  handleCreateClass: () => void;
  handleEditClass: (cls: ClassInfo) => void;
  handleDeleteClass: (cls: ClassInfo) => void;

  // roles
  roles: RoleWithPermissions[];
  roleColumns: ColumnType<RoleWithPermissions>[];
  handleOpenCreateRole: () => void;
  handleOpenEditRole: (role: RoleWithPermissions) => void;
  handleDeleteRole: (role: RoleWithPermissions) => void;

  // permissions
  permissionFilter: { category: string; search: string };
  setPermissionFilter: Dispatch<SetStateAction<{ category: string; search: string }>>;
  groupedPermissions: Record<string, Permission[]>;
  handleOpenCreatePermission: () => void;
  handleOpenEditPermission: (permission: Permission) => void;
  handleDeletePermission: (permission: Permission) => void;

  // logs
  permissionLogs: PermissionLog[];
  logColumns: ColumnType<PermissionLog>[];
  logPage: number;
  setLogPage: Dispatch<SetStateAction<number>>;
  logTotal: number;
  logPerPage: number;

  // admin modal
  showAdminModal: boolean;
  setShowAdminModal: Dispatch<SetStateAction<boolean>>;
  editingAdmin: Admin | null;
  adminFormData: AdminFormData;
  setAdminFormData: Dispatch<SetStateAction<AdminFormData>>;
  submitting: boolean;
  handleSaveAdmin: () => Promise<void>;
  runSubmit: (fn: () => Promise<void>) => Promise<void>;

  // role assign modal
  showRoleAssignModal: boolean;
  setShowRoleAssignModal: Dispatch<SetStateAction<boolean>>;
  selectedAdminForRoles: Admin | null;
  selectedRolesForAdmin: string[];
  toggleAdminRole: (roleCode: string) => void;
  handleSaveAdminRoles: () => Promise<void>;

  // class modal
  showClassModal: boolean;
  setShowClassModal: Dispatch<SetStateAction<boolean>>;
  editingClass: ClassInfo | null;
  classFormData: ClassFormData;
  setClassFormData: Dispatch<SetStateAction<ClassFormData>>;
  handleSaveClass: () => Promise<void>;

  // role modal
  showRoleModal: boolean;
  setShowRoleModal: Dispatch<SetStateAction<boolean>>;
  isEditingRole: boolean;
  roleFormData: RoleFormData;
  setRoleFormData: Dispatch<SetStateAction<RoleFormData>>;
  availablePermissions: Permission[];
  selectedPermissions: string[];
  togglePermission: (permCode: string) => void;
  handleSaveRole: () => Promise<void>;

  // permission modal
  showPermissionModal: boolean;
  setShowPermissionModal: Dispatch<SetStateAction<boolean>>;
  isEditingPermission: boolean;
  permissionFormData: PermissionFormData;
  setPermissionFormData: Dispatch<SetStateAction<PermissionFormData>>;
  handleSavePermission: () => Promise<void>;
}

export default function PermissionManagementView(props: PermissionManagementViewProps) {
  const {
    loading,
    activeTab,
    setActiveTab,
    admins,
    adminColumns,
    handleCreateAdmin,
    handleEditAdmin,
    handleOpenRoleAssign,
    handleDeleteAdmin,
    classes,
    classColumns,
    handleCreateClass,
    handleEditClass,
    handleDeleteClass,
    roles,
    roleColumns,
    handleOpenCreateRole,
    handleOpenEditRole,
    handleDeleteRole,
    permissionFilter,
    setPermissionFilter,
    groupedPermissions,
    handleOpenCreatePermission,
    handleOpenEditPermission,
    handleDeletePermission,
    permissionLogs,
    logColumns,
    logPage,
    setLogPage,
    logTotal,
    logPerPage,
    showAdminModal,
    setShowAdminModal,
    editingAdmin,
    adminFormData,
    setAdminFormData,
    submitting,
    handleSaveAdmin,
    runSubmit,
    showRoleAssignModal,
    setShowRoleAssignModal,
    selectedAdminForRoles,
    selectedRolesForAdmin,
    toggleAdminRole,
    handleSaveAdminRoles,
    showClassModal,
    setShowClassModal,
    editingClass,
    classFormData,
    setClassFormData,
    handleSaveClass,
    showRoleModal,
    setShowRoleModal,
    isEditingRole,
    roleFormData,
    setRoleFormData,
    availablePermissions,
    selectedPermissions,
    togglePermission,
    handleSaveRole,
    showPermissionModal,
    setShowPermissionModal,
    isEditingPermission,
    permissionFormData,
    setPermissionFormData,
    handleSavePermission,
  } = props;

  if (loading) return <LoadingSpinner />;

  return (
    <div className='space-y-6'>
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>权限管理系统</h1>
          <p className='text-gray-500 mt-1'>管理系统用户、角色和权限</p>
        </div>
      </div>

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

      {/* ========== Admins Tab ========== */}
      {activeTab === 'admins' && (
        <div>
          <div className='flex justify-between items-center mb-4'>
            <h2 className='text-lg font-semibold text-gray-900'>管理员列表</h2>
            <PermissionButton permission='system.users' onClick={handleCreateAdmin}>
              <UserPlus className='w-4 h-4 mr-2' />
              添加管理员
            </PermissionButton>
          </div>

          <Card>
            <DataTable<Admin>
              columns={adminColumns}
              dataSource={admins}
              rowKey='id'
              scroll={{ x: 900 }}
              empty={{
                icon: 'users',
                title: '暂无管理员',
                description: '点击「添加管理员」创建第一个管理员',
              }}
              rowActions={(admin) => (
                <div className='flex items-center justify-end gap-2'>
                  <PermissionButton
                    permission='system.users'
                    variant='secondary'
                    size='sm'
                    onClick={() => handleEditAdmin(admin)}
                  >
                    <Edit2 className='w-4 h-4' />
                  </PermissionButton>
                  <PermissionButton
                    permission='system.roles'
                    variant='outline'
                    size='sm'
                    onClick={() => handleOpenRoleAssign(admin)}
                  >
                    <Crown className='w-4 h-4' />
                  </PermissionButton>
                  {admin.username !== 'admin' && (
                    <PermissionButton
                      permission='system.users'
                      variant='danger'
                      size='sm'
                      onClick={() => handleDeleteAdmin(admin)}
                    >
                      <Trash2 className='w-4 h-4' />
                    </PermissionButton>
                  )}
                </div>
              )}
            />
          </Card>
        </div>
      )}

      {/* ========== Classes Tab ========== */}
      {activeTab === 'classes' && (
        <div>
          <div className='flex justify-between items-center mb-4'>
            <h2 className='text-lg font-semibold text-gray-900'>班级列表</h2>
            <PermissionButton permission='class.manage' onClick={handleCreateClass}>
              <Plus className='w-4 h-4 mr-2' />
              添加班级
            </PermissionButton>
          </div>

          <Card>
            <DataTable<ClassInfo>
              columns={classColumns}
              dataSource={classes}
              rowKey='id'
              scroll={{ x: 720 }}
              empty={{
                icon: 'data',
                title: '暂无班级',
                description: '点击「添加班级」创建第一个班级',
              }}
              rowActions={(cls) => (
                <div className='flex items-center justify-end gap-2'>
                  <PermissionButton
                    permission='class.manage'
                    variant='secondary'
                    size='sm'
                    onClick={() => handleEditClass(cls)}
                  >
                    <Edit2 className='w-4 h-4' />
                  </PermissionButton>
                  <PermissionButton
                    permission='class.manage'
                    variant='danger'
                    size='sm'
                    onClick={() => handleDeleteClass(cls)}
                  >
                    <Trash2 className='w-4 h-4' />
                  </PermissionButton>
                </div>
              )}
            />
          </Card>
        </div>
      )}

      {/* ========== Roles Tab ========== */}
      {activeTab === 'roles' && (
        <div>
          <div className='flex justify-between items-center mb-4'>
            <h2 className='text-lg font-semibold text-gray-900'>角色列表</h2>
            <PermissionButton permission='system.roles' onClick={handleOpenCreateRole}>
              <Plus className='w-4 h-4 mr-2' />
              创建角色
            </PermissionButton>
          </div>

          <Card>
            <DataTable<RoleWithPermissions>
              columns={roleColumns}
              dataSource={roles}
              rowKey='role_code'
              scroll={{ x: 720 }}
              empty={{
                icon: 'data',
                title: '暂无角色',
                description: '点击「创建角色」创建第一个角色',
              }}
              rowActions={(role) => (
                <div className='flex items-center justify-end gap-2'>
                  <PermissionButton
                    permission='system.roles'
                    variant='secondary'
                    size='sm'
                    onClick={() => handleOpenEditRole(role)}
                  >
                    <Edit2 className='w-4 h-4' />
                  </PermissionButton>
                  <PermissionButton
                    permission='system.roles'
                    variant='danger'
                    size='sm'
                    onClick={() => handleDeleteRole(role)}
                  >
                    <Trash2 className='w-4 h-4' />
                  </PermissionButton>
                </div>
              )}
            />
          </Card>
        </div>
      )}

      {/* ========== Permissions Tab ========== */}
      {activeTab === 'permissions' && (
        <div>
          <div className='flex gap-4 mb-4'>
            <SearchFilter
              placeholder='搜索权限...'
              value={permissionFilter.search}
              onChange={(value) => setPermissionFilter((prev) => ({ ...prev, search: value }))}
              className='flex-1'
            />
            <select
              value={permissionFilter.category}
              onChange={(e) =>
                setPermissionFilter((prev) => ({ ...prev, category: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 rounded-lg text-sm'
            >
              <option value=''>全部分类</option>
              {PERMISSION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <PermissionButton permission='system.roles' onClick={handleOpenCreatePermission}>
              <Plus className='w-4 h-4 mr-2' />
              创建权限
            </PermissionButton>
          </div>

          <div className='space-y-6'>
            {Object.entries(groupedPermissions).map(([category, perms]) => (
              <Card key={category}>
                <div className='px-4 py-3 border-b border-gray-200'>
                  <h3 className='font-medium text-gray-900'>
                    {PERMISSION_CATEGORIES.find((c) => c.value === category)?.label || category}
                  </h3>
                </div>
                <div className='divide-y divide-gray-200'>
                  {perms.map((permission) => (
                    <div
                      key={permission.id}
                      className='px-4 py-3 flex items-center justify-between hover:bg-gray-50'
                    >
                      <div>
                        <div className='font-medium text-gray-900'>{permission.name}</div>
                        <div className='text-sm text-gray-500 font-mono'>{permission.code}</div>
                        {permission.description && (
                          <div className='text-sm text-gray-400 mt-1'>{permission.description}</div>
                        )}
                      </div>
                      <div className='flex items-center gap-3'>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            permission.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {permission.is_active ? '启用' : '禁用'}
                        </span>
                        <div className='flex gap-1'>
                          <PermissionButton
                            permission='system.roles'
                            variant='secondary'
                            size='sm'
                            onClick={() => handleOpenEditPermission(permission)}
                          >
                            <Edit2 className='w-4 h-4' />
                          </PermissionButton>
                          <PermissionButton
                            permission='system.roles'
                            variant='danger'
                            size='sm'
                            onClick={() => handleDeletePermission(permission)}
                          >
                            <Trash2 className='w-4 h-4' />
                          </PermissionButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========== Logs Tab ========== */}
      {activeTab === 'logs' && (
        <div>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>权限操作日志</h2>
          <Card>
            <DataTable<PermissionLog>
              columns={logColumns}
              dataSource={permissionLogs}
              rowKey='id'
              scroll={{ x: 800 }}
              empty={{
                icon: 'data',
                title: '暂无权限日志',
                description: '这里还没有任何操作记录',
              }}
            />
            {logTotal > 0 && (
              <Pagination
                currentPage={logPage}
                totalPages={Math.max(1, Math.ceil(logTotal / logPerPage))}
                onPageChange={setLogPage}
                totalItems={logTotal}
                itemsPerPage={logPerPage}
              />
            )}
          </Card>
        </div>
      )}

      {/* ========== Modals ========== */}
      {/* Admin Modal */}
      <Modal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        title={editingAdmin ? '编辑管理员' : '添加管理员'}
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>用户名</label>
            <input
              type='text'
              value={adminFormData.username}
              onChange={(e) => setAdminFormData((prev) => ({ ...prev, username: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              {editingAdmin ? '新密码（留空不修改）' : '密码'}
            </label>
            <input
              type='password'
              value={adminFormData.password || ''}
              onChange={(e) => setAdminFormData((prev) => ({ ...prev, password: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>真实姓名</label>
            <input
              type='text'
              value={adminFormData.real_name}
              onChange={(e) => setAdminFormData((prev) => ({ ...prev, real_name: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>电话</label>
            <input
              type='text'
              value={adminFormData.phone}
              onChange={(e) => setAdminFormData((prev) => ({ ...prev, phone: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>角色（可多选）</label>
            <div className='flex flex-wrap gap-3'>
              {roles
                .filter((r) => r.is_active)
                .map((role) => (
                  <label
                    key={role.role_code}
                    className='flex items-center space-x-2 cursor-pointer'
                  >
                    <input
                      type='checkbox'
                      checked={adminFormData.roles.includes(role.role_code)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setAdminFormData((prev) => ({
                          ...prev,
                          roles: isChecked
                            ? [...prev.roles, role.role_code]
                            : prev.roles.filter((r) => r !== role.role_code),
                          role: (isChecked
                            ? role.role_code
                            : prev.roles.length > 1
                            ? prev.role
                            : 'viewer') as UserRole,
                        }));
                      }}
                      className='w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500'
                    />
                    <span className='text-sm text-gray-700'>{role.role_name}</span>
                  </label>
                ))}
            </div>
            <div className='text-xs text-gray-500 mt-1'>
              已选择 {adminFormData.roles.length} 个角色
            </div>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>班级</label>
            <select
              value={adminFormData.class_name}
              onChange={(e) =>
                setAdminFormData((prev) => ({ ...prev, class_name: e.target.value }))
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            >
              <option value=''>无</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.name}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowAdminModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSaveAdmin)} disabled={submitting}>
              保存
            </Button>
          </div>
        </div>
      </Modal>

      {/* Admin Role Assignment Modal */}
      <Modal
        isOpen={showRoleAssignModal}
        onClose={() => setShowRoleAssignModal(false)}
        title={`为 ${selectedAdminForRoles?.real_name || selectedAdminForRoles?.username} 分配角色`}
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>选择角色</label>
            <div className='border border-gray-200 rounded-lg max-h-64 overflow-y-auto'>
              {roles.length === 0 ? (
                <div className='p-4 text-center text-gray-500 text-sm'>暂无角色可选</div>
              ) : (
                <div className='divide-y divide-gray-100'>
                  {roles.map((role) => (
                    <label
                      key={role.role_code}
                      className='flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer'
                    >
                      <div>
                        <div className='font-medium text-gray-900 text-sm'>{role.role_name}</div>
                        <div className='text-xs text-gray-500 font-mono'>{role.role_code}</div>
                        {role.description && (
                          <div className='text-xs text-gray-400 mt-1'>{role.description}</div>
                        )}
                      </div>
                      <input
                        type='checkbox'
                        checked={selectedRolesForAdmin.includes(role.role_code)}
                        onChange={() => toggleAdminRole(role.role_code)}
                        className='w-4 h-4 text-blue-600 rounded'
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className='text-xs text-gray-500 mt-1'>
              已选择 {selectedRolesForAdmin.length} 个角色
            </div>
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowRoleAssignModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSaveAdminRoles)} disabled={submitting}>
              保存分配
            </Button>
          </div>
        </div>
      </Modal>

      {/* Class Modal */}
      <Modal
        isOpen={showClassModal}
        onClose={() => setShowClassModal(false)}
        title={editingClass ? '编辑班级' : '添加班级'}
      >
        <div className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>班级名称</label>
            <input
              type='text'
              value={classFormData.name}
              onChange={(e) => setClassFormData((prev) => ({ ...prev, name: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>年级</label>
            <input
              type='text'
              value={classFormData.grade}
              onChange={(e) => setClassFormData((prev) => ({ ...prev, grade: e.target.value }))}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>描述</label>
            <textarea
              value={classFormData.description}
              onChange={(e) =>
                setClassFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
              rows={2}
            />
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowClassModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSaveClass)} disabled={submitting}>
              保存
            </Button>
          </div>
        </div>
      </Modal>

      {/* Role Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={isEditingRole ? '编辑角色' : '创建角色'}
        size='lg'
      >
        <div className='space-y-4'>
          {!isEditingRole && (
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                角色代码 <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={roleFormData.role_code}
                onChange={(e) =>
                  setRoleFormData((prev) => ({ ...prev, role_code: e.target.value }))
                }
                placeholder='如: operator'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg'
              />
            </div>
          )}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              角色名称 <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={roleFormData.role_name}
              onChange={(e) => setRoleFormData((prev) => ({ ...prev, role_name: e.target.value }))}
              placeholder='如: 运维人员'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>描述</label>
            <textarea
              value={roleFormData.description}
              onChange={(e) =>
                setRoleFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder='角色描述...'
              rows={2}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>权限分配</label>
            <div className='border border-gray-200 rounded-lg max-h-64 overflow-y-auto'>
              {availablePermissions.length === 0 ? (
                <div className='p-4 text-center text-gray-500 text-sm'>暂无权限可选</div>
              ) : (
                <div className='divide-y divide-gray-100'>
                  {availablePermissions.map((perm) => (
                    <label
                      key={perm.id}
                      className='flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer'
                    >
                      <div>
                        <div className='font-medium text-gray-900 text-sm'>{perm.name}</div>
                        <div className='text-xs text-gray-500 font-mono'>{perm.code}</div>
                      </div>
                      <input
                        type='checkbox'
                        checked={selectedPermissions.includes(perm.code)}
                        onChange={() => togglePermission(perm.code)}
                        className='w-4 h-4 text-blue-600 rounded'
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className='text-xs text-gray-500 mt-1'>
              已选择 {selectedPermissions.length} 个权限
            </div>
          </div>
          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='role-is-active'
              checked={roleFormData.is_active}
              onChange={(e) =>
                setRoleFormData((prev) => ({ ...prev, is_active: e.target.checked }))
              }
              className='w-4 h-4 text-blue-600 rounded'
            />
            <label htmlFor='role-is-active' className='text-sm text-gray-700'>
              启用此角色
            </label>
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowRoleModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSaveRole)} disabled={submitting}>
              保存
            </Button>
          </div>
        </div>
      </Modal>

      {/* Permission Modal */}
      <Modal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title={isEditingPermission ? '编辑权限' : '创建权限'}
      >
        <div className='space-y-4'>
          {!isEditingPermission && (
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                权限代码 <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={permissionFormData.code}
                onChange={(e) =>
                  setPermissionFormData((prev) => ({ ...prev, code: e.target.value }))
                }
                placeholder='如: device.create'
                className='w-full px-3 py-2 border border-gray-300 rounded-lg'
              />
            </div>
          )}
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              权限名称 <span className='text-red-500'>*</span>
            </label>
            <input
              type='text'
              value={permissionFormData.name}
              onChange={(e) => setPermissionFormData((prev) => ({ ...prev, name: e.target.value }))}
              placeholder='如: 创建设备'
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>分类</label>
            <select
              value={permissionFormData.category}
              onChange={(e) =>
                setPermissionFormData((prev) => ({ ...prev, category: e.target.value }))
              }
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            >
              {PERMISSION_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>描述</label>
            <textarea
              value={permissionFormData.description}
              onChange={(e) =>
                setPermissionFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder='权限描述...'
              rows={2}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg'
            />
          </div>
          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='perm-is-active'
              checked={permissionFormData.is_active}
              onChange={(e) =>
                setPermissionFormData((prev) => ({ ...prev, is_active: e.target.checked }))
              }
              className='w-4 h-4 text-blue-600 rounded'
            />
            <label htmlFor='perm-is-active' className='text-sm text-gray-700'>
              启用此权限
            </label>
          </div>
          <div className='flex justify-end gap-3'>
            <Button variant='secondary' onClick={() => setShowPermissionModal(false)}>
              取消
            </Button>
            <Button onClick={() => runSubmit(handleSavePermission)} disabled={submitting}>
              保存
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
