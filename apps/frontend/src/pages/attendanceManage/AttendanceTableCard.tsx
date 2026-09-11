import { Pagination } from 'antd';
import { Search, Filter } from 'lucide-react';
import { DataTable, type ColumnType } from '../../components';
import { Attendance } from '../../types';

interface AttendanceTableCardProps {
  columns: ColumnType<Attendance>[];
  filteredAttendances: Attendance[];
  isLoading: boolean;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  attendancePage: number;
  attendanceTotal: number;
  setAttendancePage: (p: number) => void;
}

export default function AttendanceTableCard({
  columns,
  filteredAttendances,
  isLoading,
  searchTerm,
  setSearchTerm,
  filterStatus,
  setFilterStatus,
  attendancePage,
  attendanceTotal,
  setAttendancePage,
}: AttendanceTableCardProps) {
  return (
    <div className='flex-1 px-6 pb-6'>
      <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
        <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800'>
          <div className='flex items-center gap-4 flex-wrap'>
            <div className='relative flex-1 max-w-md'>
              <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400' />
              <input
                type='text'
                aria-label='搜索考勤记录'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder='搜索学生姓名或日期...'
                className='w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm'
              />
            </div>
            <div className='relative'>
              <Filter className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className='pl-9 pr-8 py-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm appearance-none'
              >
                <option value=''>全部状态</option>
                <option value='present'>出勤</option>
                <option value='absent'>缺勤</option>
                <option value='late'>迟到</option>
                <option value='leave'>请假</option>
              </select>
            </div>
          </div>
        </div>

        <DataTable<Attendance>
          columns={columns}
          dataSource={filteredAttendances}
          loading={isLoading}
          rowKey='id'
          empty={{
            icon: 'data',
            title: '暂无考勤数据',
          }}
        />
        {attendanceTotal > 50 && (
          <div className='px-5 py-4 flex justify-center border-t border-slate-200/50 dark:border-slate-700/50'>
            <Pagination
              current={attendancePage}
              total={attendanceTotal}
              pageSize={50}
              onChange={(p) => setAttendancePage(p)}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
