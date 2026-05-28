import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BarChartComponent = ({ data, title = '统计图表', dataKey = 'value', nameKey = 'name', color = '#3B82F6', showLegend = false }) => {
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg border border-slate-700">
          <p className="text-sm text-slate-400">{data.payload[nameKey]}</p>
          <p className="text-lg font-semibold" style={{ color: data.color }}>
            {data.value}
          </p>
        </div>
      );
    }
    return null;
  };

  const maxValue = Math.max(...data.map(d => d[dataKey]), 1);

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-6">{title}</h3>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
            <XAxis
              dataKey={nameKey}
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={{ stroke: '#475569' }}
              angle={-45}
              textAnchor="end"
            />
            <YAxis
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              axisLine={{ stroke: '#475569' }}
              tickLine={{ stroke: '#475569' }}
              domain={[0, maxValue * 1.1]}
            />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend />}
            <Bar
              dataKey={dataKey}
              fill={color}
              radius={[4, 4, 0, 0]}
              barSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BarChartComponent;