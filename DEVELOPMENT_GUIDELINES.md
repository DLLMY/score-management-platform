# 开发规范

本文档旨在规范开发流程，防止重复出现之前遇到的问题（如字段缺失、无限循环、权限不足等）。

## 一、前端开发规范

### 1.1 Toast 提示使用规范

**问题背景**：使用 `useToast()` 直接返回的函数会导致引用不稳定，在 `useCallback`/`useEffect` 中使用时会触发无限循环。

**解决方案**：使用 `useStableToast()` Hook 代替 `useToast()`。

**正确用法**：
```typescript
import { useStableToast } from '../hooks/useStableToast';

function MyComponent() {
    const { showToast } = useStableToast();
    
    const handleError = useCallback(() => {
        showToast('error', '操作失败');
    }, []);
}
```

**禁止用法**：
```typescript
// ❌ 错误：showToast 引用不稳定
import { useToast } from '../hooks/useToast';

function MyComponent() {
    const { showToast } = useToast();
    
    const handleError = useCallback(() => {
        showToast('error', '操作失败');
    }, [showToast]); // showToast 变化会导致重新创建函数
}
```

### 1.2 useCallback 依赖管理

- 仅将必要的值放入依赖数组
- 使用 `useRef` 保存需要在回调中使用但不应触发重新渲染的值
- 避免将对象或数组直接放入依赖数组，考虑使用 `useMemo` 缓存

### 1.3 API 请求规范

- 使用 `usePermissions` Hook 获取权限，它已内置请求去重和缓存机制
- 避免在多个组件中重复调用相同的 API
- 对高频请求考虑使用缓存

## 二、后端开发规范

### 2.1 模型字段修改规范

**问题背景**：修改模型字段后，数据库表结构未同步更新，导致 500 错误。

**解决方案**：修改模型后，必须运行验证脚本和数据库迁移。

**操作流程**：
1. 修改 `backend/models/__init__.py` 中的模型定义
2. 创建数据库迁移脚本（参考 `fix_subject_fields.py`、`fix_course_schedule_fields.py`）
3. 运行迁移脚本更新数据库
4. 运行 `backend/validate_models.py` 验证字段一致性

### 2.2 角色权限规范

**问题背景**：超级管理员权限不足，新增角色缺少权限配置。

**解决方案**：
- `super_admin` 和 `admin` 角色应自动拥有所有权限（`'all'`）
- 新增角色时，必须在 `RolePermission` 表中配置对应的权限
- 修改权限逻辑后，运行 `backend/verify_permissions.py` 验证

### 2.3 API 路由规范

- 使用 `APIResponse` 统一返回格式
- 权限检查使用 `has_permission` 装饰器
- 错误处理使用统一的异常处理机制

## 三、数据库操作规范

### 3.1 数据初始化

- 使用 `backend/init_full_data.py` 初始化基础数据
- 修改初始化脚本后，重新运行确保数据一致性

### 3.2 字段命名

- 使用 snake_case 命名规范
- 确保模型字段与数据库表字段一致
- 添加新字段时，注意设置默认值或允许为空

## 四、提交前验证

### 4.1 自动化验证脚本

在提交代码前，必须运行根目录下的 `run_validation.py` 脚本：

```bash
python run_validation.py
```

该脚本会执行以下检查：
1. ✅ TypeScript 编译检查
2. ✅ 后端模型字段验证
3. ✅ 数据库权限验证

### 4.2 Pre-commit Hook

已配置 Git pre-commit hook，提交时会自动运行验证脚本。如果验证失败，提交将被取消。

**手动安装 hook**（首次克隆项目时）：
```bash
cp .git/hooks/pre-commit.sample .git/hooks/pre-commit
```

## 五、问题排查流程

### 5.1 500 错误排查

1. 检查后端日志，定位具体错误
2. 运行 `backend/validate_models.py` 检查字段缺失
3. 检查数据库表结构是否与模型一致

### 5.2 无限循环排查

1. 检查 `useEffect`/`useCallback` 的依赖数组
2. 确认是否使用了不稳定的引用（如 `showToast`）
3. 使用 React DevTools 的 Profiler 查看组件渲染次数

### 5.3 权限不足排查

1. 检查当前用户角色（`Admin.role` 字段）
2. 运行 `backend/verify_permissions.py` 验证权限数据
3. 检查 `backend/utils/permission.py` 中的权限判断逻辑

## 六、代码审查要点

- [ ] 是否使用 `useStableToast` 替代 `useToast`
- [ ] `useCallback`/`useEffect` 依赖是否合理
- [ ] 模型字段修改后是否创建了迁移脚本
- [ ] 权限配置是否正确
- [ ] 提交前是否运行了验证脚本

## 七、常用命令

| 命令 | 用途 |
|------|------|
| `python run_validation.py` | 运行完整验证 |
| `python backend/validate_models.py` | 验证模型字段 |
| `python backend/verify_permissions.py` | 验证权限数据 |
| `npx tsc --noEmit` | TypeScript 编译检查 |
| `python backend/init_full_data.py` | 初始化数据库数据 |