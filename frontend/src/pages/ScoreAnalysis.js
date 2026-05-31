import { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Award,
  Target,
} from 'lucide-react';
import { Card, LoadingSpinner } from '../components';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

function ScoreAnalysis() {
  const { showToast } = useToast();
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [examAnalysis, setExamAnalysis] = useState(null);
  const [classAnalysis, setClassAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [examsRes, classesRes] = await Promise.all([
        api.exams.getAll(),
        api.classes.getAll(),
      ]);

      setExams(Array.isArray(examsRes) ? examsRes : examsRes.data || []);
      setClasses(Array.isArray(classesRes) ? classesRes : classesRes.classes || []);
    } catch (err) {
      showToast('获取数据失败: ' + err.message, 'error');
    }
  };

  const fetchExamAnalysis = async () => {
    if (!selectedExam) return;
    setLoading(true);
    try {
      const res = await api.scoreAnalysis.getExamAnalysis(selectedExam);
      setExamAnalysis(res);
    } catch (err) {
      showToast('获取考试分析失败: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchClassAnalysis = async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const res = await api.scoreAnalysis.getClassAnalysis(selectedClass);
      setClassAnalysis(res);
    } catch (err) {
      showToast('获取班级分析失败: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedExam) {
      fetchExamAnalysis();
    }
  }, [selectedExam]);

  useEffect(() => {
    if (selectedClass) {
      fetchClassAnalysis();
    }
  }, [selectedClass]);

  const renderScoreDistribution = (scores) => {
    if (!scores || scores.length === 0) return null;

    const bins = [0, 60, 70, 80, 90, 101];
    const counts = [0, 0, 0, 0, 0];

    scores.forEach((score) => {
      for (let i = 0; i < bins.length - 1; i++) {
        if (score >= bins[i] && score < bins[i + 1]) {
          counts[i]++;
          break;
        }
      }
    });

    const maxCount = Math.max(...counts);
    const labels = ['0-59', '60-69', '70-79', '80-89', '90-100'];
    const colors = ['#ef4444', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4'];

    return (
      <div className='flex items-end justify-around h-48 gap-2'>
        {counts.map((count, index) => (
          <div key={index} className='flex flex-col items-center flex-1'>
            <div className='text-xs text-gray-500 mb-1'>{labels[index]}</div>
            <div
              className='w-full rounded-t-md transition-all duration-500'
              style={{
                height: maxCount > 0 ? `${(count / maxCount) * 100}%` : '0%',
                backgroundColor: colors[index],
                minHeight: count > 0 ? '8px' : '0',
              }}
            />
            <div className='text-xs font-medium text-gray-700 mt-1'>{count}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderSubjectBarChart = (stats) => {
    if (!stats) return null;

    const subjects = Object.keys(stats);
    const maxAvg = subjects.length > 0 ? Math.max(...subjects.map((s) => stats[s].average || 0)) : 100;

    return (
      <div className='flex items-end justify-around h-40 gap-3'>
        {subjects.map((subject) => {
          const avg = stats[subject].average || 0;
          return (
            <div key={subject} className='flex flex-col items-center flex-1'>
              <div className='text-xs font-medium text-gray-700 mb-1'>{avg}</div>
              <div
                className='w-full rounded-t-md bg-gradient-to-t from-primary-500 to-primary-400 transition-all duration-500'
                style={{
                  height: maxAvg > 0 ? `${(avg / maxAvg) * 100}%` : '0%',
                  minHeight: '8px',
                }}
              />
              <div className='text-xs text-gray-500 mt-1'>{subject}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderRadarChart = (stats) => {
    if (!stats) return null;

    const subjects = Object.keys(stats);
    const centerX = 100;
    const centerY = 100;
    const radius = 80;
    const angleStep = subjects.length > 0 ? (2 * Math.PI) / subjects.length : 0;

    const points = subjects.map((subject, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const avg = stats[subject].average || 0;
      const r = (avg / 100) * radius;
      return {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      };
    });

    const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');

    const gridLines = [];
    for (let level = 1; level <= 4; level++) {
      const levelRadius = (level / 4) * radius;
      const levelPoints = subjects.map((_, index) => {
        const angle = angleStep * index - Math.PI / 2;
        return `${centerX + levelRadius * Math.cos(angle)},${centerY + levelRadius * Math.sin(angle)}`;
      }).join(' ');
      gridLines.push(
        <polygon
          key={level}
          points={levelPoints}
          fill='none'
          stroke='#e5e7eb'
          strokeWidth='1'
        />
      );
    }

    return (
      <svg viewBox='0 0 200 200' className='w-full h-48'>
        {gridLines}
        {subjects.map((subject, index) => {
          const angle = angleStep * index - Math.PI / 2;
          return (
            <line
              key={`line-${index}`}
              x1={centerX}
              y1={centerY}
              x2={centerX + radius * Math.cos(angle)}
              y2={centerY + radius * Math.sin(angle)}
              stroke='#e5e7eb'
              strokeWidth='1'
            />
          );
        })}
        <polygon
          points={polygonPoints}
          fill='rgba(59, 130, 246, 0.2)'
          stroke='#3b82f6'
          strokeWidth='2'
        />
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r='4' fill='#3b82f6' />
        ))}
        {subjects.map((subject, index) => {
          const angle = angleStep * index - Math.PI / 2;
          const labelRadius = radius + 15;
          const labelX = centerX + labelRadius * Math.cos(angle);
          const labelY = centerY + labelRadius * Math.sin(angle);
          return (
            <text
              key={index}
              x={labelX}
              y={labelY}
              textAnchor='middle'
              dominantBaseline='middle'
              className='text-xs fill-gray-600'
            >
              {subject}
            </text>
          );
        })}
      </svg>
    );
  };

  return (
    <div className='p-6 space-y-6'>
      <div>
        <h1 className='text-2xl font-bold text-gray-900'>成绩分析</h1>
        <p className='text-gray-500 mt-1'>分析班级和考试成绩数据</p>
      </div>

      {/* 筛选栏 */}
      <Card>
        <div className='p-4 flex flex-wrap gap-4 items-center'>
          <div className='flex-1 min-w-[240px]'>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>选择考试</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id.toString()}>
                  {exam.name}
                </option>
              ))}
            </select>
          </div>
          <div className='w-48'>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'
            >
              <option value=''>选择班级</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id.toString()}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className='flex items-center justify-center py-12'>
          <LoadingSpinner />
        </div>
      ) : (
        <div className='space-y-6'>
          {/* 考试分析统计卡片 */}
          {examAnalysis && examAnalysis.overall && (
            <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
              <Card>
                <div className='p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='p-2 bg-blue-100 rounded-lg'>
                      <Target className='w-5 h-5 text-blue-600' />
                    </div>
                    <div>
                      <div className='text-sm text-gray-500'>参考人数</div>
                      <div className='text-2xl font-bold text-gray-900'>
                        {examAnalysis.overall.total_students || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              <Card>
                <div className='p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='p-2 bg-green-100 rounded-lg'>
                      <TrendingUp className='w-5 h-5 text-green-600' />
                    </div>
                    <div>
                      <div className='text-sm text-gray-500'>平均成绩</div>
                      <div className='text-2xl font-bold text-gray-900'>
                        {examAnalysis.overall.overall_average || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              <Card>
                <div className='p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='p-2 bg-yellow-100 rounded-lg'>
                      <Award className='w-5 h-5 text-yellow-600' />
                    </div>
                    <div>
                      <div className='text-sm text-gray-500'>优秀率</div>
                      <div className='text-2xl font-bold text-gray-900'>
                        {examAnalysis.overall.excellent_rate || 0}%
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              <Card>
                <div className='p-4'>
                  <div className='flex items-center gap-3'>
                    <div className='p-2 bg-purple-100 rounded-lg'>
                      <BarChart3 className='w-5 h-5 text-purple-600' />
                    </div>
                    <div>
                      <div className='text-sm text-gray-500'>及格率</div>
                      <div className='text-2xl font-bold text-gray-900'>
                        {examAnalysis.overall.pass_rate || 0}%
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            {/* 各科平均分对比 */}
            {examAnalysis && examAnalysis.subject_stats && (
              <Card>
                <div className='p-4 border-b border-gray-200'>
                  <h3 className='font-medium text-gray-900 flex items-center gap-2'>
                    <BarChart3 className='w-5 h-5' />
                    各科平均分对比
                  </h3>
                </div>
                <div className='p-4'>
                  {renderSubjectBarChart(examAnalysis.subject_stats)}
                </div>
              </Card>
            )}

            {/* 成绩分布 */}
            {examAnalysis && (
              <Card>
                <div className='p-4 border-b border-gray-200'>
                  <h3 className='font-medium text-gray-900 flex items-center gap-2'>
                    <BarChart3 className='w-5 h-5' />
                    成绩分布
                  </h3>
                </div>
                <div className='p-4'>
                  {renderScoreDistribution(
                    examAnalysis.subject_stats
                      ? Object.values(examAnalysis.subject_stats).flatMap((s) => s.scores || [])
                      : []
                  )}
                  <div className='flex justify-around mt-4 text-xs text-gray-500'>
                    <span>不及格</span>
                    <span>及格</span>
                    <span>中等</span>
                    <span>良好</span>
                    <span>优秀</span>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* 各科详细统计 */}
          {examAnalysis && examAnalysis.subject_stats && (
            <Card>
              <div className='p-4 border-b border-gray-200'>
                <h3 className='font-medium text-gray-900 flex items-center gap-2'>
                  <TrendingUp className='w-5 h-5' />
                  各科详细统计
                </h3>
              </div>
              <div className='p-4'>
                <div className='space-y-4'>
                  {Object.entries(examAnalysis.subject_stats).map(([subject, data]) => (
                    <div key={subject} className='flex items-center justify-between p-4 bg-gray-50 rounded-lg'>
                      <div className='flex items-center gap-4'>
                        <span className='px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 w-16'>
                          {subject}
                        </span>
                        <div>
                          <div className='text-sm text-gray-500'>参考 {data.count || 0} 人</div>
                        </div>
                      </div>
                      <div className='flex items-center gap-8'>
                        <div className='text-center'>
                          <div className='text-sm text-gray-500'>平均分</div>
                          <div className='text-lg font-bold text-gray-900'>{data.average || 0}</div>
                        </div>
                        <div className='text-center'>
                          <div className='text-sm text-gray-500'>最高分</div>
                          <div className='text-lg font-bold text-green-600'>{data.max || 0}</div>
                        </div>
                        <div className='text-center'>
                          <div className='text-sm text-gray-500'>最低分</div>
                          <div className='text-lg font-bold text-red-600'>{data.min || 0}</div>
                        </div>
                        <div className='text-center'>
                          <div className='text-sm text-gray-500'>及格率</div>
                          <div className='text-lg font-bold text-purple-600'>{data.pass_rate || 0}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* 班级学科能力雷达图 */}
          {classAnalysis && (
            <Card>
              <div className='p-4 border-b border-gray-200'>
                <h3 className='font-medium text-gray-900 flex items-center gap-2'>
                  <TrendingUp className='w-5 h-5' />
                  班级学科能力雷达图
                </h3>
              </div>
              <div className='p-4 flex justify-center'>
                {renderRadarChart(classAnalysis)}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default ScoreAnalysis;
