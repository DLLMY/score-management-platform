/**
 * 用户列表页面组件（装配层）。
 *
 * 全部 state / reducer / effect / handler / 列定义已抽到 ./userList/useUserListLogic；
 * 本文件仅做「hook → UserListView」的渲染装配。
 */

import { default as UserListView } from './userList/UserListView';
import { useUserListLogic } from './userList/useUserListLogic';

function UserList() {
  const props = useUserListLogic();
  const { state } = props;

  if (state.isLoading) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='h-8 bg-gray-200 rounded w-48 animate-pulse' />
            <div className='h-4 bg-gray-200 rounded w-64 mt-2 animate-pulse' />
          </div>
          <div className='flex gap-2'>
            <div className='h-10 bg-gray-200 rounded w-28 animate-pulse' />
            <div className='h-10 bg-gray-200 rounded w-28 animate-pulse' />
            <div className='h-10 bg-gray-200 rounded w-28 animate-pulse' />
          </div>
        </div>
        <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-4'>
          <div className='h-12 bg-gray-200 rounded mb-4 animate-pulse' />
        </div>
      </div>
    );
  }

  return <UserListView {...props} />;
}

export default UserList;
