// 简体中文语言包（默认语言）。
// 键结构：common.* 为跨页面通用文案；login.* 为登录页专用文案。
// 后续批次按此结构向 en-US 对齐补齐。
const zhCN = {
  common: {
    cancel: '取消',
    confirm: '确定',
    save: '保存',
    delete: '删除',
    search: '搜索',
    refresh: '刷新',
    loading: '加载中...',
    loadFailed: '加载失败',
    refreshPage: '刷新页面',
  },
  login: {
    title: '积分管理平台',
    subtitle: '请登录以继续',
    secureHint: '安全登录 - 数据已加密',
    username: '用户名',
    password: '密码',
    usernamePlaceholder: '请输入用户名',
    passwordPlaceholder: '请输入密码',
    submit: '登录',
    copyright: '© 2024 积分管理平台',
    errorDefault: '登录失败，请检查用户名和密码',
    passwordMismatch: '两次输入的密码不一致',
    passwordTooShort: '密码长度至少为6位',
    noUserInfo: '无法获取用户信息',
    changePasswordFailed: '修改密码失败',
    forceChangeTitle: '强制修改密码',
    forceChangeDesc: '首次登录或密码已过期，请设置新密码',
    currentPassword: '当前密码',
    newPassword: '新密码',
    confirmNewPassword: '确认新密码',
    newPasswordPlaceholder: '请输入新密码（至少6位）',
    confirmPlaceholder: '请再次输入新密码',
    cancelLogin: '取消登录',
    changing: '修改中',
    changeAndLogin: '修改密码并登录',
  },
};

export default zhCN;
