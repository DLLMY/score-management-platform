const validationRules = {
  required: {
    validate: (value) => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    },
    message: '此字段为必填项',
  },

  email: {
    validate: (value) => {
      if (!value) return true;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value);
    },
    message: '请输入有效的邮箱地址',
  },

  phone: {
    validate: (value) => {
      if (!value) return true;
      const phoneRegex = /^1[3-9]\d{9}$/;
      return phoneRegex.test(value);
    },
    message: '请输入有效的手机号码',
  },

  numeric: {
    validate: (value) => {
      if (!value) return true;
      return !isNaN(parseFloat(value)) && isFinite(value);
    },
    message: '请输入有效的数字',
  },

  integer: {
    validate: (value) => {
      if (!value) return true;
      const num = parseInt(value, 10);
      return !isNaN(num) && Number.isInteger(num);
    },
    message: '请输入有效的整数',
  },

  positive: {
    validate: (value) => {
      if (!value) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num > 0;
    },
    message: '请输入正数',
  },

  min: {
    validate: (value, min) => {
      if (!value) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num >= min;
    },
    message: (min) => `最小值为 ${min}`,
  },

  max: {
    validate: (value, max) => {
      if (!value) return true;
      const num = parseFloat(value);
      return !isNaN(num) && num <= max;
    },
    message: (max) => `最大值为 ${max}`,
  },

  minLength: {
    validate: (value, minLength) => {
      if (!value) return true;
      return value.length >= minLength;
    },
    message: (minLength) => `最少需要 ${minLength} 个字符`,
  },

  maxLength: {
    validate: (value, maxLength) => {
      if (!value) return true;
      return value.length <= maxLength;
    },
    message: (maxLength) => `最多允许 ${maxLength} 个字符`,
  },

  pattern: {
    validate: (value, pattern) => {
      if (!value) return true;
      const regex = new RegExp(pattern);
      return regex.test(value);
    },
    message: '格式不正确',
  },

  cardId: {
    validate: (value) => {
      if (!value) return true;
      const cardRegex = /^[0-9A-Za-z]{4,20}$/;
      return cardRegex.test(value);
    },
    message: '饭卡号只能包含字母和数字，长度4-20位',
  },

  className: {
    validate: (value) => {
      if (!value) return true;
      return value.trim().length > 0 && value.trim().length <= 50;
    },
    message: '班级名称不能为空，长度不超过50字符',
  },

  score: {
    validate: (value) => {
      if (!value) return true;
      const num = parseInt(value, 10);
      return !isNaN(num) && num >= -1000 && num <= 1000;
    },
    message: '积分值必须在 -1000 到 1000 之间',
  },
};

export const validateField = (value, rules) => {
  for (const rule of rules) {
    if (typeof rule === 'string') {
      const ruleConfig = validationRules[rule];
      if (ruleConfig && !ruleConfig.validate(value)) {
        return ruleConfig.message;
      }
    } else if (typeof rule === 'object') {
      const ruleName = Object.keys(rule)[0];
      const ruleConfig = validationRules[ruleName];
      const ruleValue = rule[ruleName];

      if (ruleConfig && !ruleConfig.validate(value, ruleValue)) {
        const message = ruleConfig.message;
        if (typeof message === 'function') {
          return message(ruleValue);
        }
        return message;
      }
    }
  }
  return null;
};

export const validateForm = (formData, fieldRules) => {
  const errors = {};
  let isValid = true;

  for (const [fieldName, rules] of Object.entries(fieldRules)) {
    const value = formData[fieldName];
    const error = validateField(value, rules);
    if (error) {
      errors[fieldName] = error;
      isValid = false;
    }
  }

  return { isValid, errors };
};

export { validationRules };
