import { useState, useCallback, useRef } from 'react';

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  validate?: (value: unknown) => string | undefined;
}

export type ValidationRules<T> = Partial<Record<keyof T, ValidationRule>>;

export type FormErrors<T> = Partial<Record<keyof T, string | undefined>>;

export interface UseFormResult<T> {
  formData: T;
  errors: FormErrors<T>;
  isSubmitting: boolean;
  touched: Set<keyof T>;
  handleChange: <K extends keyof T>(field: K, value: T[K]) => void;
  handleChangeEvent: <K extends keyof T>(field: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleSubmit: (onSubmit: (data: T) => Promise<void>) => (e: React.FormEvent) => Promise<void>;
  setFormData: (data: Partial<T> | ((prev: T) => Partial<T>)) => void;
  resetForm: () => void;
  validateField: <K extends keyof T>(field: K) => void;
  validateAll: () => boolean;
  setErrors: (errors: Partial<FormErrors<T>>) => void;
  markTouched: <K extends keyof T>(field: K) => void;
}

export function useForm<T extends Record<string, unknown>>(
  initialData: T,
  validationRules?: ValidationRules<T>
): UseFormResult<T> {
  const [formData, setFormDataState] = useState<T>(initialData);
  const [errors, setErrorsState] = useState<FormErrors<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState<Set<keyof T>>(new Set());
  const initialDataRef = useRef(initialData);

  const validateValue = useCallback((field: keyof T, value: unknown): string | undefined => {
    const rule = validationRules?.[field];
    if (!rule) return undefined;

    if (rule.required && (value === undefined || value === null || value === '')) {
      return '此字段为必填项';
    }

    if (rule.required && Array.isArray(value) && value.length === 0) {
      return '此字段为必填项';
    }

    if (typeof value === 'string') {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        return `最少需要 ${rule.minLength} 个字符`;
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        return `最多允许 ${rule.maxLength} 个字符`;
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        return '格式不正确';
      }
    }

    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return `最小值为 ${rule.min}`;
      }
      if (rule.max !== undefined && value > rule.max) {
        return `最大值为 ${rule.max}`;
      }
    }

    if (rule.validate) {
      return rule.validate(value);
    }

    return undefined;
  }, [validationRules]);

  const validateFieldRef = useRef<(<K extends keyof T>(field: K) => boolean) | null>(null);

  const validateField = useCallback(<K extends keyof T>(field: K) => {
    const error = validateValue(field, formData[field]);
    setErrorsState((prev) => ({
      ...prev,
      [field]: error,
    }));
    return !error;
  }, [validateValue, formData]);

  validateFieldRef.current = validateField;

  const handleChange = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormDataState((prev) => ({ ...prev, [field]: value }));
    if (touched.has(field)) {
      validateFieldRef.current?.(field);
    }
  }, [touched]);

  const handleChangeEvent = useCallback(<K extends keyof T>(field: K) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const target = e.target;
    const value = target.type === 'checkbox'
      ? (target as HTMLInputElement).checked
      : target.type === 'number'
      ? target.value === '' ? '' : Number(target.value)
      : target.value;
    handleChange(field, value as T[K]);
  }, [handleChange]);

  const validateAll = useCallback((): boolean => {
    const newErrors: FormErrors<T> = {};
    Object.keys(formData).forEach((key) => {
      const field = key as keyof T;
      const error = validateValue(field, formData[field]);
      if (error) {
        newErrors[field] = error;
      }
    });
    setErrorsState(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [validateValue, formData]);

  const handleSubmit = useCallback((onSubmit: (data: T) => Promise<void>) => async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    
    if (!validateAll()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  }, [validateAll, formData]);

  const setFormData = useCallback((data: Partial<T> | ((prev: T) => Partial<T>)) => {
    setFormDataState((prev) => {
      const newData = typeof data === 'function' ? data(prev) : data;
      return { ...prev, ...newData };
    });
  }, []);

  const resetForm = useCallback(() => {
    setFormDataState(initialDataRef.current);
    setErrorsState({});
    setTouched(new Set());
  }, []);

  const setErrors = useCallback((errors: Partial<FormErrors<T>>) => {
    setErrorsState(errors as FormErrors<T>);
  }, []);

  const markTouched = useCallback(<K extends keyof T>(field: K) => {
    setTouched((prev) => new Set(prev).add(field));
    validateField(field);
  }, [validateField]);

  return {
    formData,
    errors,
    isSubmitting,
    touched,
    handleChange,
    handleChangeEvent,
    handleSubmit,
    setFormData,
    resetForm,
    validateField,
    validateAll,
    setErrors,
    markTouched,
  };
}