import { render } from '@testing-library/react';
import { CheckCircle, HelpCircle } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import StatusBadge from '../StatusBadge';

const statusMap = {
  healthy: { color: 'bg-green-100', icon: CheckCircle, label: '健康' },
  unknown: { color: 'bg-gray-100', icon: HelpCircle, label: '未知' },
};

describe('StatusBadge', () => {
  it('status 命中映射（默认 div / md）→ 渲染 label 并应用 color 类', () => {
    const { getByText, container } = render(
      <StatusBadge status='healthy' statusMap={statusMap} fallbackKey='unknown' />
    );
    expect(getByText('健康')).toBeInTheDocument();
    expect(container.firstChild?.nodeName).toBe('DIV');
    expect(container.firstElementChild?.className).toContain('bg-green-100');
  });

  it('status 未命中 → 回退到 fallbackKey 条目', () => {
    const { getByText, container } = render(
      <StatusBadge status='missing' statusMap={statusMap} fallbackKey='unknown' />
    );
    expect(getByText('未知')).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain('bg-gray-100');
  });

  it('as="span" → 根容器为 SPAN', () => {
    const { container } = render(
      <StatusBadge status='healthy' statusMap={statusMap} fallbackKey='unknown' as='span' />
    );
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

  it('size=md + message → 渲染以 "| " 前缀的 message', () => {
    const { getByText } = render(
      <StatusBadge
        status='healthy'
        statusMap={statusMap}
        fallbackKey='unknown'
        size='md'
        message='磁盘占用 80%'
      />
    );
    expect(getByText('| 磁盘占用 80%')).toBeInTheDocument();
  });

  it('size=sm + message → 渲染 message（无 "| " 前缀，truncate）', () => {
    const { getByText, queryByText } = render(
      <StatusBadge
        status='healthy'
        statusMap={statusMap}
        fallbackKey='unknown'
        size='sm'
        message='磁盘占用 80%'
      />
    );
    expect(getByText('磁盘占用 80%')).toBeInTheDocument();
    expect(queryByText('| 磁盘占用 80%')).toBeNull();
  });

  it('size=xs + message → message 不渲染', () => {
    const { queryByText } = render(
      <StatusBadge
        status='healthy'
        statusMap={statusMap}
        fallbackKey='unknown'
        size='xs'
        message='磁盘占用 80%'
      />
    );
    expect(queryByText('磁盘占用 80%')).toBeNull();
    expect(queryByText('| 磁盘占用 80%')).toBeNull();
  });

  it('无 message → 不渲染 message 片段', () => {
    const { container } = render(
      <StatusBadge status='healthy' statusMap={statusMap} fallbackKey='unknown' />
    );
    const text = container.textContent || '';
    expect(text.startsWith('|')).toBe(false);
  });
});
