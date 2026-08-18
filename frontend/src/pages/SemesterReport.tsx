import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { Card, Select, Button, Space, message, Typography, Spin, Alert } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FileTextOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

interface ClassOption {
  id: number;
  name: string;
}

const SemesterReport: React.FC = () => {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classId, setClassId] = useState<number | undefined>(undefined);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [exporting, setExporting] = useState<'' | 'excel' | 'csv'>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingClasses(true);
    api.classes
      .getAll({ page: 1, per_page: 200 })
      .then((res) => {
        const list = (res?.classes || []) as ClassOption[];
        setClasses(list);
      })
      .catch(() => setError('加载班级列表失败'))
      .finally(() => setLoadingClasses(false));
  }, []);

  const selectedClass = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);

  useEffect(() => {
    if (!selectedClass) {
      setStudentCount(null);
      return;
    }
    setStudentCount(null);
    api.classes
      .getStudents(selectedClass.name)
      .then((students) => setStudentCount(Array.isArray(students) ? students.length : 0))
      .catch(() => setStudentCount(null));
  }, [selectedClass]);

  const handleExport = async (format: 'excel' | 'csv') => {
    if (!classId) {
      message.warning('请先选择班级');
      return;
    }
    // 已知班级无学生（studentCount === 0）：拦截空报表导出（此前仍提示"已开始下载"）
    if (studentCount === 0) {
      message.warning('该班级暂无学生，无可导出数据');
      return;
    }
    setExporting(format);
    setError(null);
    try {
      await api.reports.exportClassSemester(classId, format);
      message.success(`已开始下载 ${format === 'csv' ? 'CSV' : 'Excel'} 报表`);
    } catch (e: any) {
      const msg = e?.message || '导出失败，请重试';
      setError(msg);
      message.error(msg);
    } finally {
      setExporting('');
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <Title level={3}>班级学期报告导出</Title>
      <Paragraph type='secondary'>
        一键导出所选班级的学期积分 /
        成绩汇总表：包含每位学生的当前积分余额，以及各次考试（跨科目合计）的成绩，并自动计算总分与平均分。
      </Paragraph>

      <Card style={{ marginTop: 16 }}>
        <Space direction='vertical' style={{ width: '100%' }} size='middle'>
          <div>
            <Text strong>选择班级</Text>
            <div style={{ marginTop: 8 }}>
              <Select
                style={{ width: '100%' }}
                placeholder={loadingClasses ? '加载中…' : '请选择班级'}
                loading={loadingClasses}
                value={classId}
                onChange={(v: number) => setClassId(v)}
                options={classes.map((c) => ({ label: c.name, value: c.id }))}
                showSearch
                optionFilterProp='label'
              />
            </div>
          </div>

          {selectedClass && (
            <Alert
              type='info'
              showIcon
              message={`已选：${selectedClass.name}`}
              description={`班级学生人数：${
                studentCount === null ? '加载中…' : studentCount
              } 人。导出将汇总该班全部学生的积分与各次考试成绩。`}
            />
          )}

          {error && <Alert type='error' showIcon message={error} />}

          <Space wrap>
            <Button
              type='primary'
              icon={<FileExcelOutlined />}
              loading={exporting === 'excel'}
              disabled={!classId || exporting !== ''}
              onClick={() => handleExport('excel')}
            >
              导出 Excel
            </Button>
            <Button
              icon={<FileTextOutlined />}
              loading={exporting === 'csv'}
              disabled={!classId || exporting !== ''}
              onClick={() => handleExport('csv')}
            >
              导出 CSV
            </Button>
            <Spin spinning={exporting !== ''} />
          </Space>

          <Paragraph type='secondary' style={{ marginBottom: 0 }}>
            <DownloadOutlined /> 导出文件为「班级名_学期报告.xlsx /
            .csv」，可直接发给家长或留存归档。
          </Paragraph>
        </Space>
      </Card>
    </div>
  );
};

export default SemesterReport;
