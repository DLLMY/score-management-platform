import { getErrMsg } from '../utils/getErrMsg';
import logger from '../utils/logger';
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import api from '../services/api';
import { SeatingChart, SeatingChartCreateInput } from '../types';
import { useStableToast, useSubmitGuard, useWorkbenchClass } from '../hooks';
import { useConfirm } from '../components';
import SeatingChartView, { SeatPosition, CreateFormData } from './seatingChart/SeatingChartView';

const defaultForm: CreateFormData = {
  name: '',
  class_id: 1,
  rows: 6,
  columns: 7,
  strategy: 'height_vision',
};

function SeatingChartPage() {
  const [charts, setCharts] = useState<SeatingChart[]>([]);
  const [selectedChart, setSelectedChart] = useState<SeatingChart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<CreateFormData>(defaultForm);
  const [draggedSeat, setDraggedSeat] = useState<SeatPosition | null>(null);
  const [isArranging, setIsArranging] = useState(false);
  // 拖拽互换落库中的瞬时态：用于乐观更新期间的视觉反馈与防重入
  const [isSwapping, setIsSwapping] = useState(false);
  // 统一指针拖拽（桌面 + 触屏）状态：isDragging 控制 ghost 显隐，pointerPos 跟随手指
  const [isDragging, setIsDragging] = useState(false);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{
    candidate: SeatPosition | null;
    startX: number;
    startY: number;
    active: boolean;
  }>({ candidate: null, startX: 0, startY: 0, active: false });
  const { showToast } = useStableToast();
  const { submitting, run: runSubmit } = useSubmitGuard();
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  // 视图筛选班级：工作台级共享，跨子页保持一致（0 = 全部班级）
  const [filterClassId, setFilterClassId] = useWorkbenchClass();

  const fetchCharts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.seating.getAll(filterClassId || undefined);
      setCharts(data || []);
      setSelectedChart((prev) => {
        if (prev && (data || []).some((c) => c.id === prev.id)) return prev;
        return data && data.length > 0 ? data[0] : null;
      });
    } catch (error) {
      logger.error('获取座次表列表失败:', error);
      showToast('error', getErrMsg(error, '获取座次表列表失败'));
    } finally {
      setIsLoading(false);
    }
  }, [filterClassId, showToast]);

  useEffect(() => {
    fetchCharts();
  }, [fetchCharts]);

  const fetchChartDetail = useCallback(
    async (id: number) => {
      try {
        const data = await api.seating.getById(id);
        setSelectedChart(data);
      } catch (error) {
        logger.error('获取座次表详情失败:', error);
        showToast('error', getErrMsg(error, '获取座次表详情失败'));
      }
    },
    [showToast]
  );

  const handleCreate = useCallback(async () => {
    if (!formData.name.trim()) {
      showToast('warning', '请输入座次表名称');
      return;
    }
    // 边界：行列数钳制在合理范围（1-50），防止 -5/9999 等非法值
    const rows = Math.min(50, Math.max(1, Math.round(formData.rows || 6)));
    const columns = Math.min(50, Math.max(1, Math.round(formData.columns || 7)));
    setIsLoading(true);
    try {
      const data: SeatingChartCreateInput = {
        name: formData.name,
        class_id: formData.class_id,
        rows,
        columns,
        strategy: formData.strategy,
      };
      const newChart = await api.seating.create(data);
      showToast('success', '座次表创建成功');
      setShowCreateModal(false);
      setFormData(defaultForm);
      setSelectedChart(newChart);
      fetchCharts();
    } catch (error) {
      logger.error('创建座次表失败:', error);
      showToast('error', getErrMsg(error, '创建座次表失败'));
    } finally {
      setIsLoading(false);
    }
  }, [formData, showToast, fetchCharts]);

  const handleDelete = useCallback(
    async (id: number) => {
      const ok = await confirmRef.current({
        message: '确定要删除这个座次表吗？',
        confirmText: '确定',
        cancelText: '取消',
        type: 'danger',
      });
      if (!ok) return;
      setIsLoading(true);
      try {
        await api.seating.delete(id);
        showToast('success', '座次表删除成功');
        if (selectedChart?.id === id) {
          setSelectedChart(null);
        }
        fetchCharts();
      } catch (error) {
        logger.error('删除座次表失败:', error);
        showToast('error', getErrMsg(error, '删除座次表失败'));
      } finally {
        setIsLoading(false);
      }
    },
    [selectedChart, showToast, fetchCharts]
  );

  const handleAutoArrange = useCallback(async () => {
    if (!selectedChart) return;
    // M1: 自动排列会覆盖当前整张座次表，先确认
    const ok = await confirmRef.current({
      message: '自动排列将覆盖当前座次表的全部座位，确定继续吗？',
      confirmText: '确定',
      cancelText: '取消',
      type: 'warning',
    });
    if (!ok) return;
    setIsArranging(true);
    try {
      const result = await api.seating.autoArrange(
        selectedChart.id,
        selectedChart.strategy || formData.strategy,
        selectedChart.class_id
      );
      showToast('success', '自动排列完成');
      setSelectedChart(result);
    } catch (error) {
      logger.error('自动排列失败:', error);
      showToast('error', getErrMsg(error, '自动排列失败'));
    } finally {
      setIsArranging(false);
    }
  }, [selectedChart, formData.strategy, showToast]);

  // 双人互换落库：sourceSeat 与 targetSeat 互换 student_id，乐观更新 + 失败回退
  const handleSeatDrop = useCallback(
    async (sourceSeat: SeatPosition, targetSeat: SeatPosition) => {
      if (!selectedChart) return;
      if (sourceSeat.row === targetSeat.row && sourceSeat.col === targetSeat.col) {
        return;
      }
      const prevSeats = selectedChart.seats || [];
      // 乐观更新：本地先完成双人互换，落库失败再回退，保证 UI 始终与服务端一致
      const swappedSeats = prevSeats.map((s) => {
        if (s.row === sourceSeat.row && s.col === sourceSeat.col) {
          return { ...s, student_id: targetSeat.student_id };
        }
        if (s.row === targetSeat.row && s.col === targetSeat.col) {
          return { ...s, student_id: sourceSeat.student_id };
        }
        return s;
      });
      setSelectedChart((prev) => (prev ? { ...prev, seats: swappedSeats } : prev));
      setIsSwapping(true);
      try {
        await api.seating.updateSeat(
          selectedChart.id,
          sourceSeat.row,
          sourceSeat.col,
          targetSeat.student_id
        );
        await api.seating.updateSeat(
          selectedChart.id,
          targetSeat.row,
          targetSeat.col,
          sourceSeat.student_id
        );
        showToast('success', '座位调整成功');
        // 与服务端权威态对齐（idempotent，避免乐观值与后端产生静默漂移）
        await fetchChartDetail(selectedChart.id);
      } catch (error) {
        // 回退本地 state，避免 UI 停留在错误的互换结果
        setSelectedChart((prev) => (prev ? { ...prev, seats: prevSeats } : prev));
        logger.error('调整座位失败:', error);
        showToast('error', getErrMsg(error, '调整座位失败，已还原'));
      } finally {
        setIsSwapping(false);
      }
    },
    [selectedChart, showToast, fetchChartDetail]
  );

  // 统一指针拖拽（桌面 + 触屏）：按下记录候选座位并捕获指针，超过 8px 阈值进入拖拽，
  // 松手时用 elementFromPoint 命中目标座位完成互换。不引入第三方 DnD 库。
  const handleSeatPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, seat: SeatPosition) => {
      if (seat.student_id === null || seat.is_aisle) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStateRef.current = {
        candidate: seat,
        startX: e.clientX,
        startY: e.clientY,
        active: false,
      };
    },
    []
  );

  const handleSeatPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, _seat: SeatPosition) => {
      const st = dragStateRef.current;
      if (!st.candidate) return;
      if (!st.active) {
        if (Math.hypot(e.clientX - st.startX, e.clientY - st.startY) < 8) return;
        st.active = true;
        setDraggedSeat(st.candidate);
        setIsDragging(true);
      }
      setPointerPos({ x: e.clientX, y: e.clientY });
    },
    []
  );

  const handleSeatPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, _seat: SeatPosition) => {
      const st = dragStateRef.current;
      if (!st.candidate) return;
      if (st.active) {
        const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
        const targetEl = el?.closest('[data-seat]') as HTMLElement | null;
        const raw = targetEl?.dataset.seat;
        if (raw) {
          const [r, c] = raw.split('-').map(Number);
          const target: SeatPosition = { row: r, col: c, student_id: null, is_aisle: false };
          handleSeatDrop(st.candidate, target);
        }
      }
      dragStateRef.current = { candidate: null, startX: 0, startY: 0, active: false };
      setIsDragging(false);
      setDraggedSeat(null);
      setPointerPos(null);
    },
    [handleSeatDrop]
  );

  return (
    <SeatingChartView
      charts={charts}
      selectedChart={selectedChart}
      isLoading={isLoading}
      showCreateModal={showCreateModal}
      formData={formData}
      draggedSeat={draggedSeat}
      isArranging={isArranging}
      isSwapping={isSwapping}
      isDragging={isDragging}
      pointerPos={pointerPos}
      filterClassId={filterClassId}
      submitting={submitting}
      setFilterClassId={setFilterClassId}
      setShowCreateModal={setShowCreateModal}
      fetchChartDetail={fetchChartDetail}
      handleDelete={handleDelete}
      handleCreate={handleCreate}
      handleAutoArrange={handleAutoArrange}
      handleSeatPointerDown={handleSeatPointerDown}
      handleSeatPointerMove={handleSeatPointerMove}
      handleSeatPointerUp={handleSeatPointerUp}
      setFormData={setFormData}
      runSubmit={runSubmit}
    />
  );
}

export default SeatingChartPage;
