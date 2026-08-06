import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

/**
 * 雷达图组件
 * 用于展示学生在多个维度上的表现，如行为、学业、合规等
 */
export default function RadarPlot({ data, title }) {
  return (
    <div className="w-full h-full min-h-[300px]">
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      )}
      <ResponsiveContainer width="100%" height="100%" minHeight={280}>
        <RadarChart data={data}>
          <PolarGrid stroke="#E5E7EB" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: '#6B7280', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value) => [`${value}分`, '得分']}
          />
          <Legend />
          <Radar
            name="综合表现"
            dataKey="score"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.5}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 多学生对比雷达图组件
 * 用于对比多个学生在不同维度上的表现
 */
export function MultiRadarChart({ data, title }) {
  // 获取所有维度
  const dimensions = [...new Set(data.flatMap((d) => d.data.map((item) => item.dimension)))];

  // 学生配色
  const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'];

  return (
    <div className="w-full h-full min-h-[300px]">
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      )}
      <ResponsiveContainer width="100%" height="100%" minHeight={280}>
        <RadarChart data={dimensions.map((dim) => ({ dimension: dim }))}>
          <PolarGrid stroke="#E5E7EB" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: '#6B7280', fontSize: 12 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value, name, props) => {
              const idx = props.dataKey;
              return [`${value}分`, data[idx]?.name || '得分'];
            }}
          />
          <Legend />
          {data.map((student, index) => (
            <Radar
              key={student.name}
              name={student.name}
              dataKey={`score_${index}`}
              stroke={colors[index % colors.length]}
              fill={colors[index % colors.length]}
              fillOpacity={0.3}
              strokeWidth={2}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * 综合评分雷达图组件
 * 展示学生的综合评分维度分布
 */
export function CompositeScoreRadar({ scores, title }) {
  const data = [
    { dimension: '行为表现', score: scores.behavior || 0 },
    { dimension: '学业成绩', score: scores.academic || 0 },
    { dimension: '纪律合规', score: scores.compliance || 0 },
    { dimension: '综合评分', score: scores.composite || 0 },
  ];

  return (
    <div className="w-full h-full min-h-[250px]">
      {title && (
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
      )}
      <ResponsiveContainer width="100%" height="100%" minHeight={220}>
        <RadarChart data={data}>
          <PolarGrid stroke="#E5E7EB" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: '#6B7280', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#9CA3AF', fontSize: 9 }}
            tickCount={5}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            formatter={(value) => [`${value}分`, '得分']}
          />
          <Radar
            name="综合评分"
            dataKey="score"
            stroke="#8B5CF6"
            fill="#8B5CF6"
            fillOpacity={0.5}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}