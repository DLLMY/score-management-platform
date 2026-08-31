import { useWorkbenchClass, ALL_CLASSES } from '../../hooks/useWorkbenchClass';
import { useClassOptions } from '../form/EntitySelect';

/**
 * 工作台「当前班级」显式展示（P3-4）。
 *
 * 读取工作台共享班级状态 useWorkbenchClass，结合班级列表映射出名称展示。
 * 0（ALL_CLASSES）= 全部班级（不过滤），此时展示「全部班级」。
 *
 * 复用 EntitySelect 的模块级班级缓存（useClassOptions），不会重复请求。
 */
export default function CurrentClassLabel() {
  const [filterClassId] = useWorkbenchClass();
  const classes = useClassOptions();

  const isAll = filterClassId === ALL_CLASSES || filterClassId === 0;
  const current = isAll ? null : classes.find((c) => c.id === filterClassId);
  const label = isAll ? '全部班级' : current ? current.name : `班级 #${filterClassId}`;

  return (
    <span className='mt-1 text-sm text-slate-500 dark:text-slate-400'>
      当前班级：
      <span className='font-medium text-slate-700 dark:text-slate-200'>{label}</span>
    </span>
  );
}
