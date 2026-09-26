import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  deepMemo,
  shallowMemo,
  selectiveMemo,
  filterProps,
  RenderOnChange,
} from '../MemoComponents';

describe('deepMemo', () => {
  it('re-renders only when deep props change', () => {
    const counter = vi.fn();
    const C = (p: { a: { b: number } }) => {
      counter();
      return <div>{p.a.b}</div>;
    };
    const M = deepMemo(C);
    const { rerender } = render(<M a={{ b: 1 }} />);
    expect(counter).toHaveBeenCalledTimes(1);
    rerender(<M a={{ b: 1 }} />); // new object, deep-equal → no re-render
    expect(counter).toHaveBeenCalledTimes(1);
    rerender(<M a={{ b: 2 }} />);
    expect(counter).toHaveBeenCalledTimes(2);
  });

  it('uses custom propsAreEqual', () => {
    const counter = vi.fn();
    const C = (p: { v: number }) => {
      counter();
      return <div>{p.v}</div>;
    };
    const eq = (a: { v: number }, b: { v: number }) => a.v === b.v;
    const M = deepMemo(C, eq);
    const { rerender } = render(<M v={1} />);
    rerender(<M v={1} />);
    expect(counter).toHaveBeenCalledTimes(1);
    rerender(<M v={2} />);
    expect(counter).toHaveBeenCalledTimes(2);
  });

  it('covers deepEqual primitive early-return', () => {
    const counter = vi.fn();
    const C = (p: { v: number }) => {
      counter();
      return <div>{p.v}</div>;
    };
    const M = deepMemo(C);
    const { rerender } = render(<M v={5} />);
    rerender(<M v={5} />);
    expect(counter).toHaveBeenCalledTimes(1);
  });
});

describe('shallowMemo', () => {
  it('re-renders on top-level ref change', () => {
    const counter = vi.fn();
    const C = (p: { a: number; nested: { x: number } }) => {
      counter();
      return <div>{p.a}</div>;
    };
    const M = shallowMemo(C);
    const { rerender } = render(<M a={1} nested={{ x: 1 }} />);
    rerender(<M a={1} nested={{ x: 2 }} />); // shallow compares top-level refs → re-render
    expect(counter).toHaveBeenCalledTimes(2);
    rerender(<M a={1} nested={{ x: 3 }} />);
    expect(counter).toHaveBeenCalledTimes(3);
  });

  it('uses custom propsAreEqual', () => {
    const counter = vi.fn();
    const C = (p: { v: number }) => {
      counter();
      return <div>{p.v}</div>;
    };
    const M = shallowMemo(C, (a, b) => a.v === b.v);
    const { rerender } = render(<M v={1} />);
    rerender(<M v={1} />);
    expect(counter).toHaveBeenCalledTimes(1);
  });
});

describe('selectiveMemo', () => {
  it('re-renders only when selected key changes', () => {
    const counter = vi.fn();
    const C = (p: { id: number; other: string }) => {
      counter();
      return <div>{p.id}</div>;
    };
    const M = selectiveMemo(C, ['id']);
    const { rerender } = render(<M id={1} other='a' />);
    rerender(<M id={1} other='b' />); // id same → no re-render
    expect(counter).toHaveBeenCalledTimes(1);
    rerender(<M id={2} other='b' />);
    expect(counter).toHaveBeenCalledTimes(2);
  });
});

describe('filterProps', () => {
  it('removes filtered keys before passing to child', () => {
    const C = (props: Record<string, unknown>) => (
      <div data-testid='spy'>{Object.keys(props).join(',')}</div>
    );
    const F = filterProps(C, ['drop']);
    render(<F keep='1' drop='2' />);
    const txt = screen.getByTestId('spy').textContent || '';
    expect(txt).toContain('keep');
    expect(txt).not.toContain('drop');
  });
});

describe('RenderOnChange', () => {
  it('updates render value only when not equal', () => {
    const eq = vi.fn((a: number, b: number) => a === b);
    const child: (v: number) => React.ReactNode = vi.fn((v: number) => <span>{v}</span>);
    const { rerender } = render(
      <RenderOnChange value={1} equalityFn={eq}>
        {child}
      </RenderOnChange>
    );
    expect(child).toHaveBeenLastCalledWith(1);
    rerender(
      <RenderOnChange value={1} equalityFn={eq}>
        {child}
      </RenderOnChange>
    ); // equal → no update
    rerender(
      <RenderOnChange value={2} equalityFn={eq}>
        {child}
      </RenderOnChange>
    ); // not equal → update
    expect(child).toHaveBeenLastCalledWith(2);
  });
});
