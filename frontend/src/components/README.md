# 组件库文档

## 概述

本组件库提供了一套可复用的 React 组件和自定义 Hook，用于构建管理后台应用。所有组件均使用 TypeScript 编写，支持类型安全，并经过性能优化。

---

## 目录结构

```
components/
├── data-display/      # 数据展示组件
│   ├── SearchFilter   # 搜索过滤器（带防抖）
│   ├── SearchInput    # 搜索输入框
│   ├── OptimizedList  # 优化列表组件
│   ├── VirtualList    # 虚拟列表
│   └── AnimatedList   # 动画列表
├── ui/                # 基础 UI 组件
│   ├── Button         # 按钮
│   ├── Input          # 输入框
│   ├── Select         # 选择器
│   ├── Modal          # 弹窗
│   └── Card           # 卡片
├── feedback/          # 反馈组件
│   ├── Toast          # 提示框
│   ├── LoadingSpinner # 加载动画
│   └── EmptyState     # 空状态
└── special/           # 特殊组件
    ├── ImportExportPanel # 导入导出面板
    └── ErrorBoundary     # 错误边界
```

---

## 数据展示组件

### SearchFilter

带防抖功能的搜索过滤器组件，支持自定义过滤选项。

```tsx
import { SearchFilter } from '../components';

<SearchFilter
  searchTerm={searchInput}
  onSearchChange={setSearchInput}
  placeholder="搜索..."
  debounceMs={300}
  filters={[
    { label: '全部', value: '' },
    { label: '启用', value: 'active' },
    { label: '禁用', value: 'inactive' },
  ]}
  activeFilter={selectedFilter}
  onFilterChange={setSelectedFilter}
/>
```

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| searchTerm | string | - | 当前搜索词 |
| onSearchChange | (value: string) => void | - | 搜索词变化回调 |
| placeholder | string | '搜索...' | 占位符文本 |
| debounceMs | number | 300 | 防抖延迟(ms) |
| filters | FilterOption[] | [] | 过滤选项列表 |
| activeFilter | string | - | 当前激活的过滤器 |
| onFilterChange | (value: string) => void | - | 过滤器变化回调 |
| loading | boolean | false | 加载状态 |
| autoSearch | boolean | true | 是否自动搜索 |

---

### SearchInput

轻量级搜索输入组件，内置防抖功能。

```tsx
import { SearchInput } from '../components';

<SearchInput
  onChange={handleSearch}
  placeholder="搜索用户..."
  debounceDelay={300}
/>
```

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| onChange | (value: string) => void | - | 搜索词变化回调（已防抖） |
| placeholder | string | '搜索...' | 占位符文本 |
| value | string | - | 受控值 |
| className | string | '' | 自定义样式类 |
| debounceDelay | number | 300 | 防抖延迟(ms) |

---

### OptimizedList

优化的列表组件，支持分页、骨架屏、多选等功能。

```tsx
import { OptimizedList } from '../components';

const columns = [
  { key: 'name', label: '名称', width: '200px' },
  { key: 'status', label: '状态', render: (val) => (
    <span className={val === 'active' ? 'text-green-600' : 'text-gray-400'}>
      {val === 'active' ? '启用' : '禁用'}
    </span>
  )},
  { key: 'created_at', label: '创建时间' },
];

<OptimizedList
  data={items}
  columns={columns}
  loading={loading}
  total={total}
  page={page}
  pageSize={10}
  onPageChange={setPage}
  onEdit={handleEdit}
  onDelete={handleDelete}
  rowKey={(item) => item.id}
  checkboxColumn={true}
  selectedItems={selectedItems}
  onSelect={handleSelect}
/>
```

**Props**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| data | T[] | - | 列表数据 |
| columns | ColumnDef[] | - | 列定义 |
| loading | boolean | false | 加载状态 |
| total | number | 0 | 总条数 |
| page | number | 1 | 当前页码 |
| pageSize | number | 10 | 每页条数 |
| onPageChange | (page: number) => void | - | 分页回调 |
| onEdit | (item: T) => void | - | 编辑回调 |
| onDelete | (item: T) => void | - | 删除回调 |
| onRowClick | (item: T) => void | - | 行点击回调 |
| rowKey | (item: T) => string \| number | item.id | 行唯一标识 |
| checkboxColumn | boolean | false | 是否显示复选框列 |
| selectedItems | T[] | [] | 已选中项 |
| onSelect | (item: T) => void | - | 选中回调 |
| emptyMessage | string | '暂无数据' | 空状态提示 |
| skeletonCount | number | 5 | 骨架屏数量 |

**ColumnDef**:

| 属性 | 类型 | 说明 |
|------|------|------|
| key | keyof T | 字段名 |
| label | string | 显示标签 |
| render | (value, row) => ReactNode | 自定义渲染函数 |
| className | string | 列样式类 |
| sortable | boolean | 是否可排序 |
| width | string | 列宽度 |

---

## 自定义 Hook

### useForm

通用表单处理 Hook，支持表单状态管理、验证和提交。

```tsx
import { useForm } from '../hooks';

interface LoginForm {
  username: string;
  password: string;
  remember: boolean;
}

const validationRules = {
  username: { required: true, minLength: 3 },
  password: { required: true, minLength: 6 },
};

const { formData, errors, handleChange, handleSubmit, resetForm } = useForm<LoginForm>(
  { username: '', password: '', remember: false },
  validationRules
);

const handleLogin = async (data: LoginForm) => {
  await api.login(data);
};

<form onSubmit={handleSubmit(handleLogin)}>
  <input
    name="username"
    value={formData.username}
    onChange={(e) => handleChange('username', e.target.value)}
  />
  {errors.username && <span className="error">{errors.username}</span>}
  
  <input
    name="password"
    type="password"
    value={formData.password}
    onChange={(e) => handleChange('password', e.target.value)}
  />
  
  <button type="submit">登录</button>
</form>
```

**返回值**:

| 属性 | 类型 | 说明 |
|------|------|------|
| formData | T | 表单数据 |
| errors | FormErrors<T> | 错误信息 |
| isSubmitting | boolean | 提交状态 |
| touched | Set<keyof T> | 已触碰字段 |
| handleChange | (field, value) => void | 字段值变更 |
| handleChangeEvent | (field) => (e) => void | 事件处理版 |
| handleSubmit | (onSubmit) => (e) => void | 表单提交 |
| setFormData | (data) => void | 批量设置表单 |
| resetForm | () => void | 重置表单 |
| validateField | (field) => void | 验证单个字段 |
| validateAll | () => boolean | 验证所有字段 |

**ValidationRule**:

| 属性 | 类型 | 说明 |
|------|------|------|
| required | boolean | 是否必填 |
| minLength | number | 最小长度 |
| maxLength | number | 最大长度 |
| pattern | RegExp | 正则验证 |
| min | number | 最小值 |
| max | number | 最大值 |
| validate | (value) => string \| undefined | 自定义验证 |

---

### useModal

通用弹窗管理 Hook，简化弹窗状态管理。

```tsx
import { useModal } from '../hooks';
import { Modal } from '../components';

const { isOpen, data, open, close } = useModal<User>();

<Button onClick={() => open(user)}>编辑用户</Button>

<Modal isOpen={isOpen} onClose={close} title="编辑用户">
  {data && <UserForm user={data} />}
</Modal>
```

**返回值**:

| 属性 | 类型 | 说明 |
|------|------|------|
| isOpen | boolean | 弹窗是否打开 |
| data | T | 弹窗数据 |
| open | (data?) => void | 打开弹窗 |
| close | () => void | 关闭弹窗 |
| toggle | () => void | 切换弹窗 |
| updateData | (data) => void | 更新弹窗数据 |

---

### useConfirmDialog

确认对话框 Hook，支持 Promise 方式调用。

```tsx
import { useConfirmDialog } from '../hooks';
import { ConfirmDialog } from '../components';

const { show, isOpen, options, confirm, cancel } = useConfirmDialog();

const handleDelete = async (id: number) => {
  const confirmed = await show({
    title: '确认删除',
    message: '删除后无法恢复，确定要继续吗？',
    type: 'danger',
    confirmText: '确认删除',
    cancelText: '取消',
  });
  
  if (confirmed) {
    await api.delete(id);
  }
};

<ConfirmDialog
  isOpen={isOpen}
  {...options}
  onConfirm={confirm}
  onCancel={cancel}
/>
```

**返回值**:

| 属性 | 类型 | 说明 |
|------|------|------|
| show | (options) => Promise<boolean> | 显示对话框 |
| isOpen | boolean | 是否打开 |
| options | ConfirmDialogOptions | 对话框选项 |
| confirm | () => void | 确认回调 |
| cancel | () => void | 取消回调 |

**ConfirmDialogOptions**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| title | string | - | 标题 |
| message | string | - | 提示消息 |
| confirmText | string | '确定' | 确认按钮文字 |
| cancelText | string | '取消' | 取消按钮文字 |
| type | 'danger' \| 'warning' \| 'info' \| 'success' | 'info' | 类型 |

---

### useOptimizedFetch

优化的数据获取 Hook，支持防抖、请求取消和缓存。

```tsx
import { useOptimizedFetch } from '../hooks';

const { data, loading, error, refetch } = useOptimizedFetch(
  () => api.users.getAll({ search: searchTerm }),
  [searchTerm],
  {
    debounceDelay: 300,
    onSuccess: (data) => console.log('Loaded:', data),
    onError: (err) => console.error('Error:', err),
  }
);

if (loading) return <LoadingSpinner />;
if (error) return <ErrorBoundary error={error} />;

return <UserList data={data} />;
```

**参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| fetcher | () => Promise<T> | 数据获取函数 |
| dependencies | unknown[] | 依赖数组 |
| options | UseOptimizedFetchOptions | 可选配置 |

**Options**:

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| debounceDelay | number | 300 | 防抖延迟(ms) |
| initialData | T | null | 初始数据 |
| onSuccess | (data) => void | - | 成功回调 |
| onError | (error) => void | - | 错误回调 |

**返回值**:

| 属性 | 类型 | 说明 |
|------|------|------|
| data | T \| null | 获取的数据 |
| loading | boolean | 加载状态 |
| error | Error \| null | 错误信息 |
| refetch | () => Promise<void> | 重新获取 |
| reset | () => void | 重置数据 |

---

## 使用规范

### 性能优化建议

1. **组件记忆化**: 对接收对象/数组 props 的组件使用 `memo`
2. **回调函数**: 使用 `useCallback` 包装传递给子组件的回调
3. **计算属性**: 使用 `useMemo` 缓存复杂计算结果
4. **列表渲染**: 使用 `OptimizedList` 或 `VirtualList` 处理大数据量

### 命名规范

- 组件名: PascalCase（如 `SearchFilter`）
- Hook 名: use + PascalCase（如 `useForm`）
- 文件命名: 与组件/Hook 同名
- 导出: 默认导出组件，命名导出类型和工具函数

### 代码风格

- 使用 TypeScript 严格模式
- 为所有组件和 Hook 添加类型定义
- 使用 JSDoc 注释说明功能和参数
- 保持代码简洁，避免过度抽象

---

## 更新日志

### v1.0.0
- 初始版本发布
- 包含 SearchFilter、SearchInput、OptimizedList 组件
- 包含 useForm、useModal、useConfirmDialog、useOptimizedFetch Hook

---

## 贡献指南

1. 在 `components/` 或 `hooks/` 目录下创建新文件
2. 添加对应的导出到 `index.ts`
3. 在 README.md 中添加文档
4. 确保通过 TypeScript 类型检查和构建测试