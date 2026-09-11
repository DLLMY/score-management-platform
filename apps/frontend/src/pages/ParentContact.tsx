import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import type { ParentContact, ParentContactCreateInput, ContactLog } from '../types';
import { useStableToast, useSubmitGuard, useWorkbenchClass, useListFetch } from '../hooks';
import { useConfirm } from '../components';
import ParentContactView, { ContactFormData, LogFormData } from './parentContact/ParentContactView';

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
  const [contactPage, setContactPage] = useState(1);
  // 共享 busy：列表/表单提交（列表 loading 走 useListFetch 输出）
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<ContactLog[]>([]);
  const [selectedContact, setSelectedContact] = useState<ParentContact | null>(null);
  const [expandedContactId, setExpandedContactId] = useState<number | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [contactForm, setContactForm] = useState<ContactFormData>(defaultContactForm);
  const [logForm, setLogForm] = useState<LogFormData>(defaultLogForm);
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  // 家长联系含电话号码等隐私字段，筛选范围由后端 class_id 隔离（见 parent_service.list_contacts）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();
  const { showToast } = useStableToast();
  const { submitting, run: runSubmit } = useSubmitGuard();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;

  // A 轨：家长联系人列表迁 useListFetch（class_id 服务端过滤 + 分页，失败 toast 保留）
  const contacts = useListFetch<ParentContact>({
    params: { page: contactPage, pageSize: 50, classId: filterClassId },
    fetcher: async ({ page, pageSize, classId }) => {
      try {
        const resp = await api.parent.getAll(undefined, classId ? Number(classId) : undefined, {
          page,
          per_page: pageSize,
        });
        return { items: resp.contacts ?? [], total: resp.total ?? 0 };
      } catch (error) {
        logger.error('获取家长联系人列表失败:', error);
        showToast('error', getErrMsg(error, '获取家长联系人列表失败'));
        throw error;
      }
    },
  });
  // 既有新增/编辑等 handler 仍以 fetchContacts 命名调用（语义 = 重新拉取当前页）
  const fetchContacts = useCallback(() => {
    void contacts.refetch();
  }, [contacts]);

  const fetchContactLogs = useCallback(
    async (parentId: number) => {
      try {
        const resp = await api.parent.getContactLogs(parentId);
        setLogs((prev) => {
          const filtered = prev.filter((l) => l.parent_id !== parentId);
          return [...filtered, ...(resp.logs || [])];
        });
      } catch (error) {
        logger.error('获取联系日志失败:', error);
        showToast('error', getErrMsg(error, '获取联系日志失败'));
      }
    },
    [showToast]
  );

  // M9 P1: 切换班级筛选时重置家长联系人分页到首页
  useEffect(() => {
    setContactPage(1);
  }, [filterClassId]);

  const toggleExpand = useCallback(
    async (contact: ParentContact) => {
      if (expandedContactId === contact.id) {
        setExpandedContactId(null);
        setSelectedContact(null);
      } else {
        setExpandedContactId(contact.id);
        setSelectedContact(contact);
        await fetchContactLogs(contact.id);
      }
    },
    [expandedContactId, fetchContactLogs]
  );

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
      showToast('warning', '请选择学生');
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
      logger.error('操作失败:', error);
      showToast(
        'error',
        getErrMsg(error, editingContactId ? '更新联系方式失败' : '添加联系方式失败')
      );
    } finally {
      setIsLoading(false);
    }
  }, [contactForm, editingContactId, showToast, fetchContacts]);

  const handleDeleteContact = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        message: '确定要删除这位家长的联系方式吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      setIsLoading(true);
      try {
        await api.parent.delete(id);
        showToast('success', '家长联系方式删除成功');
        setExpandedContactId(null);
        setSelectedContact(null);
        fetchContacts();
      } catch (error) {
        logger.error('删除失败:', error);
        showToast('error', getErrMsg(error, '删除联系方式失败'));
      } finally {
        setIsLoading(false);
      }
    },
    [showToast, fetchContacts]
  );

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
      setLogs((prev) => [...prev, result]);
      setShowLogModal(false);
      setLogForm(defaultLogForm);
    } catch (error) {
      logger.error('添加联系日志失败:', error);
      showToast('error', getErrMsg(error, '添加联系日志失败'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedContact, logForm, showToast]);

  const totalLogs = logs.length;
  const resolvedLogs = logs.filter((l) => l.is_resolved).length;

  return (
    <ParentContactView
      contacts={contacts}
      isLoading={isLoading}
      logs={logs}
      selectedContact={selectedContact}
      expandedContactId={expandedContactId}
      showContactModal={showContactModal}
      showLogModal={showLogModal}
      editingContactId={editingContactId}
      contactForm={contactForm}
      logForm={logForm}
      filterClassId={filterClassId}
      submitting={submitting}
      setFilterClassId={setFilterClassId}
      openCreateContactModal={openCreateContactModal}
      toggleExpand={toggleExpand}
      openEditContactModal={openEditContactModal}
      openAddLogModal={openAddLogModal}
      handleDeleteContact={handleDeleteContact}
      handleContactSubmit={handleContactSubmit}
      handleAddLog={handleAddLog}
      setContactForm={setContactForm}
      setLogForm={setLogForm}
      setShowContactModal={setShowContactModal}
      setShowLogModal={setShowLogModal}
      contactPage={contactPage}
      setContactPage={setContactPage}
      runSubmit={runSubmit}
      totalLogs={totalLogs}
      resolvedLogs={resolvedLogs}
    />
  );
}

export default ParentContactPage;
