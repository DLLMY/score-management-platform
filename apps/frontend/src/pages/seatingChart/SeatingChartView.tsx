import type { Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from 'react';
import {
  LayoutGrid,
  Plus,
  Trash2,
  Eye,
  X,
  Check,
  Move,
  Users,
  GraduationCap,
  User,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  ClassSelect,
  CurrentClassLabel,
  WorkbenchBreadcrumb,
  LoadingSpinner,
  EmptyState,
} from '../../components';
import { SeatingChart } from '../../types';

export interface SeatPosition {
  row: number;
  col: number;
  student_id: number | null;
  is_aisle: boolean;
}

export interface CreateFormData {
  name: string;
  class_id: number;
  rows: number;
  columns: number;
  strategy: string;
}

const STRATEGIES = [
  { value: 'height_vision', label: '按身高视力' },
  { value: 'score_layered', label: '按成绩分层' },
  { value: 'random', label: '随机排列' },
  { value: 'balanced', label: '男女均衡' },
];

const getStudentName = (studentId: number | null) => {
  if (!studentId) return '';
  return `学生${studentId}`;
};

export interface SeatingChartViewProps {
  charts: SeatingChart[];
  selectedChart: SeatingChart | null;
  isLoading: boolean;
  showCreateModal: boolean;
  formData: CreateFormData;
  draggedSeat: SeatPosition | null;
  isArranging: boolean;
  isSwapping: boolean;
  isDragging: boolean;
  pointerPos: { x: number; y: number } | null;
  filterClassId: number;
  submitting: boolean;
  setFilterClassId: (id: number) => void;
  setShowCreateModal: (v: boolean) => void;
  fetchChartDetail: (id: number) => void;
  handleDelete: (id: number) => void;
  handleCreate: () => void;
  handleAutoArrange: () => void;
  handleSeatPointerDown: (e: ReactPointerEvent<HTMLDivElement>, seat: SeatPosition) => void;
  handleSeatPointerMove: (e: ReactPointerEvent<HTMLDivElement>, seat: SeatPosition) => void;
  handleSeatPointerUp: (e: ReactPointerEvent<HTMLDivElement>, seat: SeatPosition) => void;
  setFormData: Dispatch<SetStateAction<CreateFormData>>;
  runSubmit: (fn: () => Promise<unknown> | unknown) => Promise<void>;
}

export default function SeatingChartView(props: SeatingChartViewProps) {
  const {
    charts,
    selectedChart,
    isLoading,
    showCreateModal,
    formData,
    draggedSeat,
    isArranging,
    isSwapping,
    isDragging,
    pointerPos,
    filterClassId,
    submitting,
    setFilterClassId,
    setShowCreateModal,
    fetchChartDetail,
    handleDelete,
    handleCreate,
    handleAutoArrange,
    handleSeatPointerDown,
    handleSeatPointerMove,
    handleSeatPointerUp,
    setFormData,
    runSubmit,
  } = props;

  const renderGrid = () => {
    if (!selectedChart) return null;

    const seats: SeatPosition[] = selectedChart.seats || [];
    const rows = selectedChart.rows || 6;
    const columns = selectedChart.columns || 7;

    const grid: SeatPosition[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: SeatPosition[] = [];
      for (let c = 0; c < columns; c++) {
        const seat = seats.find((s) => s.row === r && s.col === c);
        row.push(seat || { row: r, col: c, student_id: null, is_aisle: false });
      }
      grid.push(row);
    }

    return (
      <div className={`overflow-x-auto ${isSwapping ? 'pointer-events-none opacity-60' : ''}`}>
        <div className='inline-block min-w-full p-4'>
          <div className='mb-4 text-center'>
            <span className='inline-block px-6 py-2 bg-slate-200 dark:bg-slate-700 rounded-full text-sm font-medium text-slate-600 dark:text-slate-300'>
              讲 台
            </span>
          </div>
          <div className='flex flex-col gap-2'>
            {grid.map((row, rowIndex) => (
              <div key={rowIndex} className='flex gap-2 justify-center'>
                {row.map((seat) => {
                  const isDraggable = seat.student_id !== null && !seat.is_aisle;
                  const isDropTarget = draggedSeat !== null && !seat.is_aisle;
                  return (
                    <div
                      key={`${seat.row}-${seat.col}`}
                      data-seat={`${seat.row}-${seat.col}`}
                      onPointerDown={(e) => handleSeatPointerDown(e, seat)}
                      onPointerMove={(e) => handleSeatPointerMove(e, seat)}
                      onPointerUp={(e) => handleSeatPointerUp(e, seat)}
                      className={`
                        w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center
                        transition-all duration-200 text-xs font-medium
                        ${isDraggable ? 'touch-none' : ''}
                        ${
                          seat.is_aisle
                            ? 'border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 cursor-default'
                            : seat.student_id
                            ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 cursor-grab hover:shadow-lg hover:scale-105 active:cursor-grabbing'
                            : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-400 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        }
                        ${
                          draggedSeat &&
                          draggedSeat.row === seat.row &&
                          draggedSeat.col === seat.col
                            ? 'opacity-50'
                            : ''
                        }
                        ${isDropTarget ? 'ring-2 ring-green-400 ring-opacity-50' : ''}
                      `}
                    >
                      {seat.is_aisle ? (
                        <span className='text-slate-300 dark:text-slate-500'>过道</span>
                      ) : seat.student_id ? (
                        <>
                          <User className='w-5 h-5 mb-0.5' />
                          <span className='truncate max-w-[3rem]'>
                            {getStudentName(seat.student_id)}
                          </span>
                        </>
                      ) : (
                        <span className='text-slate-300'>-</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className='flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800'>
      <div className='px-6 py-5 border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm'>
        <div className='flex items-center justify-between gap-4'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-blue-500/20'>
              <LayoutGrid className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text'>
                座次表管理
              </h1>
              <p className='text-sm text-slate-500 dark:text-slate-400'>
                管理班级座次安排，支持自动排列和拖拽调整
              </p>
              <WorkbenchBreadcrumb current='座次表管理' />
              <CurrentClassLabel />
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <div className='w-44'>
              <ClassSelect
                allowEmpty
                emptyLabel='全部班级'
                value={filterClassId}
                onChange={setFilterClassId}
              />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className='flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 hover:scale-105 active:scale-95 font-medium'
            >
              <Plus className='w-5 h-5' />
              新建座次表
            </button>
          </div>
        </div>
      </div>

      <div className='flex-1 px-6 py-5 overflow-auto'>
        {isLoading && !selectedChart ? (
          <div className='flex flex-col items-center justify-center h-full gap-3'>
            <LoadingSpinner text='加载中...' />
          </div>
        ) : charts.length === 0 ? (
          <div className='flex flex-col items-center justify-center h-full gap-4'>
            <EmptyState
              icon='folder'
              title='暂无座次表数据'
              description='为当前班级创建第一张座次表'
              actionLabel='创建第一个座次表'
              onAction={() => setShowCreateModal(true)}
            />
          </div>
        ) : (
          <div className='grid grid-cols-1 lg:grid-cols-4 gap-5'>
            <div className='lg:col-span-1 space-y-3'>
              <h2 className='text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2'>
                <Eye className='w-4 h-4' />
                座次表列表
              </h2>
              <div className='space-y-2'>
                {charts.map((chart) => (
                  <div
                    key={chart.id}
                    onClick={() => fetchChartDetail(chart.id)}
                    className={`
                      p-4 rounded-xl cursor-pointer transition-all duration-200 border
                      ${
                        selectedChart?.id === chart.id
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-transparent shadow-lg shadow-blue-500/25'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:shadow-md'
                      }
                    `}
                  >
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <LayoutGrid
                          className={`w-4 h-4 ${
                            selectedChart?.id === chart.id ? 'text-white' : 'text-blue-500'
                          }`}
                        />
                        <span
                          className={`font-medium ${
                            selectedChart?.id === chart.id
                              ? 'text-white'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {chart.name}
                        </span>
                      </div>
                      <div className='flex items-center gap-1'>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(chart.id);
                          }}
                          aria-label={`删除座次表 ${chart.name}`}
                          className={`p-1 rounded-lg transition-colors ${
                            selectedChart?.id === chart.id
                              ? 'hover:bg-white/20 text-white'
                              : 'hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500'
                          }`}
                        >
                          <Trash2 className='w-3.5 h-3.5' />
                        </button>
                      </div>
                    </div>
                    <div
                      className={`mt-2 text-xs ${
                        selectedChart?.id === chart.id
                          ? 'text-white/80'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {chart.rows}行 × {chart.columns}列 ·{' '}
                      {STRATEGIES.find((s) => s.value === chart.strategy)?.label || chart.strategy}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className='lg:col-span-3'>
              {selectedChart ? (
                <div className='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 overflow-hidden'>
                  <div className='px-5 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-slate-50/50 to-white/50 dark:from-slate-800/50 dark:to-slate-800 flex items-center justify-between'>
                    <div className='flex items-center gap-3'>
                      <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center'>
                        <GraduationCap className='w-5 h-5 text-white' />
                      </div>
                      <div>
                        <h3 className='font-semibold text-slate-800 dark:text-slate-100'>
                          {selectedChart.name}
                        </h3>
                        <p className='text-xs text-slate-500 dark:text-slate-400'>
                          {selectedChart.rows}行 × {selectedChart.columns}列 · 共{' '}
                          {
                            (selectedChart.seats || []).filter((s: SeatPosition) => s.student_id)
                              .length
                          }{' '}
                          人
                        </p>
                      </div>
                      {isSwapping && (
                        <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium'>
                          <Loader2 className='w-3 h-3 animate-spin' />
                          调整中
                        </span>
                      )}
                    </div>
                    <div className='flex items-center gap-2'>
                      <select
                        value={formData.strategy}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, strategy: e.target.value }))
                        }
                        className='px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm'
                      >
                        {STRATEGIES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleAutoArrange}
                        disabled={isArranging}
                        className='flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed'
                      >
                        <Sparkles className={`w-4 h-4 ${isArranging ? 'animate-spin' : ''}`} />
                        {isArranging ? '排列中...' : '自动排列'}
                      </button>
                    </div>
                  </div>
                  <div className='p-4'>
                    {renderGrid()}
                    {isDragging && pointerPos && draggedSeat && (
                      <div
                        className='fixed z-50 w-16 h-16 rounded-xl border-2 border-blue-400 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex flex-col items-center justify-center text-xs font-medium shadow-xl pointer-events-none'
                        style={{
                          left: pointerPos.x,
                          top: pointerPos.y,
                          transform: 'translate(-50%, -50%)',
                        }}
                      >
                        <User className='w-5 h-5 mb-0.5' />
                        <span className='truncate max-w-[3rem]'>
                          {getStudentName(draggedSeat.student_id)}
                        </span>
                      </div>
                    )}
                    <div className='mt-4 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400'>
                      <Move className='w-4 h-4' />
                      提示：按住学生座位拖动（桌面 / 触屏均可）即可调整位置，支持双人互换
                    </div>
                  </div>
                </div>
              ) : (
                <div className='flex flex-col items-center justify-center h-64 gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50'>
                  <Users className='w-12 h-12 text-slate-300 dark:text-slate-600' />
                  <p className='text-slate-400 dark:text-slate-500'>选择或创建一个座次表开始</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='relative px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800'>
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500' />
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center'>
                    <LayoutGrid className='w-5 h-5 text-white' />
                  </div>
                  <h3 className='text-lg font-bold text-slate-800 dark:text-slate-100'>
                    新建座次表
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  aria-label='关闭新建座次表弹窗'
                  className='p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>
            </div>
            <div className='px-6 py-5 space-y-5'>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  班级 <span className='text-red-500'>*</span>
                </label>
                <ClassSelect
                  value={formData.class_id}
                  onChange={(id) => setFormData({ ...formData, class_id: id })}
                  emptyPlaceholder='暂无班级'
                />
              </div>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  座次表名称 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder='如：高一(1)班座次表'
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 dark:text-slate-100'
                />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    行数
                  </label>
                  <input
                    type='number'
                    min={1}
                    max={20}
                    value={formData.rows}
                    onChange={(e) =>
                      setFormData({ ...formData, rows: parseInt(e.target.value) || 1 })
                    }
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                    列数
                  </label>
                  <input
                    type='number'
                    min={1}
                    max={20}
                    value={formData.columns}
                    onChange={(e) =>
                      setFormData({ ...formData, columns: parseInt(e.target.value) || 1 })
                    }
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 dark:text-slate-100'
                  />
                </div>
              </div>
              <div>
                <label className='block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2'>
                  默认排列策略
                </label>
                <select
                  value={formData.strategy}
                  onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-slate-800 dark:text-slate-100'
                >
                  {STRATEGIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className='px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 flex items-center justify-end gap-3'>
              <button
                onClick={() => setShowCreateModal(false)}
                className='px-5 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors font-medium'
              >
                取消
              </button>
              <button
                onClick={() => runSubmit(handleCreate)}
                disabled={isLoading || submitting}
                className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 font-medium disabled:opacity-50'
              >
                <Check className='w-5 h-5' />
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
