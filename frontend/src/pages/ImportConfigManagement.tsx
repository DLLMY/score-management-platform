import React, { useState, useEffect } from 'react';
import { Button, Table, Modal, Form, Input, Select, Switch, Tag } from 'antd';
import { Plus, Edit2, Trash2, CheckCircle, XCircle, Settings, FileText, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useStableToast } from '../hooks/useStableToast';
import type { ImportConfig, FieldMapping, ValidationRule } from '../services/api';

interface FieldMappingUI extends FieldMapping {
  id?: number;
}

interface ValidationRuleUI extends ValidationRule {
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

const TARGET_FIELD_MAP: Record<string, { label: string; options: { value: string; label: string }[] }> = {
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

const defaultMappings: Record<string, FieldMappingUI[]> = {
  classes: [
    { source_field: '班级名称', target_field: 'name', field_type: 'string', required: true },
    { source_field: '年级', target_field: 'grade', field_type: 'string', required: false },
    { source_field: '描述', target_field: 'description', field_type: 'string', required: false },
    { source_field: '班主任ID', target_field: 'head_teacher_id', field_type: 'integer', required: false, relation: 'admin' },
    { source_field: '班主任姓名', target_field: 'head_teacher_name', field_type: 'string', required: false, relation: 'admin' },
    { source_field: '是否启用', target_field: 'is_active', field_type: 'boolean', required: false },
  ],
  subjects: [
    { source_field: '科目名称', target_field: 'name', field_type: 'string', required: true },
    { source_field: '科目代码', target_field: 'code', field_type: 'string', required: false },
    { source_field: '年级', target_field: 'grade', field_type: 'string', required: false },
    { source_field: '描述', target_field: 'description', field_type: 'string', required: false },
    { source_field: '颜色', target_field: 'color', field_type: 'string', required: false },
    { source_field: '是否启用', target_field: 'is_active', field_type: 'boolean', required: false },
  ],
  course_schedule: [
    { source_field: '班级名称', target_field: 'class_name', field_type: 'string', required: true, relation: 'class_info' },
    { source_field: '科目名称', target_field: 'subject_name', field_type: 'string', required: true, relation: 'subject' },
    { source_field: '星期', target_field: 'day_of_week', field_type: 'string', required: true },
    { source_field: '节次', target_field: 'period_number', field_type: 'integer', required: true },
    { source_field: '教师', target_field: 'teacher_name', field_type: 'string', required: false },
    { source_field: '教室', target_field: 'classroom', field_type: 'string', required: false },
    { source_field: '备注', target_field: 'description', field_type: 'string', required: false },
    { source_field: '是否启用', target_field: 'is_active', field_type: 'boolean', required: false },
  ],
};

const ImportConfigManagement: React.FC = () => {
  const [configs, setConfigs] = useState<ImportConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ImportConfig | null>(null);
  const [form] = Form.useForm();
  const [fieldMappings, setFieldMappings] = useState<FieldMappingUI[]>([]);
  const [validationRules, setValidationRules] = useState<ValidationRuleUI[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>('classes');
  const { showToast } = useStableToast();

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await api.importConfig.list();
      if (response) {
        setConfigs(response);
        setLoadError(false);
      }
    } catch (error) {
      console.error('获取导入配置失败:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingConfig(null);
    setSelectedModule('classes');
    setFieldMappings([...defaultMappings.classes]);
    setValidationRules([]);
    form.resetFields();
    setShowModal(true);
  };

  const handleEdit = (config: ImportConfig) => {
    setEditingConfig(config);
    setSelectedModule(config.module_name);
    setFieldMappings(config.field_mappings || []);
    setValidationRules(config.validation_rules || []);
    form.setFieldsValue({
      config_name: config.config_name,
      module_name: config.module_name,
      conflict_strategy: config.conflict_strategy,
      is_active: config.is_active,
      description: config.description,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.importConfig.delete(id);
      showToast('success', '删除成功');
      fetchConfigs();
    } catch (error) {
      console.error('删除配置失败:', error);
      showToast('error', '删除失败');
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await api.importConfig.setDefault(id);
      showToast('success', '已设为默认配置');
      fetchConfigs();
    } catch (error) {
      console.error('设置默认配置失败:', error);
      showToast('error', '设置失败');
    }
  };

  const handleModuleChange = (value: string) => {
    setSelectedModule(value);
    if (!editingConfig) {
      setFieldMappings([...(defaultMappings[value] || [])]);
    }
  };

  const handleAddFieldMapping = () => {
    setFieldMappings([...fieldMappings, { source_field: '', target_field: '', field_type: 'string', required: false }]);
  };

  const handleRemoveFieldMapping = (index: number) => {
    const newMappings = fieldMappings.filter((_, i) => i !== index);
    setFieldMappings(newMappings);
  };

  const handleUpdateFieldMapping = (index: number, field: keyof FieldMapping, value: unknown) => {
    const newMappings = [...fieldMappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setFieldMappings(newMappings);
  };

  const handleAddValidationRule = () => {
    setValidationRules([...validationRules, { field: '', rule_type: 'required' }]);
  };

  const handleRemoveValidationRule = (index: number) => {
    const newRules = validationRules.filter((_, i) => i !== index);
    setValidationRules(newRules);
  };

  const handleUpdateValidationRule = (index: number, field: keyof ValidationRule, value: unknown) => {
    const newRules = [...validationRules];
    newRules[index] = { ...newRules[index], [field]: value };
    setValidationRules(newRules);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        field_mappings: fieldMappings,
        validation_rules: validationRules,
      };

      if (editingConfig) {
        await api.importConfig.update(editingConfig.id, data);
        showToast('success', '更新成功');
      } else {
        await api.importConfig.create(data);
        showToast('success', '创建成功');
      }

      setShowModal(false);
      fetchConfigs();
    } catch (error) {
      console.error('提交失败:', error);
      showToast('error', '提交失败');
    }
  };

  const columns = [
    {
      title: '配置名称',
      dataIndex: 'config_name',
      key: 'config_name',
      render: (text: string, record: ImportConfig) => (
        <div className="flex items-center gap-2">
          {record.is_default && <Tag color="gold">默认</Tag>}
          {text}
        </div>
      ),
    },
    {
      title: '所属模块',
      dataIndex: 'module_name',
      key: 'module_name',
      render: (text: string) => MODULE_OPTIONS.find(o => o.value === text)?.label || text,
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
      render: (text: string) => CONFLICT_STRATEGY_OPTIONS.find(o => o.value === text)?.label || text,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (isActive: boolean) => isActive ? (
        <Tag color="green"><CheckCircle className="w-4 h-4" /> 启用</Tag>
      ) : (
        <Tag color="red"><XCircle className="w-4 h-4" /> 禁用</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => text ? new Date(text).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ImportConfig) => (
        <div className="flex items-center gap-2">
          <Button
            type="text"
            icon={<Edit2 className="w-4 h-4" />}
            onClick={() => handleEdit(record)}
            size="small"
          >
            编辑
          </Button>
          {!record.is_default && (
            <Button
              type="text"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => handleDelete(record.id)}
              size="small"
              danger
            >
              删除
            </Button>
          )}
          {!record.is_default && (
            <Button
              type="text"
              onClick={() => handleSetDefault(record.id)}
              size="small"
            >
              设为默认
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 md:p-6">
      {loadError && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">导入配置加载失败，当前列表可能不完整，请刷新重试</p>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">导入配置管理</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">管理系统各模块的导入配置，包括字段映射、验证规则和冲突处理策略</p>
          </div>
        </div>
        <Button
          type="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={handleAdd}
        >
          添加配置
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">已配置 {configs.length} 个导入方案</span>
            </div>
          </div>
        </div>
        <Table
          columns={columns}
          dataSource={configs}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total: number) => `共 ${total} 条记录`,
          }}
          className="px-4"
        />
      </div>

      <Modal
        title={editingConfig ? '编辑导入配置' : '添加导入配置'}
        open={showModal}
        onOk={handleSubmit}
        onCancel={() => setShowModal(false)}
        width={800}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="config_name"
              label="配置名称"
              rules={[{ required: true, message: '请输入配置名称' }]}
            >
              <Input placeholder="例如：标准导入配置" />
            </Form.Item>
            <Form.Item
              name="module_name"
              label="所属模块"
              rules={[{ required: true, message: '请选择所属模块' }]}
            >
              <Select
                options={MODULE_OPTIONS}
                onChange={handleModuleChange}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="描述此配置的用途" rows={2} />
          </Form.Item>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">字段映射配置</h3>
            <div className="space-y-2">
              {fieldMappings.map((mapping, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg"
                >
                  <div className="flex-1">
                    <Input
                      placeholder="源字段（Excel列名）"
                      value={mapping.source_field}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateFieldMapping(index, 'source_field', e.target.value)}
                      className="mb-2"
                    />
                    <div className="flex gap-2">
                      <Select
                        options={TARGET_FIELD_MAP[selectedModule]?.options || []}
                        value={mapping.target_field}
                        onChange={(value: string) => handleUpdateFieldMapping(index, 'target_field', value)}
                        placeholder="目标字段"
                        style={{ width: 160 }}
                      />
                      <Select
                        options={FIELD_TYPE_OPTIONS}
                        value={mapping.field_type}
                        onChange={(value: string) => handleUpdateFieldMapping(index, 'field_type', value)}
                        placeholder="字段类型"
                        style={{ width: 120 }}
                      />
                      <Select
                        options={RELATION_OPTIONS}
                        value={mapping.relation || ''}
                        onChange={(value: string) => handleUpdateFieldMapping(index, 'relation', value)}
                        placeholder="关联类型"
                        style={{ width: 120 }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">必填</span>
                    <Switch
                      checked={mapping.required}
                      onChange={(checked: boolean) => handleUpdateFieldMapping(index, 'required', checked)}
                    />
                    <Button
                      type="text"
                      danger
                      size="small"
                      onClick={() => handleRemoveFieldMapping(index)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              type="dashed"
              block
              onClick={handleAddFieldMapping}
              className="mt-2"
            >
              添加字段映射
            </Button>
          </div>

          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">数据验证规则</h3>
            <div className="space-y-2">
              {validationRules.map((rule, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg"
                >
                  <div className="flex-1">
                    <Select
                      options={TARGET_FIELD_MAP[selectedModule]?.options || []}
                      value={rule.field}
                      onChange={(value: string) => handleUpdateValidationRule(index, 'field', value)}
                      placeholder="验证字段"
                      style={{ width: 160 }}
                      className="mb-2"
                    />
                    <div className="flex gap-2">
                      <Select
                        options={RULE_TYPE_OPTIONS}
                        value={rule.rule_type}
                        onChange={(value: string) => handleUpdateValidationRule(index, 'rule_type', value)}
                        placeholder="规则类型"
                        style={{ width: 140 }}
                      />
                      {rule.rule_type === 'max_length' && (
                        <Input
                          type="number"
                          placeholder="最大长度"
                          value={(rule.params as Record<string, number>)?.max ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateValidationRule(index, 'params', { max: parseInt(e.target.value) || 0 })}
                          style={{ width: 100 }}
                        />
                      )}
                      {rule.rule_type === 'min_length' && (
                        <Input
                          type="number"
                          placeholder="最小长度"
                          value={(rule.params as Record<string, number>)?.min ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateValidationRule(index, 'params', { min: parseInt(e.target.value) || 0 })}
                          style={{ width: 100 }}
                        />
                      )}
                      {rule.rule_type === 'regex' && (
                        <Input
                          placeholder="正则表达式"
                          value={(rule.params as Record<string, string>)?.pattern ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateValidationRule(index, 'params', { pattern: e.target.value })}
                          style={{ width: 160 }}
                        />
                      )}
                    </div>
                    <Input
                      placeholder="错误提示信息"
                      value={rule.message}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleUpdateValidationRule(index, 'message', e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <Button
                    type="text"
                    danger
                    size="small"
                    onClick={() => handleRemoveValidationRule(index)}
                  >
                    删除
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="dashed"
              block
              onClick={handleAddValidationRule}
              className="mt-2"
            >
              添加验证规则
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="conflict_strategy"
              label="冲突处理策略"
              rules={[{ required: true, message: '请选择冲突处理策略' }]}
            >
              <Select options={CONFLICT_STRATEGY_OPTIONS} />
            </Form.Item>
            <Form.Item name="is_active" label="启用状态" valuePropName="checked">
              <Switch defaultChecked />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ImportConfigManagement;