import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

const PieChartComponent = ({
  data,
  title = '占比分布',
  dataKey = 'value',
  nameKey = 'name',
  innerRadius = 0,
}) => {
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const total =
        data.payload.total || data.payload[nameKey]?.reduce((sum, d) => sum + d.value, 0) || 0;
      const percent = total > 0 ? ((data.value / total) * 100).toFixed(1) : 0;
      return (
        <div className='bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-700'>
          <p className='text-sm text-slate-400'>{data.name}</p>
          <p className='text-lg font-semibold' style={{ color: data.color }}>
            {data.value} ({percent}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }) => {
    return (
      <div className='flex flex-wrap gap-3 mt-4'>
        {payload.map((entry, index) => (
          <div key={index} className='flex items-center gap-2'>
            <span className='w-3 h-3 rounded-full' style={{ backgroundColor: entry.color }} />
            <span className='text-sm text-slate-300'>{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const total = data.reduce((sum, d) => sum + d[dataKey], 0);
  const processedData = data.map((d, i) => ({
    ...d,
    name: d[nameKey],
    value: d[dataKey],
    percent: total > 0 ? ((d[dataKey] / total) * 100).toFixed(1) : 0,
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className='bg-slate-800 rounded-xl p-6 border border-slate-700'>
      <h3 className='text-lg font-semibold text-white mb-6'>{title}</h3>

      <div className='h-64'>
        <ResponsiveContainer width='100%' height='100%'>
          <PieChart>
            <Pie
              data={processedData}
              cx='50%'
              cy='50%'
              innerRadius={innerRadius}
              outerRadius={80}
              paddingAngle={2}
              dataKey='value'
              label={({ name, percent }) => `${name}: ${percent}%`}
              labelLine={false}
            >
              {processedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 数据列表 */}
      <div className='mt-4 space-y-2'>
        {processedData.map((item, index) => (
          <div key={index} className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <span className='w-2 h-2 rounded-full' style={{ backgroundColor: item.fill }} />
              <span className='text-sm text-slate-400'>{item.name}</span>
            </div>
            <div className='text-right'>
              <span className='text-sm text-white font-medium'>{item.value}</span>
              <span className='text-xs text-slate-400 ml-2'>({item.percent}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PieChartComponent;
