import { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  Mail,
  MapPin,
  User,
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  MessageCircle,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import api from '../services/api';
import type { ParentContact, ParentContactCreateInput, ContactLog } from '../types';
import { useStableToast } from '../hooks/useStableToast';

interface ContactFormData {
  student_id: number;
  father_name: string;
  father_phone: string;
  mother_name: string;
  mother_phone: string;
  address: string;
  email: string;
}

interface LogFormData {
  contact_type: string;
  content: string;
}

const CONTACT_TYPES = [
  { value: 'phone', label: '电话沟通' },
  { value: 'meeting', label: '面谈' },
  { value: 'message', label: '消息/短信' },
  { value: 'email', label: '邮件' },
  { value: 'other', label: '其他' },
];

const defaultContactForm: ContactFormData = {
  student_id: 0,
  father_name: '',
  father_phone: '',
  mother_name: '',
  mother_phone: '',
  address: '',
  email: '',
};

const defaultLogForm: LogFormData = {
  contact_type: 'phone',
  content: '',
};

function ParentContactPage() {
  const [contacts, setContacts] = useState<ParentContact[]>([]);
  const [logs, setLogs] = useState<ContactLog[]>([]);
  const [selectedContact, setSelectedContact] = useState<ParentContact | null>(null);
  const [expandedContactId, setExpandedContactId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState<ContactFormData>(defaultContactForm);
  const [logForm, setLogForm] = useState<LogFormData>(defaultLogForm);
  const { showToast } = useStableToast();

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.parent.getAll();
      setContacts(data || []);
    } catch (error) {
      console.error('获取家长联系人列表失败:', error);
      showToast('error', '获取家长联系人列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  const fetchContactLogs = useCallback(async (parentId: number) => {
    try {
      const data = await api.parent.getContactLogs(parentId);
      setLogs(prev => {
        const filtered = prev.filter(l => l.parent_id !== parentId);
        return [...filtered, ...(data || [])];
      });
    } catch (error) {
      console.error('获取联系日志失败:', error);
      showToast('error', '获取联系日志失败');
    }
  }, [showToast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const toggleExpand = useCallback(async (contact: ParentContact) => {
    if (expandedContactId === contact.id) {
      setExpandedContactId(null);
      setSelectedContact(null);
    } else {
      setExpandedContactId(contact.id);
      setSelectedContact(contact);
      await fetchContactLogs(contact.id);
    }
  }, [expandedContactId, fetchContactLogs]);

  const openCreateContactModal = useCallback(() => {
    setEditingContactId(null);
    setContactForm(defaultContactForm);
    setShowContactModal(true);
  }, []);

  const openEditContactModal = useCallback((contact: ParentContact) => {
    setEditingContactId(contact.id);
    setContactForm({
      student_id: contact.student_id,
      father_name: contact.father_name || '',
      father_phone: contact.father_phone || '',
      mother_name: contact.mother_name || '',
      mother_phone: contact.mother_phone || '',
      address: contact.address || '',
      email: contact.email || '',
    });
    setShowContactModal(true);
  }, []);

  const handleContactSubmit = useCallback(async () => {
    if (!contactForm.student_id) {
      showToast('warning', '请输入学生 ID');
      return;
    }
    setIsLoading(true);
    try {
      if (editingContactId) {
        await api.parent.update(editingContactId, {
          student_id: contactForm.student_id,
          father_name: contactForm.father_name,
          father_phone: contactForm.father_phone,
          mother_name: contactForm.mother_name,
          mother_phone: contactForm.mother_phone,
          address: contactForm.address,
          email: contactForm.email,
        });
        showToast('success', '家长联系方式更新成功');
      } else {
        const data: ParentContactCreateInput = {
          student_id: contactForm.student_id,
          father_name: contactForm.father_name,
          father_phone: contactForm.father_phone,
          mother_name: contactForm.mother_name,
          mother_phone: contactForm.mother_phone,
          address: contactForm.address,
          email: contactForm.email,
        };
        await api.parent.create(data);
        showToast('success', '家长联系方式添加成功');
      }
      setShowContactModal(false);
      fetchContacts();
    } catch (error) {
      console.error('操作失败:', error);
      showToast('error', editingContactId ? '更新联系方式失败' : '添加联系方式失败');
    } finally {
      setIsLoading(false);
    }
  }, [contactForm, editingContactId, showToast, fetchContacts]);

  const handleDeleteContact = useCallback(async (id: number) => {
    if (!window.confirm('确定要删除这位家长的联系方式吗？')) return;
    setIsLoading(true);
    try {
      await api.parent.delete(id);
      showToast('success', '家长联系方式删除成功');
      setExpandedContactId(null);
      setSelectedContact(null);
      fetchContacts();
    } catch (error) {
      console.error('删除失败:', error);
      showToast('error', '删除联系方式失败');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, fetchContacts]);

  const openAddLogModal = useCallback((contact: ParentContact) => {
    setSelectedContact(contact);
    setLogForm(defaultLogForm);
    setShowLogModal(true);
  }, []);

  const handleAddLog = useCallback(async () => {
    if (!selectedContact || !logForm.content.trim()) {
      showToast('warning', '请输入联系内容');
      return;
    }
    setIsLoading(true);
    try {
      const result = await api.parent.addContactLog(selectedContact.id, {
        contact_type: logForm.contact_type,
        content: logForm.content,
      });
      showToast('success', '联系日志添加成功');
      setLogs(prev => [...prev, result]);
      setShowLogModal(false);
      setLogForm(defaultLogForm);
    } catch (error) {
      console.error('添加联系日志失败:', error);
      showToast('error', '添加联系日志失败');
    } finally {
      setIsLoading(false);
    }
  }, [selectedContact, logForm, showToast]);

  const getContactTypeLabel = useCallback((value: string) => {
    return CONTACT_TYPES.find(t => t.value === value)?.label || value;
  }, []);

  const getLogsForContact = useCallback((parentId: number) => {
    return logs.filter(l => l.parent_id === parentId);
  }, [logs]);

  const totalLogs = logs.length;
  const resolvedLogs = logs.filter(l => l.is_resolved).length;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Phone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text">
                家长联系管理
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">管理家长联系方式、记录沟通日志</p>
            </div>
          </div>
          <button
            onClick={openCreateContactModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium"
          >
            <Plus className="w-5 h-5" />
            添加家长
          </button>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">家长联系人</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{contacts.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">联系日志</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalLogs}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Check className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">已跟进</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{resolvedLogs}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 overflow-auto">
        {isLoading && contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 dark:text-slate-400">加载中...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <Users className="w-10 h-10 text-slate-400" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-lg">暂无家长联系方式</p>
            <button onClick={openCreateContactModal} className="text-cyan-500 hover:text-cyan-600 font-medium">
              添加第一位家长
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {contacts.map((contact) => {
              const isExpanded = expandedContactId === contact.id;
              const contactLogs = getLogsForContact(contact.id);

              return (
                <div
                  key={contact.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden"
                >
                  <div
                    className="px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                    onClick={() => toggleExpand(contact)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                          <User className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                            {contact.student_name || `学生${contact.student_id}`}
                          </h3>
                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {contact.father_name && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                父亲: {contact.father_name}
                              </span>
                            )}
                            {contact.mother_name && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                母亲: {contact.mother_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openAddLogModal(contact); }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:shadow-md transition-all text-xs font-medium"
                        >
                          <MessageCircle className="w-3 h-3" />
                          记录日志
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditContactModal(contact); }}
                          className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteContact(contact.id); }}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        {contact.father_phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500 dark:text-slate-400">父亲电话:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{contact.father_phone}</span>
                          </div>
                        )}
                        {contact.mother_phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500 dark:text-slate-400">母亲电话:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{contact.mother_phone}</span>
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500 dark:text-slate-400">邮箱:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{contact.email}</span>
                          </div>
                        )}
                        {contact.address && (
                          <div className="flex items-center gap-2 text-sm md:col-span-2">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-500 dark:text-slate-400">地址:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{contact.address}</span>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200/50 dark:border-slate-700/50 pt-4">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          联系日志 ({contactLogs.length})
                        </h4>
                        {contactLogs.length === 0 ? (
                          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">暂无联系记录</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {contactLogs.map((log) => (
                              <div
                                key={log.id}
                                className={`p-3 rounded-xl border ${
                                  log.is_resolved
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                      {getContactTypeLabel(log.contact_type)}
                                    </span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {log.contact_time ? new Date(log.contact_time).toLocaleString('zh-CN') : '--'}
                                    </span>
                                  </div>
                                  {log.is_resolved ? (
                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                      <Check className="w-3 h-3" />
                                      已跟进
                                    </span>
                                  ) : log.follow_up_needed ? (
                                    <span className="text-xs text-amber-600 dark:text-amber-400">待跟进</span>
                                  ) : null}
                                </div>
                                {log.content && (
                                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{log.content}</p>
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
      </div>

      {showContactModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowContactModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {editingContactId ? '编辑家长联系方式' : '添加家长联系方式'}
                  </h3>
                </div>
                <button onClick={() => setShowContactModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">学生 ID <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={contactForm.student_id || ''}
                  onChange={(e) => setContactForm({ ...contactForm, student_id: parseInt(e.target.value) || 0 })}
                  placeholder="输入学生 ID"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">父亲姓名</label>
                  <input
                    type="text"
                    value={contactForm.father_name}
                    onChange={(e) => setContactForm({ ...contactForm, father_name: e.target.value })}
                    placeholder="父亲姓名"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">父亲电话</label>
                  <input
                    type="tel"
                    value={contactForm.father_phone}
                    onChange={(e) => setContactForm({ ...contactForm, father_phone: e.target.value })}
                    placeholder="联系电话"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">母亲姓名</label>
                  <input
                    type="text"
                    value={contactForm.mother_name}
                    onChange={(e) => setContactForm({ ...contactForm, mother_name: e.target.value })}
                    placeholder="母亲姓名"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">母亲电话</label>
                  <input
                    type="tel"
                    value={contactForm.mother_phone}
                    onChange={(e) => setContactForm({ ...contactForm, mother_phone: e.target.value })}
                    placeholder="联系电话"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">邮箱</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">地址</label>
                  <input
                    type="text"
                    value={contactForm.address}
                    onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })}
                    placeholder="详细地址"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3">
              <button onClick={() => setShowContactModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium">
                取消
              </button>
              <button
                onClick={handleContactSubmit}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 font-medium disabled:opacity-50"
              >
                <Check className="w-5 h-5" />
                {editingContactId ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogModal && selectedContact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowLogModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-800">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    添加联系日志
                  </h3>
                </div>
                <button onClick={() => setShowLogModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                联系对象: {selectedContact.student_name || `学生${selectedContact.student_id}`} 的家长
              </p>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">联系方式</label>
                <select
                  value={logForm.contact_type}
                  onChange={(e) => setLogForm({ ...logForm, contact_type: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-800 dark:text-slate-100"
                >
                  {CONTACT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">沟通内容 <span className="text-red-500">*</span></label>
                <textarea
                  value={logForm.content}
                  onChange={(e) => setLogForm({ ...logForm, content: e.target.value })}
                  placeholder="记录沟通的主要内容..."
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-slate-800 dark:text-slate-100 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-800 flex items-center justify-end gap-3">
              <button onClick={() => setShowLogModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium">
                取消
              </button>
              <button
                onClick={handleAddLog}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-200 font-medium disabled:opacity-50"
              >
                <Check className="w-5 h-5" />
                保存日志
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ParentContactPage;