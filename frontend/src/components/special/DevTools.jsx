import { useState, useEffect } from 'react';
import { X, Activity, Zap, MemoryStick, Clock } from 'lucide-react';
import { getVitals, observeVitals } from '../../utils/webVitals';
import { useMemoryUsage } from '../../hooks/usePerformance';
import { config } from '../../config';

const DevTools = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [vitals, setVitals] = useState(getVitals());
  const memory = useMemoryUsage();

  useEffect(() => {
    const cleanup = observeVitals(setVitals);
    return cleanup;
  }, []);

  if (!config.devTools.enabled) {
    return null;
  }

  const getRating = (metric, value) => {
    const ratings = {
      CLS: { good: 0.1, needs: 0.25 },
      FID: { good: 100, needs: 300 },
      LCP: { good: 2500, needs: 4000 },
      FCP: { good: 1800, needs: 3000 },
      TTFB: { good: 800, needs: 1800 },
    };

    const { good, needs } = ratings[metric] || { good: Infinity, needs: Infinity };
    if (value <= good) return 'good';
    if (value <= needs) return 'needs';
    return 'poor';
  };

  const getColor = (rating) => {
    switch (rating) {
      case 'good':
        return 'text-green-400';
      case 'needs':
        return 'text-yellow-400';
      case 'poor':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const metrics = [
    { name: 'CLS', value: vitals.CLS.toFixed(4), unit: '', icon: Activity },
    { name: 'FID', value: vitals.FID.toFixed(0), unit: 'ms', icon: Zap },
    { name: 'LCP', value: vitals.LCP.toFixed(0), unit: 'ms', icon: Clock },
    { name: 'FCP', value: vitals.FCP.toFixed(0), unit: 'ms', icon: Clock },
    { name: 'TTFB', value: vitals.TTFB.toFixed(0), unit: 'ms', icon: Zap },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-all ${
          isOpen ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-500 hover:bg-primary-600'
        } text-white`}
      >
        {isOpen ? <X size={20} /> : <Activity size={20} />}
      </button>

      {isOpen && (
        <div className='fixed bottom-20 right-4 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 w-80'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-bold text-white'>📊 开发工具</h3>
          </div>

          <div className='space-y-3'>
            <div className='bg-slate-900/50 rounded-lg p-3'>
              <h4 className='text-sm font-medium text-slate-300 mb-2 flex items-center gap-2'>
                <Zap size={16} /> Web Vitals
              </h4>
              <div className='space-y-2'>
                {metrics.map(({ name, value, unit, icon: Icon }) => {
                  const rating = getRating(name, parseFloat(value));
                  const color = getColor(rating);
                  return (
                    <div key={name} className='flex items-center justify-between text-sm'>
                      <div className='flex items-center gap-2'>
                        <Icon size={14} className={color} />
                        <span className='text-slate-400'>{name}</span>
                      </div>
                      <span className={`font-mono ${color}`}>
                        {value}
                        {unit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {memory && (
              <div className='bg-slate-900/50 rounded-lg p-3'>
                <h4 className='text-sm font-medium text-slate-300 mb-2 flex items-center gap-2'>
                  <MemoryStick size={16} /> 内存使用
                </h4>
                <div className='space-y-1'>
                  <div className='flex justify-between text-sm'>
                    <span className='text-slate-400'>已使用</span>
                    <span className='font-mono text-white'>{memory.used} MB</span>
                  </div>
                  <div className='flex justify-between text-sm'>
                    <span className='text-slate-400'>总计</span>
                    <span className='font-mono text-white'>{memory.total} MB</span>
                  </div>
                  <div className='w-full bg-slate-700 rounded-full h-2 mt-2'>
                    <div
                      className='bg-gradient-to-r from-green-500 to-yellow-500 h-2 rounded-full transition-all'
                      style={{ width: `${memory.percentage}%` }}
                    />
                  </div>
                  <div className='text-xs text-slate-500 mt-1'>{memory.percentage}%</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DevTools;
