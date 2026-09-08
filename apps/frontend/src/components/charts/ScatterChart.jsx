import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/**
 * 散点图组件
 * 用于展示两个变量之间的关系，如行为积分与学业成绩的相关性
 */
export default function ScatterPlot({ data, xKey, yKey, title }) {
  return (
    <div className="w-full h-full min-h-[300px]">
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      )}
      <ResponsiveContainer width="100%" height="100%" minHeight={280}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey={xKey}
            name={xKey}
            type="number"
            tick={{ fill: '#6B7280', fontSize: 12 }}
            tickLine={{ stroke: '#D1D5DB' }}
            axisLine={{ stroke: '#D1D5DB' }}
            label={{
              value: xKey,
              position: 'insideBottom',
              offset: -10,
              fill: '#6B7280',
              fontSize: 12,
            }}
          />
          <YAxis
            dataKey={yKey}
            name={yKey}
            type="number"
            tick={{ fill: '#6B7280', fontSize: 12 }}
            tickLine={{ stroke: '#D1D5DB' }}
            axisLine={{ stroke: '#D1D5DB' }}
            label={{
              value: yKey,
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              fill: '#6B7280',
              fontSize: 12,
            }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value, name, props) => {
              const item = props.payload;
              return [
                [`姓名`, item.name],
                [xKey, item[xKey]],
                [yKey, item[yKey]],
                ['群体', item.cluster_name || '未知'],
              ];
            }}
          />
          <Legend />
          <Scatter
            name="学生分布"
            data={data}
            fill="#3B82F6"
            stroke="#3B82F6"
            strokeWidth={2}
            radius={8}
            fillOpacity={0.6}
            shape="circle"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 分群散点图组件
 * 根据学生分群结果展示不同颜色的散点
 */
export function ClusterScatterChart({ data, title }) {
  // 分群配色
  const clusterColors = {
    '全面优秀型': '#3B82F6',
    '遵纪但学业吃力型': '#EAB308',
    '聪明但散漫型': '#F97316',
    '双困型': '#EF4444',
  };

  // 按群体分组
  const clusters = [...new Set(data.map((d) => d.cluster_name))];

  return (
    <div className="w-full h-full min-h-[300px]">
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      )}
      <ResponsiveContainer width="100%" height="100%" minHeight={280}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey="behavior_score"
            name="行为积分"
            type="number"
            tick={{ fill: '#6B7280', fontSize: 12 }}
            tickLine={{ stroke: '#D1D5DB' }}
            axisLine={{ stroke: '#D1D5DB' }}
            label={{
              value: '行为积分',
              position: 'insideBottom',
              offset: -10,
              fill: '#6B7280',
              fontSize: 12,
            }}
          />
          <YAxis
            dataKey="academic_score"
            name="学业成绩"
            type="number"
            tick={{ fill: '#6B7280', fontSize: 12 }}
            tickLine={{ stroke: '#D1D5DB' }}
            axisLine={{ stroke: '#D1D5DB' }}
            label={{
              value: '学业成绩',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              fill: '#6B7280',
              fontSize: 12,
            }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value, name, props) => {
              const item = props.payload;
              return [
                [`姓名`, item.name],
                ['行为积分', item.behavior_score],
                ['学业成绩', item.academic_score],
                ['群体', item.cluster_name],
              ];
            }}
          />
          <Legend />
          {clusters.map((cluster) => (
            <Scatter
              key={cluster}
              name={cluster}
              data={data.filter((d) => d.cluster_name === cluster)}
              fill={clusterColors[cluster] || '#9CA3AF'}
              stroke={clusterColors[cluster] || '#9CA3AF'}
              strokeWidth={2}
              radius={8}
              fillOpacity={0.7}
              shape="circle"
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}