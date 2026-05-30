import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

const ScoreChart = ({ data, title = '积分趋势', showLegend = true }) => {
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className='bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-700'>
          <p className='text-sm text-slate-400'>{data.payload.date}</p>
          <p className='text-lg font-semibold' style={{ color: data.color }}>
            {data.value} 积分
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }) => {
    return (
      <div className='flex items-center gap-4 mt-4'>
        {payload.map((entry, index) => (
          <div key={index} className='flex items-center gap-2'>
            <span className='w-3 h-3 rounded-full' style={{ backgroundColor: entry.color }} />
            <span className='text-sm text-slate-300'>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const calculateTrend = () => {
    if (data.length < 2) return { value: 0, isUp: true };
    const first = data[0]?.score || 0;
    const last = data[data.length - 1]?.score || 0;
    const change = last - first;
    const percent = first !== 0 ? ((change / first) * 100).toFixed(1) : 0;
    return { value: parseFloat(percent), isUp: change >= 0 };
  };

  const trend = calculateTrend();

  return (
    <div className='bg-slate-800 rounded-xl p-6 border border-slate-700'>
      <div className='flex items-center justify-between mb-6'>
        <h3 className='text-lg font-semibold text-white'>{title}</h3>
        <div className='flex items-center gap-2'>
          {trend.isUp ? (
            <TrendingUp className='w-5 h-5 text-green-400' />
          ) : (
            <TrendingDown className='w-5 h-5 text-red-400' />
          )}
          <span className={`text-sm font-medium ${trend.isUp ? 'text-green-400' : 'text-red-400'}`}>
            {trend.isUp ? '+' : ''}
            {trend.value}%
          </span>
        </div>
      </div>

      <div className='h-64'>
        <ResponsiveContainer width='100%' height='100%'>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray='3 3' stroke='#475569' />
            <XAxis
              dataKey='date'
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={{ stroke: '#475569' }}
            />
            <YAxis
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={{ stroke: '#475569' }}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend content={<CustomLegend />} />}
            <Line
              type='monotone'
              dataKey='score'
              stroke='#3B82F6'
              strokeWidth={2}
              dot={{ fill: '#3B82F6', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ScoreChart;
