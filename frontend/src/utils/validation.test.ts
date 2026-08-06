import { describe, test, expect } from 'vitest';
import { validateField, validateForm } from './validation';

describe('validation', () => {
  describe('validateField', () => {
    test('should pass required rule with non-empty value', () => {
      const result = validateField('test', ['required']);
      expect(result).toBe(null);
    });

    test('should fail required rule with empty string', () => {
      const result = validateField('', ['required']);
      expect(result).toBe('此字段为必填项');
    });

    test('should fail required rule with null', () => {
      const result = validateField(null, ['required']);
      expect(result).toBe('此字段为必填项');
    });

    test('should fail required rule with undefined', () => {
      const result = validateField(undefined, ['required']);
      expect(result).toBe('此字段为必填项');
    });

    test('should pass email rule with valid email', () => {
      const result = validateField('test@example.com', ['email']);
      expect(result).toBe(null);
    });

    test('should fail email rule with invalid email', () => {
      const result = validateField('invalid-email', ['email']);
      expect(result).toBe('请输入有效的邮箱地址');
    });

    test('should pass phone rule with valid phone', () => {
      const result = validateField('13812345678', ['phone']);
      expect(result).toBe(null);
    });

    test('should fail phone rule with invalid phone', () => {
      const result = validateField('123456789', ['phone']);
      expect(result).toBe('请输入有效的手机号码');
    });

    test('should pass numeric rule with valid number', () => {
      const result = validateField('123', ['numeric']);
      expect(result).toBe(null);
    });

    test('should fail numeric rule with non-numeric', () => {
      const result = validateField('abc', ['numeric']);
      expect(result).toBe('请输入有效的数字');
    });

    test('should pass integer rule with valid integer', () => {
      const result = validateField('123', ['integer']);
      expect(result).toBe(null);
    });

    test('should fail integer rule with decimal', () => {
      const result = validateField('123.45', ['integer']);
      expect(result).toBe('请输入有效的整数');
    });

    test('should pass positive rule with positive number', () => {
      const result = validateField('10', ['positive']);
      expect(result).toBe(null);
    });

    test('should fail positive rule with zero', () => {
      const result = validateField('0', ['positive']);
      expect(result).toBe('请输入正数');
    });

    test('should fail positive rule with negative number', () => {
      const result = validateField('-5', ['positive']);
      expect(result).toBe('请输入正数');
    });

    test('should pass min rule with value >= min', () => {
      const result = validateField('10', [{ min: 5 }]);
      expect(result).toBe(null);
    });

    test('should fail min rule with value < min', () => {
      const result = validateField('3', [{ min: 5 }]);
      expect(result).toBe('最小值为 5');
    });

    test('should pass max rule with value <= max', () => {
      const result = validateField('5', [{ max: 10 }]);
      expect(result).toBe(null);
    });

    test('should fail max rule with value > max', () => {
      const result = validateField('15', [{ max: 10 }]);
      expect(result).toBe('最大值为 10');
    });

    test('should pass minLength rule with string >= minLength', () => {
      const result = validateField('abcde', [{ minLength: 5 }]);
      expect(result).toBe(null);
    });

    test('should fail minLength rule with string < minLength', () => {
      const result = validateField('abc', [{ minLength: 5 }]);
      expect(result).toBe('最少需要 5 个字符');
    });

    test('should pass maxLength rule with string <= maxLength', () => {
      const result = validateField('abc', [{ maxLength: 10 }]);
      expect(result).toBe(null);
    });

    test('should fail maxLength rule with string > maxLength', () => {
      const result = validateField('abcdefghijk', [{ maxLength: 10 }]);
      expect(result).toBe('最多允许 10 个字符');
    });

    test('should pass pattern rule with matching value', () => {
      const result = validateField('1234', [{ pattern: '^[0-9]+$' }]);
      expect(result).toBe(null);
    });

    test('should fail pattern rule with non-matching value', () => {
      const result = validateField('abc', [{ pattern: '^[0-9]+$' }]);
      expect(result).toBe('格式不正确');
    });

    test('should pass cardId rule with valid card ID', () => {
      const result = validateField('A12345', ['cardId']);
      expect(result).toBe(null);
    });

    test('should fail cardId rule with invalid card ID', () => {
      const result = validateField('AB', ['cardId']);
      expect(result).toBe('饭卡号只能包含字母和数字，长度4-20位');
    });

    test('should pass score rule with valid score', () => {
      const result = validateField('100', ['score']);
      expect(result).toBe(null);
    });

    test('should fail score rule with score > 1000', () => {
      const result = validateField('1500', ['score']);
      expect(result).toBe('积分值必须在 -1000 到 1000 之间');
    });

    test('should fail score rule with score < -1000', () => {
      const result = validateField('-1500', ['score']);
      expect(result).toBe('积分值必须在 -1000 到 1000 之间');
    });

    test('should pass multiple rules', () => {
      const result = validateField('test@example.com', ['required', 'email']);
      expect(result).toBe(null);
    });

    test('should fail on first rule violation', () => {
      const result = validateField('', ['required', 'email']);
      expect(result).toBe('此字段为必填项');
    });
  });

  describe('validateForm', () => {
    test('should validate form with multiple fields', () => {
      const formData = {
        name: 'John',
        email: 'john@example.com',
        phone: '13812345678',
        age: '25',
      };

      const fieldRules = {
        name: ['required'],
        email: ['required', 'email'],
        phone: ['required', 'phone'],
        age: ['required', 'integer', { min: 1 }, { max: 100 }],
      };

      const result = validateForm(formData, fieldRules);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    test('should return errors for invalid form', () => {
      const formData = {
        name: '',
        email: 'invalid-email',
        phone: '123',
        age: 'abc',
      };

      const fieldRules = {
        name: ['required'],
        email: ['required', 'email'],
        phone: ['required', 'phone'],
        age: ['required', 'integer'],
      };

      const result = validateForm(formData, fieldRules);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe('此字段为必填项');
      expect(result.errors.email).toBe('请输入有效的邮箱地址');
      expect(result.errors.phone).toBe('请输入有效的手机号码');
      expect(result.errors.age).toBe('请输入有效的整数');
    });

    test('should handle empty form data', () => {
      const formData = {};
      const fieldRules = {
        name: ['required'],
      };

      const result = validateForm(formData, fieldRules);
      expect(result.isValid).toBe(false);
      expect(result.errors.name).toBe('此字段为必填项');
    });

    test('should handle rules object format', () => {
      const formData = {
        username: 'test',
        password: 'short',
      };

      const fieldRules = {
        username: { required: true, minLength: 3 },
        password: { required: true, minLength: 8 },
      };

      const result = validateForm(formData, fieldRules);
      expect(result.isValid).toBe(false);
      expect(result.errors.password).toBe('最少需要 8 个字符');
    });
  });
});