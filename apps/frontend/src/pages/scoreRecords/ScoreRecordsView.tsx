/**
 * 成绩档案页视图层。
 *
 * 承接原 ScoreRecords.tsx 的学生列表 / 学生信息卡 / 成绩概览卡 / 历次考试列表
 * 四个内联子组件与主渲染 JSX，全部数据经 ScoreRecordsViewProps 注入。
 */

import React, { useMemo } from 'react';
import { BookOpen, Award, Users } from 'lucide-react';
import {
  Card,
  SearchFilter,
  LoadingSpinner,
  DataTable,
  ImportExportPanel,
  type ColumnType,
} from '../../components';
import { useDebouncedValue } from '../../hooks';
import type { ExamWithScores } from '../../types';
import type { ClassInfo } from '../../services/api';
import type { Student, StudentDetail, StudentScoreStats, ScoreRecordsViewProps } from './types';

const StudentList: React.FC<{
  students: Student[];
  selectedStudent: string;
  classes: ClassInfo[];
  selectedClass: string;
  searchInput: string;
  onStudentSelect: (id: string) => void;
  onClassChange: (className: string) => void;
  onSearchChange: (value: string) => void;
}> = ({
  students,
  selectedStudent,
  classes,
  selectedClass,
  searchInput,
  onStudentSelect,
  onClassChange,
  onSearchChange,
}) => {
  const debouncedSearchTerm = useDebouncedValue(searchInput, 300);

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        student.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        student.card_id?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesClass = !selectedClass || student.class_name === selectedClass;
      return matchesSearch && matchesClass;
    });
  }, [students, debouncedSearchTerm, selectedClass]);

  const studentColumns = useMemo<ColumnType<Student>[]>(
    () => [
      {
        title: '姓名',
        key: 'name',
        dataIndex: 'name',
        width: 100,
        render: (value) => <span className='font-medium text-gray-900'>{value as string}</span>,
      },
      {
        title: '学号',
        key: 'card_id',
        dataIndex: 'card_id',
        width: 130,
        render: (value) => <span className='text-sm text-gray-500'>{value as string}</span>,
      },
      {
        title: '班级',
        key: 'class_name',
        dataIndex: 'class_name',
        width: 90,
        render: (value) => <span className='text-sm text-gray-500'>{value as string}</span>,
      },
    ],
    []
  );

  return (
    <Card className='lg:col-span-1'>
      <div className='p-4 border-b border-gray-200'>
        <h3 className='font-medium text-gray-900'>学生列表</h3>
      </div>
      <div className='p-4 space-y-4'>
        <SearchFilter
          value={searchInput}
          onChange={onSearchChange}
          placeholder='搜索学生姓名或学号'
          showReset={true}
          onReset={() => {
            onSearchChange('');
            onClassChange('');
          }}
          selectFilters={[
            {
              label: '班级',
              value: selectedClass,
              onChange: onClassChange,
              options: [
                { label: '全部班级', value: '' },
                ...classes.map((cls) => ({ label: cls.name, value: cls.name })),
              ],
            },
          ]}
          maxWidth='w-full'
          className='w-full'
        />
        <div className='max-h-[600px] overflow-y-auto'>
          <DataTable<Student>
            columns={studentColumns}
            dataSource={filteredStudents}
            rowKey='id'
            pageSize={200}
            pageSizeOptions={[200]}
            virtualThreshold={200}
            onRowClick={(student) => onStudentSelect(student.id.toString())}
            rowClassName={(student) =>
              selectedStudent === student.id.toString() ? 'bg-primary-50' : ''
            }
            empty={{ icon: 'users', title: '暂无学生', description: '未找到匹配的学生' }}
          />
        </div>
      </div>
    </Card>
  );
};

const StudentInfoCard: React.FC<{ student: StudentDetail }> = ({ student }) => {
  return (
    <Card>
      <div className='p-4 border-b border-gray-200 flex items-center justify-between'>
        <h3 className='font-medium text-gray-900'>学生信息</h3>
        <span className='px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
          {student.class_name}
        </span>
      </div>
      <div className='p-4 grid grid-cols-2 md:grid-cols-4 gap-4'>
        <div className='p-4 bg-gray-50 rounded-lg'>
          <div className='text-sm text-gray-500'>姓名</div>
          <div className='font-medium text-gray-900'>{student.name}</div>
        </div>
        <div className='p-4 bg-gray-50 rounded-lg'>
          <div className='text-sm text-gray-500'>学号</div>
          <div className='font-medium text-gray-900'>{student.card_id}</div>
        </div>
        <div className='p-4 bg-gray-50 rounded-lg'>
          <div className='text-sm text-gray-500'>性别</div>
          <div className='font-medium text-gray-900'>{student.gender || '-'}</div>
        </div>
        <div className='p-4 bg-gray-50 rounded-lg'>
          <div className='text-sm text-gray-500'>当前积分</div>
          <div className='font-medium text-gray-900'>{student.current_score}</div>
        </div>
      </div>
    </Card>
  );
};

const ScoreStatsCard: React.FC<{ stats: StudentScoreStats }> = ({ stats }) => {
  return (
    <Card>
      <div className='p-4 border-b border-gray-200'>
        <h3 className='font-medium text-gray-900 flex items-center gap-2'>
          <Award className='w-5 h-5' />
          成绩概览
        </h3>
      </div>
      <div className='p-4'>
        <div className='grid grid-cols-3 gap-4 mb-6'>
          <div className='p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg'>
            <div className='text-sm text-blue-600'>平均成绩</div>
            <div className='text-2xl font-bold text-blue-800'>{stats.avgScore}</div>
          </div>
          <div className='p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg'>
            <div className='text-sm text-green-600'>参加考试</div>
            <div className='text-2xl font-bold text-green-800'>{stats.totalExams}</div>
          </div>
          <div className='p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg'>
            <div className='text-sm text-purple-600'>学科数量</div>
            <div className='text-2xl font-bold text-purple-800'>
              {Object.keys(stats.subjectStats).length}
            </div>
          </div>
        </div>

        <div className='space-y-3'>
          <div className='text-sm font-medium text-gray-700'>各科平均成绩</div>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
            {Object.entries(stats.subjectStats).map(([subject, data]) => (
              <div key={subject} className='p-3 bg-gray-50 rounded-lg'>
                <div className='text-sm text-gray-500'>{subject}</div>
                <div className='text-lg font-bold text-gray-900'>{data.avg}</div>
                <div className='text-xs text-gray-400'>
                  {data.min}-{data.max} ({data.count}次)
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

const ExamScoresList: React.FC<{
  examScores: Record<string, ExamWithScores>;
  loading: boolean;
}> = ({ examScores, loading }) => {
  if (loading) {
    return (
      <Card>
        <div className='p-4 border-b border-gray-200'>
          <h3 className='font-medium text-gray-900 flex items-center gap-2'>
            <BookOpen className='w-5 h-5' />
            历次考试成绩
          </h3>
        </div>
        <div className='flex items-center justify-center py-12'>
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (Object.keys(examScores).length === 0) {
    return (
      <Card>
        <div className='p-4 border-b border-gray-200'>
          <h3 className='font-medium text-gray-900 flex items-center gap-2'>
            <BookOpen className='w-5 h-5' />
            历次考试成绩
          </h3>
        </div>
        <div className='text-center py-12 text-gray-500'>
          <BookOpen className='w-12 h-12 mx-auto mb-3 text-gray-300' />
          <p>暂无考试成绩记录</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className='p-4 border-b border-gray-200'>
        <h3 className='font-medium text-gray-900 flex items-center gap-2'>
          <BookOpen className='w-5 h-5' />
          历次考试成绩
        </h3>
      </div>
      <div className='p-4'>
        <div className='space-y-4'>
          {Object.entries(examScores).map(([examId, exam]) => {
            const scores = exam.scores || {};
            const scoreCount = Object.values(scores).filter((s) => s.score).length;

            return (
              <div key={examId} className='border border-gray-200 rounded-lg overflow-hidden'>
                <div className='px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between'>
                  <div>
                    <span className='font-medium'>{exam.exam_name}</span>
                    <span className='text-sm text-gray-500 ml-2'>
                      {exam.exam_time ? new Date(exam.exam_time).toLocaleDateString('zh-CN') : ''}
                    </span>
                  </div>
                  {scoreCount > 0 && (
                    <span className='px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                      已录入 {scoreCount} 科
                    </span>
                  )}
                </div>
                <div className='p-4'>
                  <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                    {Object.entries(scores).map(([subject, score]) => (
                      <div key={subject} className='p-3 bg-white border border-gray-100 rounded-lg'>
                        <div className='text-sm text-gray-500'>{subject}</div>
                        <div className='text-xl font-bold text-gray-900'>
                          {score.score !== undefined && score.score !== null ? score.score : '-'}
                        </div>
                        {score.rank && (
                          <div className='flex items-center gap-1 text-sm text-yellow-600'>
                            <Award className='w-3 h-3' />
                            排名 {score.rank}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};

const ScoreRecordsView: React.FC<ScoreRecordsViewProps> = ({
  students,
  selectedStudent,
  setSelectedStudent,
  studentDetail,
  examScores,
  searchInput,
  setSearchInput,
  classes,
  selectedClass,
  setSelectedClass,
  loading,
  stats,
  handleExportScores,
}) => {
  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>成绩档案</h1>
          <p className='text-gray-500 mt-1'>查看学生历次考试成绩记录</p>
        </div>
        {selectedStudent && studentDetail && (
          <ImportExportPanel
            type='score'
            showExport={true}
            showImport={false}
            showTemplate={false}
            onDataExport={handleExportScores}
            permissions={{
              export: 'score.export',
            }}
          />
        )}
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <StudentList
          students={students}
          selectedStudent={selectedStudent}
          classes={classes}
          selectedClass={selectedClass}
          searchInput={searchInput}
          onStudentSelect={setSelectedStudent}
          onClassChange={setSelectedClass}
          onSearchChange={setSearchInput}
        />

        <div className='lg:col-span-2 space-y-6'>
          {selectedStudent && studentDetail ? (
            <>
              <StudentInfoCard student={studentDetail} />
              {stats && <ScoreStatsCard stats={stats} />}
              <ExamScoresList examScores={examScores} loading={loading} />
            </>
          ) : (
            <Card className='text-center py-12'>
              <Users className='w-12 h-12 text-gray-300 mx-auto mb-3' />
              <h3 className='text-lg font-semibold text-gray-900 mb-2'>选择学生</h3>
              <p className='text-gray-500'>从左侧列表中选择学生查看成绩档案</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScoreRecordsView;
