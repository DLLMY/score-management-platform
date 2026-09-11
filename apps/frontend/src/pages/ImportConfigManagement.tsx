import logger from '../utils/logger';
import React, { useState, useEffect, useRef } from 'react';
import { Form } from 'antd';
import api from '../services/api';
import { useStableToast, useSubmitGuard } from '../hooks';
import type { ImportConfig } from '../services/api';
import { useConfirm } from '../components';
import ImportConfigManagementView, {
  type FieldMappingUI,
  type ValidationRuleUI,
} from './importConfigManagement/ImportConfigManagementView';

const defaultMappings: Record<string, FieldMappingUI[]> = {
  classes: [
    { source_field: '班级名称', target_field: 'name', field_type: 'string', required: true },
    { source_field: '年级', target_field: 'grade', field_type: 'string', required: false },
    { source_field: '描述', target_field: 'description', field_type: 'string', required: false },
    {
      source_field: '班主任ID',
      target_field: 'head_teacher_id',
      field_type: 'integer',
      required: false,
      relation: 'admin',
    },
    {
      source_field: '班主任姓名',
      target_field: 'head_teacher_name',
      field_type: 'string',
      required: false,
      relation: 'admin',
    },
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
    {
      source_field: '班级名称',
      target_field: 'class_name',
      field_type: 'string',
      required: true,
      relation: 'class_info',
    },
    {
      source_field: '科目名称',
      target_field: 'subject_name',
      field_type: 'string',
      required: true,
      relation: 'subject',
    },
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
  const confirmFn = useConfirm();
  const confirmRef = useRef(confirmFn);
  confirmRef.current = confirmFn;
  const { submitting, run: runSubmit } = useSubmitGuard();

  useEffect(() => {
    fetchConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      logger.error('获取导入配置失败:', error);
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
    const ok = await confirmRef.current({
      message: '确定要删除该导入配置吗？',
      confirmText: '确定',
      cancelText: '取消',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await api.importConfig.delete(id);
      showToast('success', '删除成功');
      fetchConfigs();
    } catch (error) {
      logger.error('删除配置失败:', error);
      showToast('error', '删除失败');
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await api.importConfig.setDefault(id);
      showToast('success', '已设为默认配置');
      fetchConfigs();
    } catch (error) {
      logger.error('设置默认配置失败:', error);
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
    setFieldMappings([
      ...fieldMappings,
      { source_field: '', target_field: '', field_type: 'string', required: false },
    ]);
  };

  const handleRemoveFieldMapping = (index: number) => {
    const newMappings = fieldMappings.filter((_, i) => i !== index);
    setFieldMappings(newMappings);
  };

  const handleUpdateFieldMapping = (
    index: number,
    field: keyof FieldMappingUI,
    value: unknown
  ): void => {
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

  const handleUpdateValidationRule = (
    index: number,
    field: keyof ValidationRuleUI,
    value: unknown
  ) => {
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
      logger.error('提交失败:', error);
      showToast('error', '提交失败');
    }
  };

  const handleSubmitModal = () => {
    runSubmit(handleSubmit);
  };

  return (
    <ImportConfigManagementView
      configs={configs}
      loading={loading}
      loadError={loadError}
      showModal={showModal}
      editingConfig={editingConfig}
      form={form}
      fieldMappings={fieldMappings}
      validationRules={validationRules}
      selectedModule={selectedModule}
      submitting={submitting}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onSetDefault={handleSetDefault}
      onClose={() => setShowModal(false)}
      onSubmit={handleSubmitModal}
      onModuleChange={handleModuleChange}
      onAddFieldMapping={handleAddFieldMapping}
      onRemoveFieldMapping={handleRemoveFieldMapping}
      onUpdateFieldMapping={handleUpdateFieldMapping}
      onAddValidationRule={handleAddValidationRule}
      onRemoveValidationRule={handleRemoveValidationRule}
      onUpdateValidationRule={handleUpdateValidationRule}
    />
  );
};

export default ImportConfigManagement;
