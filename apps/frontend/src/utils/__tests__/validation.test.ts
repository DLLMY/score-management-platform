import { describe, it, expect } from 'vitest';
import { validateField, validateForm, validationRules } from '../validation';

describe('validation · validateField（单字段）', () => {
  it('required：空/空白/空数组判否，有值判真', () => {
    expect(validateField(null, ['required'])).toBe('此字段为必填项');
    expect(validateField(undefined, ['required'])).toBe('此字段为必填项');
    expect(validateField('', ['required'])).toBe('此字段为必填项');
    expect(validateField('   ', ['required'])).toBe('此字段为必填项');
    expect(validateField([], ['required'])).toBe('此字段为必填项');
    expect(validateField('x', ['required'])).toBeNull();
    expect(validateField([1], ['required'])).toBeNull();
    expect(validateField(0, ['required'])).toBeNull();
  });

  it('email / phone / cardId：正则校验，空值放行', () => {
    expect(validateField('a@b.com', ['email'])).toBeNull();
    expect(validateField('bad', ['email'])).toBe('请输入有效的邮箱地址');
    expect(validateField('', ['email'])).toBeNull();

    expect(validateField('13800138000', ['phone'])).toBeNull();
    expect(validateField('12345', ['phone'])).toBe('请输入有效的手机号码');
    expect(validateField('', ['phone'])).toBeNull();

    expect(validateField('ABCD1234', ['cardId'])).toBeNull();
    expect(validateField('AB', ['cardId'])).toBe('饭卡号只能包含字母和数字，长度4-20位');
  });

  it('numeric / integer / positive', () => {
    expect(validateField('3.14', ['numeric'])).toBeNull();
    expect(validateField('abc', ['numeric'])).toBe('请输入有效的数字');
    expect(validateField('3.5', ['integer'])).toBe('请输入有效的整数');
    expect(validateField('-2', ['positive'])).toBe('请输入正数');
    expect(validateField('5', ['positive'])).toBeNull();
  });

  it('min/max/minLength/maxLength：带参且 message 为函数', () => {
    expect(validateField('3', [{ min: 5 }])).toBe('最小值为 5');
    expect(validateField('7', [{ min: 5 }])).toBeNull();
    expect(validateField('10', [{ max: 5 }])).toBe('最大值为 5');
    expect(validateField('abcde', [{ minLength: 3 }])).toBeNull();
    expect(validateField('ab', [{ minLength: 3 }])).toBe('最少需要 3 个字符');
    expect(validateField('abcd', [{ maxLength: 3 }])).toBe('最多允许 3 个字符');
  });

  it('pattern / score / className', () => {
    expect(validateField('2026', [{ pattern: '^\\d{4}$' }])).toBeNull();
    expect(validateField('xy', [{ pattern: '^\\d{4}$' }])).toBe('格式不正确');
    expect(validateField('500', ['score'])).toBeNull();
    expect(validateField('2000', ['score'])).toBe('积分值必须在 -1000 到 1000 之间');
    expect(validateField('一班', ['className'])).toBeNull();
    expect(validateField('', ['className'])).toBeNull();
    expect(validateField('x'.repeat(51), ['className'])).toBe('班级名称不能为空，长度不超过50字符');
  });

  it('多规则串联：首个失败即返回对应 message', () => {
    expect(validateField('', ['required', 'email'])).toBe('此字段为必填项');
    expect(validateField('bad', ['required', 'email'])).toBe('请输入有效的邮箱地址');
    expect(validateField('ok@x.com', ['required', 'email'])).toBeNull();
  });

  it('未知规则 / 校验通过 → null', () => {
    expect(validateField('anything', ['not_a_real_rule'])).toBeNull();
    expect(validateField('x', ['required'])).toBeNull();
  });
});

describe('validation · validateForm（整表）', () => {
  it('数组式规则：收集错误并标记 isValid=false', () => {
    const result = validateForm({ name: '', age: 'abc' }, { name: ['required'], age: ['numeric'] });
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBe('此字段为必填项');
    expect(result.errors.age).toBe('请输入有效的数字');
  });

  it('对象式规则（rule: true 展开为规则名，非 true 为带参规则）', () => {
    const result = validateForm(
      { title: 'ab', count: '2', note: 'ok' },
      {
        title: { required: true, minLength: 5 },
        count: { required: true, min: 10 },
        note: { required: true },
      }
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.title).toBe('最少需要 5 个字符');
    expect(result.errors.count).toBe('最小值为 10');
    expect(result.errors.note).toBeUndefined();
  });

  it('全部通过 → isValid=true 且无 errors', () => {
    const result = validateForm(
      { title: 'hello', count: '20' },
      { title: { required: true, minLength: 3 }, count: { required: true, min: 10 } }
    );
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });
});

describe('validation · 规则表导出', () => {
  it('validationRules 含全部内置规则', () => {
    for (const key of [
      'required',
      'email',
      'phone',
      'numeric',
      'integer',
      'positive',
      'min',
      'max',
      'minLength',
      'maxLength',
      'pattern',
      'cardId',
      'className',
      'score',
    ]) {
      expect(validationRules[key]).toBeDefined();
    }
  });
});
