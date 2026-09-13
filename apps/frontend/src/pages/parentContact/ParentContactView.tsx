// T12-6 拆分（2026-09-12）：本文件退化为布局编排 View；区块组件见 ./components，
// 类型见 ./types，常量见 ./constants；页面装配层见 ../ParentContact。
import { HeaderBar, StatisticsCards, ContactList, ContactModal, LogModal } from './components';
import type { ParentContactViewProps } from './types';

export type { ContactFormData, LogFormData, ParentContactViewProps } from './types';

export default function ParentContactView(props: ParentContactViewProps) {
  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <HeaderBar {...props} />
      <StatisticsCards {...props} />
      <ContactList {...props} />
      <ContactModal {...props} />
      <LogModal {...props} />
    </div>
  );
}
