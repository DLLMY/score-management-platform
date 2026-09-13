// T12-6 拆分（2026-09-12）：常量自 ParentContactView.tsx 原样搬出。
export const CONTACT_TYPES = [
  { value: 'phone', label: '电话沟通' },
  { value: 'meeting', label: '面谈' },
  { value: 'message', label: '消息/短信' },
  { value: 'email', label: '邮件' },
  { value: 'other', label: '其他' },
];

export const getContactTypeLabel = (value: string) => {
  return CONTACT_TYPES.find((t) => t.value === value)?.label || value;
};
