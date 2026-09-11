import React from 'react';
import { Button, Table, Modal, Form, Input, Select, Switch, Tag, type FormInstance } from 'antd';
import {
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Settings,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { formatDateTime } from '../../utils/format';
import type { ImportConfig, FieldMapping, ValidationRule } from '../../services/api';

export interface FieldMappingUI extends FieldMapping {
  id?: number;
}

export interface ValidationRuleUI extends ValidationRule {
  id?: number;
}

const MODULE_OPTIONS = [
  { value: 'classes', label: '班级管理' },
  { value: 'subjects', label: '科目管理' },
  { value: 'course_schedule', label: '课程表管理' },
];

const FIELD_TYPE_OPTIONS = [
  { value: 'string', label: '字符串' },
  { value: 'integer', label: '整数' },
  { value: 'boolean', label: '布尔值' },
  { value: 'date', label: '日期' },
  { value: 'datetime', label: '日期时间' },
];

const RELATION_OPTIONS = [
  { value: '', label: '无' },
  { value: 'admin', label: '管理员' },
  { value: 'class_info', label: '班级' },
  { value: 'subject', label: '科目' },
];

const RULE_TYPE_OPTIONS = [
  { value: 'required', label: '必填' },
  { value: 'max_length', label: '最大长度' },
  { value: 'min_length', label: '最小长度' },
  { value: 'regex', label: '正则表达式' },
];

const CONFLICT_STRATEGY_OPTIONS = [
  { value: 'update', label: '更新' },
  { value: 'skip', label: '跳过' },
];

const TARGET_FIELD_MAP: Record<
  string,
  { label: string; options: { value: string; label: string }[] }
> = {
  classes: {
    label: '班级管理',
    options: [
      { value: 'name', label: '班级名称' },
      { value: 'grade', label: '年级' },
      { value: 'description', label: '描述' },
      { value: 'head_teacher_id', label: '班主任ID' },
      { value: 'head_teacher_name', label: '班主任姓名' },
      { value: 'is_active', label: '是否启用' },
    ],
  },
  subjects: {
    label: '科目管理',
    options: [
      { value: 'name', label: '科目名称' },
      { value: 'code', label: '科目代码' },
      { value: 'grade', label: '年级' },
      { value: 'description', label: '描述' },
      { value: 'color', label: '颜色' },
      { value: 'is_active', label: '是否启用' },
    ],
  },
  course_schedule: {
    label: '课程表管理',
    options: [
      { value: 'class_name', label: '班级名称' },
      { value: 'subject_name', label: '科目名称' },
      { value: 'day_of_week', label: '星期' },
      { value: 'period_number', label: '节次' },
      { value: 'teacher_name', label: '教师' },
      { value: 'classroom', label: '教室' },
      { value: 'description', label: '备注' },
      { value: 'is_active', label: '是否启用' },
    ],
  },
};

interface ImportConfigManagementViewProps {
  configs: ImportConfig[];
  loading: boolean;
  loadError: boolean;
  showModal: boolean;
  editingConfig: ImportConfig | null;
  form: FormInstance;
  fieldMappings: FieldMappingUI[];
  validationRules: ValidationRuleUI[];
  selectedModule: string;
  submitting: boolean;
  onAdd: () => void;
  onEdit: (config: ImportConfig) => void;
  onDelete: (id: number) => void;
  onSetDefault: (id: number) => void;
  onClose: () => void;
  onSubmit: () => void;
  onModuleChange: (value: string) => void;
  onAddFieldMapping: () => void;
  onRemoveFieldMapping: (index: number) => void;
  onUpdateFieldMapping: (index: number, field: keyof FieldMapping, value: unknown) => void;
  onAddValidationRule: () => void;
  onRemoveValidationRule: (index: number) => void;
  onUpdateValidationRule: (index: number, field: keyof ValidationRule, value: unknown) => void;
}

const ImportConfigManagementView: React.FC<ImportConfigManagementViewProps> = ({
  configs,
  loading,
  loadError,
  showModal,
  editingConfig,
  form,
  fieldMappings,
  validationRules,
  selectedModule,
  submitting,
  onAdd,
  onEdit,
  onDelete,
  onSetDefault,
  onClose,
  onSubmit,
  onModuleChange,
  onAddFieldMapping,
  onRemoveFieldMapping,
  onUpdateFieldMapping,
  onAddValidationRule,
  onRemoveValidationRule,
  onUpdateValidationRule,
}) => {
  const columns = [
    {
      title: '配置名称',
      dataIndex: 'config_name',
      key: 'config_name',
      render: (text: string, record: ImportConfig) => (
        <div className='flex items-center gap-2'>
          {record.is_default && <Tag color='gold'>默认</Tag>}
          {text}
        </div>
      ),
    },
    {
      title: '所属模块',
      dataIndex: 'module_name',
      key: 'module_name',
      render: (text: string) => MODULE_OPTIONS.find((o) => o.value === text)?.label || text,
    },
    {
      title: '字段映射数',
      dataIndex: 'field_mappings',
      key: 'field_mappings',
      render: (mappings: FieldMappingUI[]) => mappings?.length || 0,
    },
    {
      title: '验证规则数',
      dataIndex: 'validation_rules',
      key: 'validation_rules',
      render: (rules: ValidationRuleUI[]) => rules?.length || 0,
    },
    {
      title: '冲突策略',
      dataIndex: 'conflict_strategy',
      key: 'conflict_strategy',
      render: (text: string) =>
        CONFLICT_STRATEGY_OPTIONS.find((o) => o.value === text)?.label || text,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) =>
        isActive ? (
          <Tag color='green'>
            <CheckCircle className='w-4 h-4' /> 启用
          </Tag>
        ) : (
          <Tag color='red'>
            <XCircle className='w-4 h-4' /> 禁用
          </Tag>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => formatDateTime(text, '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ImportConfig) => (
        <div className='flex items-center gap-2'>
          <Button
            type='text'
            icon={<Edit2 className='w-4 h-4' />}
            onClick={() => onEdit(record)}
            size='small'
          >
            编辑
          </Button>
          {!record.is_default && (
            <Button
              type='text'
              icon={<Trash2 className='w-4 h-4' />}
              onClick={() => onDelete(record.id)}
              size='small'
              danger
            >
              删除
            </Button>
          )}
          {!record.is_default && (
            <Button type='text' onClick={() => onSetDefault(record.id)} size='small'>
              设为默认
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-slate-900 p-4 md:p-6'>
      {loadError && (
        <div className='mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30'>
          <AlertTriangle className='w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0' />
          <p className='text-sm text-amber-700 dark:text-amber-300'>
            导入配置加载失败，当前列表可能不完整，请刷新重试
          </p>
        </div>
      )}
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center'>
            <Settings className='w-5 h-5 text-primary-600 dark:text-primary-400' />
          </div>
          <div>
            <h1 className='text-xl font-bold text-gray-800 dark:text-white'>导入配置管理</h1>
            <p className='text-sm text-gray-500 dark:text-slate-400'>
              管理系统各模块的导入配置，包括字段映射、验证规则和冲突处理策略
            </p>
          </div>
        </div>
        <Button type='primary' icon={<Plus className='w-4 h-4' />} onClick={onAdd}>
          添加配置
        </Button>
      </div>

      <div className='bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden'>
        <div className='p-4 border-b border-gray-200 dark:border-slate-700'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-2'>
              <FileText className='w-4 h-4 text-gray-500' />
              <span className='text-sm font-medium text-gray-700 dark:text-slate-300'>
                已配置 {configs.length} 个导入方案
              </span>
            </div>
          </div>
        </div>
        <Table
          columns={columns}
          dataSource={configs}
          rowKey='id'
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 条记录`,
          }}
          className='px-4'
        />
      </div>

      <Modal
        title={editingConfig ? '编辑导入配置' : '添加导入配置'}
        open={showModal}
        onOk={onSubmit}
        confirmLoading={submitting}
        onCancel={onClose}
        width={800}
        destroyOnHidden
      >
        <Form form={form} layout='vertical'>
          <div className='grid grid-cols-2 gap-4'>
            <Form.Item
              name='config_name'
              label='配置名称'
              rules={[{ required: true, message: '请输入配置名称' }]}
            >
              <Input placeholder='例如：标准导入配置' />
            </Form.Item>
            <Form.Item
              name='module_name'
              label='所属模块'
              rules={[{ required: true, message: '请选择所属模块' }]}
            >
              <Select options={MODULE_OPTIONS} onChange={onModuleChange} />
            </Form.Item>
          </div>

          <Form.Item name='description' label='描述'>
            <Input.TextArea placeholder='描述此配置的用途' rows={2} />
          </Form.Item>

          <div className='mb-4'>
            <h3 className='text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3'>
              字段映射配置
            </h3>
            <div className='space-y-2'>
              {fieldMappings.map((mapping, index) => (
                <div
                  key={index}
                  className='flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg'
                >
                  <div className='flex-1'>
                    <Input
                      placeholder='源字段（Excel列名）'
                      value={mapping.source_field}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onUpdateFieldMapping(index, 'source_field', e.target.value)
                      }
                      className='mb-2'
                    />
                    <div className='flex gap-2'>
                      <Select
                        options={TARGET_FIELD_MAP[selectedModule]?.options || []}
                        value={mapping.target_field}
                        onChange={(value: string) =>
                          onUpdateFieldMapping(index, 'target_field', value)
                        }
                        placeholder='目标字段'
                        style={{ width: 160 }}
                      />
                      <Select
                        options={FIELD_TYPE_OPTIONS}
                        value={mapping.field_type}
                        onChange={(value: string) =>
                          onUpdateFieldMapping(index, 'field_type', value)
                        }
                        placeholder='字段类型'
                        style={{ width: 120 }}
                      />
                      <Select
                        options={RELATION_OPTIONS}
                        value={mapping.relation || ''}
                        onChange={(value: string) => onUpdateFieldMapping(index, 'relation', value)}
                        placeholder='关联类型'
                        style={{ width: 120 }}
                      />
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm text-gray-500'>必填</span>
                    <Switch
                      checked={mapping.required}
                      onChange={(checked: boolean) =>
                        onUpdateFieldMapping(index, 'required', checked)
                      }
                    />
                    <Button
                      type='text'
                      danger
                      size='small'
                      onClick={() => onRemoveFieldMapping(index)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button type='dashed' block onClick={onAddFieldMapping} className='mt-2'>
              添加字段映射
            </Button>
          </div>

          <div className='mb-4'>
            <h3 className='text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3'>
              数据验证规则
            </h3>
            <div className='space-y-2'>
              {validationRules.map((rule, index) => (
                <div
                  key={index}
                  className='flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg'
                >
                  <div className='flex-1'>
                    <Select
                      options={TARGET_FIELD_MAP[selectedModule]?.options || []}
                      value={rule.field}
                      onChange={(value: string) => onUpdateValidationRule(index, 'field', value)}
                      placeholder='验证字段'
                      style={{ width: 160 }}
                      className='mb-2'
                    />
                    <div className='flex gap-2'>
                      <Select
                        options={RULE_TYPE_OPTIONS}
                        value={rule.rule_type}
                        onChange={(value: string) =>
                          onUpdateValidationRule(index, 'rule_type', value)
                        }
                        placeholder='规则类型'
                        style={{ width: 140 }}
                      />
                      {rule.rule_type === 'max_length' && (
                        <Input
                          type='number'
                          placeholder='最大长度'
                          value={(rule.params as Record<string, number>)?.max ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            onUpdateValidationRule(index, 'params', {
                              max: parseInt(e.target.value) || 0,
                            })
                          }
                          style={{ width: 100 }}
                        />
                      )}
                      {rule.rule_type === 'min_length' && (
                        <Input
                          type='number'
                          placeholder='最小长度'
                          value={(rule.params as Record<string, number>)?.min ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            onUpdateValidationRule(index, 'params', {
                              min: parseInt(e.target.value) || 0,
                            })
                          }
                          style={{ width: 100 }}
                        />
                      )}
                      {rule.rule_type === 'regex' && (
                        <Input
                          placeholder='正则表达式'
                          value={(rule.params as Record<string, string>)?.pattern ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            onUpdateValidationRule(index, 'params', { pattern: e.target.value })
                          }
                          style={{ width: 160 }}
                        />
                      )}
                    </div>
                    <Input
                      placeholder='错误提示信息'
                      value={rule.message}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onUpdateValidationRule(index, 'message', e.target.value)
                      }
                      className='mt-2'
                    />
                  </div>
                  <Button
                    type='text'
                    danger
                    size='small'
                    onClick={() => onRemoveValidationRule(index)}
                  >
                    删除
                  </Button>
                </div>
              ))}
            </div>
            <Button type='dashed' block onClick={onAddValidationRule} className='mt-2'>
              添加验证规则
            </Button>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <Form.Item
              name='conflict_strategy'
              label='冲突处理策略'
              rules={[{ required: true, message: '请选择冲突处理策略' }]}
            >
              <Select options={CONFLICT_STRATEGY_OPTIONS} />
            </Form.Item>
            <Form.Item name='is_active' label='启用状态' valuePropName='checked'>
              <Switch defaultChecked />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ImportConfigManagementView;
