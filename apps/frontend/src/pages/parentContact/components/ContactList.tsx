// T12-6 拆分（2026-09-12）：自 ParentContactView.tsx 原样搬出，行为逐字节等价。
import {
  User,
  MessageCircle,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Phone,
  Mail,
  MapPin,
  FileText,
  Calendar,
  Check,
} from 'lucide-react';
import { LoadingSpinner, EmptyState } from '../../../components';
import { Pagination } from 'antd';
import { formatDateTime } from '../../../utils/format';
import { getContactTypeLabel } from '../constants';
import type { ParentContactViewProps } from '../types';

export function ContactList({
  contacts,
  logs,
  filterClassId,
  openCreateContactModal,
  expandedContactId,
  toggleExpand,
  openAddLogModal,
  openEditContactModal,
  handleDeleteContact,
  contactPage,
  setContactPage,
}: ParentContactViewProps) {
  const getLogsForContact = (parentId: number) => {
    return logs.filter((l) => l.parent_id === parentId);
  };

  return (
    <>
      <div className='flex-1 px-6 pb-6 overflow-auto'>
        {contacts.loading && contacts.items.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full gap-3'>
            <LoadingSpinner text='加载中...' />
          </div>
        ) : contacts.items.length === 0 ? (
          <EmptyState
            icon='users'
            title={filterClassId > 0 ? '该班级暂无家长联系方式' : '暂无家长联系方式'}
            description='还没有家长联系方式'
            actionLabel='添加第一位家长'
            onAction={openCreateContactModal}
          />
        ) : (
          <div className='space-y-4'>
            {contacts.items.map((contact) => {
              const isExpanded = expandedContactId === contact.id;
              const contactLogs = getLogsForContact(contact.id);

              return (
                <div
                  key={contact.id}
                  className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'
                >
                  <div
                    className='px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors'
                    onClick={() => toggleExpand(contact)}
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-4'>
                        <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center'>
                          <User className='w-6 h-6 text-white' />
                        </div>
                        <div>
                          <h3 className='font-semibold text-slate-800 dark:text-slate-100'>
                            {contact.student_name || `学生${contact.student_id}`}
                          </h3>
                          <div className='flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1'>
                            {contact.father_name && (
                              <span className='flex items-center gap-1'>
                                <User className='w-3 h-3' />
                                父亲: {contact.father_name}
                              </span>
                            )}
                            {contact.mother_name && (
                              <span className='flex items-center gap-1'>
                                <User className='w-3 h-3' />
                                母亲: {contact.mother_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className='flex items-center gap-2'>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddLogModal(contact);
                          }}
                          className='flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-md transition-all text-xs font-medium'
                        >
                          <MessageCircle className='w-3 h-3' />
                          记录日志
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditContactModal(contact);
                          }}
                          aria-label={`编辑家长 ${
                            contact.student_name || `学生${contact.student_id}`
                          }`}
                          className='p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all'
                        >
                          <Edit2 className='w-4 h-4' />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteContact(contact.id);
                          }}
                          aria-label={`删除家长 ${
                            contact.student_name || `学生${contact.student_id}`
                          }`}
                          className='p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className='w-5 h-5 text-slate-400' />
                        ) : (
                          <ChevronDown className='w-5 h-5 text-slate-400' />
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className='px-5 pb-5 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50'>
                      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 py-4'>
                        {contact.father_phone && (
                          <div className='flex items-center gap-2 text-sm'>
                            <Phone className='w-4 h-4 text-slate-400' />
                            <span className='text-slate-500 dark:text-slate-400'>父亲电话:</span>
                            <span className='font-medium text-slate-700 dark:text-slate-300'>
                              {contact.father_phone}
                            </span>
                          </div>
                        )}
                        {contact.mother_phone && (
                          <div className='flex items-center gap-2 text-sm'>
                            <Phone className='w-4 h-4 text-slate-400' />
                            <span className='text-slate-500 dark:text-slate-400'>母亲电话:</span>
                            <span className='font-medium text-slate-700 dark:text-slate-300'>
                              {contact.mother_phone}
                            </span>
                          </div>
                        )}
                        {contact.email && (
                          <div className='flex items-center gap-2 text-sm'>
                            <Mail className='w-4 h-4 text-slate-400' />
                            <span className='text-slate-500 dark:text-slate-400'>邮箱:</span>
                            <span className='font-medium text-slate-700 dark:text-slate-300'>
                              {contact.email}
                            </span>
                          </div>
                        )}
                        {contact.address && (
                          <div className='flex items-center gap-2 text-sm md:col-span-2'>
                            <MapPin className='w-4 h-4 text-slate-400' />
                            <span className='text-slate-500 dark:text-slate-400'>地址:</span>
                            <span className='font-medium text-slate-700 dark:text-slate-300'>
                              {contact.address}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className='border-t border-slate-200/50 dark:border-slate-700/50 pt-4'>
                        <h4 className='text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2'>
                          <FileText className='w-4 h-4' />
                          联系日志 ({contactLogs.length})
                        </h4>
                        {contactLogs.length === 0 ? (
                          <p className='text-sm text-slate-400 dark:text-slate-500 text-center py-4'>
                            暂无联系记录
                          </p>
                        ) : (
                          <div className='space-y-2 max-h-48 overflow-y-auto'>
                            {contactLogs.map((log) => (
                              <div
                                key={log.id}
                                className={`p-3 rounded-xl border ${
                                  log.is_resolved
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <div className='flex items-center justify-between'>
                                  <div className='flex items-center gap-2'>
                                    <span className='inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'>
                                      {getContactTypeLabel(log.contact_type)}
                                    </span>
                                    <span className='text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1'>
                                      <Calendar className='w-3 h-3' />
                                      {formatDateTime(log.contact_time)}
                                    </span>
                                  </div>
                                  {log.is_resolved ? (
                                    <span className='text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1'>
                                      <Check className='w-3 h-3' />
                                      已跟进
                                    </span>
                                  ) : log.follow_up_needed ? (
                                    <span className='text-xs text-amber-600 dark:text-amber-400'>
                                      待跟进
                                    </span>
                                  ) : null}
                                </div>
                                {log.content && (
                                  <p className='mt-2 text-sm text-slate-700 dark:text-slate-300'>
                                    {log.content}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {contacts.total > 50 && (
          <div className='mt-5 flex justify-center'>
            <Pagination
              current={contactPage}
              total={contacts.total}
              pageSize={50}
              onChange={(p) => setContactPage(p)}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>
    </>
  );
}
