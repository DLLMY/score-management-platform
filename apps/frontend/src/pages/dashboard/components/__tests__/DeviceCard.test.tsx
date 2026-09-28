/**
 * DeviceCard 补测（B34）。
 * 纯展示 memo 组件，props 驱动（device），零网络依赖。
 * 覆盖：online/offline 双态（配色/文案/Wifi 透明度）、名称兜底链
 * （device_name → name → device_id）、hover 切换。
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DeviceCard } from '../DeviceCard';
import type { Device } from '../../../../types';

const baseDevice = (over: Record<string, unknown> = {}): Device =>
  ({ is_online: true, device_name: '手机箱A', device_id: 'dev-001', ...over } as unknown as Device);

describe('DeviceCard · 在线/离线双态', () => {
  it('is_online=true → 绿色配色 + "在线" + 设备名/ID', () => {
    const { container } = render(<DeviceCard device={baseDevice()} />);
    expect(screen.getByText('在线')).toBeInTheDocument();
    expect(screen.queryByText('离线')).toBeNull();
    expect(screen.getByText('手机箱A')).toBeInTheDocument();
    expect(screen.getByText('dev-001')).toBeInTheDocument();
    expect(container.innerHTML).toContain('bg-green-500');
  });

  it('is_online=false → 红色配色 + "离线"', () => {
    const { container } = render(<DeviceCard device={baseDevice({ is_online: false })} />);
    expect(screen.getByText('离线')).toBeInTheDocument();
    expect(screen.queryByText('在线')).toBeNull();
    expect(container.innerHTML).toContain('bg-red-500');
  });
});

describe('DeviceCard · 名称兜底链', () => {
  it('device_name 存在 → 显示 device_name', () => {
    render(<DeviceCard device={baseDevice({ device_name: '设备X' })} />);
    expect(screen.getByText('设备X')).toBeInTheDocument();
  });

  it('device_name 缺失但 name 存在 → 显示 name', () => {
    render(<DeviceCard device={baseDevice({ device_name: '', name: '备用名' })} />);
    expect(screen.getByText('备用名')).toBeInTheDocument();
  });

  it('device_name 与 name 均缺失 → 显示 device_id（名称区与 ID 区各一处）', () => {
    render(<DeviceCard device={baseDevice({ device_name: '', name: '' })} />);
    expect(screen.getAllByText('dev-001')).toHaveLength(2);
  });
});

describe('DeviceCard · 交互', () => {
  it('mouseEnter / mouseLeave → hover 切换不报错', () => {
    const { container } = render(<DeviceCard device={baseDevice()} />);
    const card = container.firstChild as HTMLElement;
    fireEvent.mouseEnter(card);
    fireEvent.mouseLeave(card);
    expect(screen.getByText('在线')).toBeInTheDocument();
  });
});
