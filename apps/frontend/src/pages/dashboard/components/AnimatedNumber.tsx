/* eslint-disable react-hooks/exhaustive-deps */
/**
 * 仪表盘视图层（纯展示 + 列/卡片渲染）。
 * T12-10a 拆分（2026-09-12）：原 DashboardView.tsx 中的 5 个 memo 组件、4 个纯函数/常量 helper、
 * DashboardViewProps 接口已外提至 ./components、./helpers、./constants、./types；本文件仅保留主壳 JSX。
 */
import { memo, useState, useRef, useEffect } from 'react';

export const AnimatedNumber = memo(
  ({
    value,
    className = '',
    decimals = 0,
  }: {
    value: number;
    className?: string;
    decimals?: number;
  }) => {
    const [displayValue, setDisplayValue] = useState(value);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      const duration = 300;
      const startTime = Date.now();
      const startValue = displayValue;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        const currentValue = startValue + (value - startValue) * easeOut;
        setDisplayValue(Math.round(currentValue * Math.pow(10, decimals)) / Math.pow(10, decimals));

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(value);
        }
      };

      animationRef.current = requestAnimationFrame(animate);

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, [value, decimals]);

    return (
      <span className={className}>
        {typeof displayValue === 'number'
          ? displayValue.toLocaleString(undefined, { maximumFractionDigits: decimals })
          : '0'}
      </span>
    );
  }
);
