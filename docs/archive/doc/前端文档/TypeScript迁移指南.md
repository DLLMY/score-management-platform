# 前端TypeScript迁移指南

## 迁移步骤

### 1. 文件重命名
将 `.js` 文件改为 `.tsx` 文件（React组件）或 `.ts` 文件（普通JavaScript）

### 2. 添加类型定义
为组件Props、State、函数参数等添加类型注解

### 3. 导入类型
从 `@types` 包或自定义类型文件导入所需类型

## 迁移示例

### Sidebar组件迁移示例

#### 原始JavaScript代码（Sidebar.js）
```javascript
const MenuItem = memo(({ item, isActive, depth = 0, isCollapsed = false }) => {
  const Icon = item.icon;
  // ...
});
```

#### TypeScript版本（Sidebar.tsx）
```typescript
import { MenuItem as MenuItemType } from '@/types';

interface MenuItemProps {
  item: MenuItemType;
  isActive: boolean;
  depth?: number;
  isCollapsed?: boolean;
}

const MenuItem = memo<MenuItemProps>(({ item, isActive, depth = 0, isCollapsed = false }) => {
  const Icon = item.icon;
  // ...
});
```

### 组件Props类型定义

#### MenuItem组件
```typescript
interface MenuItemData {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuItemProps {
  item: MenuItemData;
  isActive: boolean;
  depth?: number;
  isCollapsed?: boolean;
}
```

#### GroupHeader组件
```typescript
interface MenuGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItemData[];
  requiresAdmin?: boolean;
}

interface GroupHeaderProps {
  group: MenuGroup;
  hasActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isCollapsed: boolean;
}
```

#### Sidebar组件
```typescript
interface SidebarProps {
  // 可选的props
}

interface SidebarState {
  expandedGroups: Record<string, boolean>;
  isCollapsed: boolean;
  hoveredItem: string | null;
}
```

### 使用useState的类型注解

```typescript
const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
  main: true,
  scoreRules: false,
  systemMonitor: false,
  notifications: false,
  systemAdmin: false,
});

const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

const [hoveredItem, setHoveredItem] = useState<string | null>(null);
```

### 使用useMemo的类型注解

```typescript
const role = useMemo<string | null>(() => getCurrentRole(), []);
const isAdmin = useMemo<boolean>(() => role === 'admin', [role]);

const menuGroups = useMemo<MenuGroup[]>(() => [
  // ...
], []);
```

### 使用useCallback的类型注解

```typescript
const toggleGroup = useCallback((groupName: string) => {
  setExpandedGroups((prev: Record<string, boolean>) => ({
    ...prev,
    [groupName]: !prev[groupName],
  }));
}, []);

const isItemActive = useCallback((path: string): boolean => {
  return location.pathname === path || (path === '/dashboard' && location.pathname === '/');
}, [location.pathname]);
```

## 迁移优先级

### 高优先级（核心组件）
1. **Sidebar.tsx** - 侧边栏导航组件
2. **Header.tsx** - 页面头部组件
3. **Modal.tsx** - 模态框组件
4. **Button.tsx** - 按钮组件
5. **Input.tsx** - 输入框组件

### 中优先级（业务组件）
1. **UserList.tsx** - 用户列表组件
2. **ScoreRecordList.tsx** - 积分记录列表组件
3. **DeviceList.tsx** - 设备列表组件
4. **ApprovalList.tsx** - 审批列表组件

### 低优先级（辅助组件）
1. **LoadingSpinner.tsx** - 加载动画组件
2. **EmptyState.tsx** - 空状态组件
3. **Badge.tsx** - 标签组件
4. **Skeleton.tsx** - 骨架屏组件

## 类型定义文件结构

```
src/types/
├── index.ts          # 核心类型定义（User, Device, Score等）
├── api.ts            # API请求/响应类型
├── store.ts          # Zustand Store类型
├── components.ts     # 组件Props类型
└── utils.ts          # 工具函数类型
```

## 常见类型定义

### React组件类型
```typescript
type ReactComponent<P = {}> = React.FunctionComponent<P> | React.ClassComponent<P>;

type IconComponent = React.ComponentType<{ className?: string }>;
```

### API响应类型
```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
```

### Zustand Store类型
```typescript
interface StoreState {
  // 状态字段
}

interface StoreActions {
  // 操作方法
}

type Store = StoreState & StoreActions;
```

## 迁移注意事项

1. **逐步迁移**：不要一次性迁移所有文件，先迁移核心组件
2. **类型复用**：在 `src/types` 中定义通用类型，避免重复定义
3. **严格模式**：启用TypeScript严格模式，提高类型安全性
4. **类型推断**：合理使用TypeScript类型推断，减少冗余类型注解
5. **第三方库**：安装 `@types/xxx` 包为第三方库添加类型定义

## 迁移工具

### 自动迁移工具
- **TypeScript Migration Tool** - 自动将JavaScript转换为TypeScript
- **VS Code TypeScript扩展** - 提供类型检查和自动补全

### 手动迁移步骤
1. 重命名文件（`.js` → `.tsx`）
2. 添加类型导入
3. 定义Props类型
4. 添加类型注解
5. 修复类型错误
6. 运行类型检查

## 类型检查命令

```bash
# 运行类型检查
npm run type-check

# 实时类型检查
npm run type-check:watch
```

## 迁移进度跟踪

```markdown
# TypeScript迁移进度

## 已完成
### 类型定义
- [x] types/index.ts
- [x] types/api.ts
- [x] types/store.ts
- [x] types/components.ts (组件Props类型定义)

### Store状态管理
- [x] stores/index.ts (Zustand stores)

### Services服务
- [x] services/api.ts

### Context API
- [x] context/ToastContext.tsx

### UI组件
- [x] components/Button.tsx
- [x] components/Input.tsx
- [x] components/Modal.tsx
- [x] components/Select.tsx
- [x] components/Switch.tsx
- [x] components/Textarea.tsx
- [x] components/Header.tsx (已重构，移除ThemeContext依赖)
- [x] components/Sidebar.tsx
- [x] components/VirtualList.tsx (泛型组件)
- [x] components/Card.tsx
- [x] components/LoadingSpinner.tsx
- [x] components/EmptyState.tsx
- [x] components/Badge.tsx
- [x] components/Skeleton.tsx
- [x] components/SearchFilter.tsx
- [x] components/PWAUpdateToast.tsx
- [x] components/AnimatedList.tsx (泛型组件)
- [x] components/AnimatedScore.tsx
- [x] components/Toast.tsx
- [x] components/ToastContainer.tsx
- [x] components/withToast.tsx (高阶组件)
- [x] components/ImportExportPanel.tsx
- [x] components/index.ts (组件导出文件)

### 自定义Hooks
- [x] hooks/usePWA.ts
- [x] hooks/useWebSocket.ts
- [x] hooks/useDeviceDetection.ts
- [x] hooks/usePerformance.ts
- [x] hooks/useKeyboardShortcut.ts

### 页面组件
- [x] pages/Login.tsx
- [x] pages/Profile.tsx
- [x] pages/HelpCenter.tsx
- [x] pages/Settings.tsx
- [x] pages/Notifications.tsx
- [x] pages/UserList.tsx (用户管理)
- [x] pages/DeviceManagement.tsx (设备管理)
- [x] pages/RuleList.tsx (规则管理)
- [x] pages/Approvals.tsx (审批管理)
- [x] pages/Analysis.tsx (数据分析)

### 工具函数
- [x] utils/validation.ts
- [x] utils/environment.ts
- [x] utils/animations.ts
- [x] utils/mobileUtils.ts
- [x] utils/webVitals.ts

## 最近完成（2026-06-13）
### 组件迁移
- [x] Mobile 组件迁移（MobileHeader.tsx, index.tsx）
- [x] charts 组件迁移（index.tsx）
- [x] 测试文件迁移（validation.test.ts, api.test.ts）

### 页面迁移
- [x] CategoryList.tsx（分类管理页面）
- [x] RankRuleList.tsx（排名规则页面）
- [x] TimeRuleList.tsx（时间规则页面）
- [x] OperationLogs.tsx（操作日志页面）
- [x] UserManagement.tsx（用户管理页面）
- [x] UserDetail.tsx（用户详情页面）
- [x] PermissionManagement.tsx（权限管理页面）
- [x] FirmwareManagement.tsx（固件管理页面）
- [x] MQTTDebug.tsx（MQTT调试工具页面）
- [x] Diagnostics.tsx（系统诊断页面）
- [x] RemoteNotifyTest.tsx（远程通知测试页面）
- [x] ScoreRecords.tsx（成绩档案页面）
- [x] ScoreEntry.tsx（成绩录入页面）
- [x] ScoreAnalysis.tsx（成绩分析页面）
- [x] AlgorithmAnalysis.tsx（算法分析页面）
- [x] ClassAssignment.tsx（班级分配管理页面）
- [x] ExamManagement.tsx（考试管理页面）
- [x] Dashboard.tsx（仪表盘页面）

### 类型修复与完善
- [x] 修复所有 TypeScript 编译错误（零错误！）
- [x] 完善 api.ts 核心接口定义（User, RankRule, Device, Alert, Category, TimeRule, OperationLog 等）
- [x] 导出 RankRule、TimeRule、OperationLog 接口
- [x] 新增 OperationLogListResponse 接口支持分页
- [x] 新增 SubAccount、PermissionLog 接口定义
- [x] 完善 User 接口，添加 father_name、mother_name、guardian_relation 等属性
- [x] 统一组件 Props 类型（Button, SearchFilter, VirtualList, AnimatedScore, ImportExportPanel）
- [x] 修复类型冲突（UserList.tsx, Settings.tsx, Analysis.tsx, PermissionManagement.tsx, UserManagement.tsx）
- [x] 增强 validation.ts 支持对象形式的验证规则配置

### API 方法补充
- [x] 添加 api.subAccounts 模块（getAll, getById, create, update, delete）
- [x] 添加 api.permissionLogs 模块（getAll）
- [x] 完善 api.classes 模块（添加 create, update, delete 方法）
- [x] 更新 api.classes.getAll 返回类型为 ClassInfo[]
- [x] 添加 api.firmware.getVersions、getUpgradeRecords、updateVersion、deleteVersion 方法
- [x] 导出 Firmware、FirmwareRecord、OTAStatus 接口
- [x] 完善 MQTTConfig、MQTTStatus、MQTTLog 接口
- [x] 更新 mqtt API 方法签名支持 box_id、response 参数

### 入口文件迁移
- [x] App.js → App.tsx（路由配置、懒加载组件、ProtectedRoute）
- [x] index.js → index.tsx（应用入口）
- [x] ThemeContext.js → ThemeContext.tsx（主题上下文）
- [x] asyncStore.js → asyncStore.ts（异步状态管理）
- [x] setupTests.js → setupTests.ts（测试配置）
- setupProxy.js 保持为 .js（CRA 要求 CommonJS 格式）

## 待迁移
### 页面组件
- ✅ pages/Dashboard.tsx (大型页面) - 已完成

## 已修复的问题
### API 方法补充
- ✅ `api.classes.getAll()` - 已添加
- ✅ `api.classes.getStudents()` - 已添加
- ✅ `api.classes.create()` - 已添加
- ✅ `api.classes.update()` - 已添加
- ✅ `api.classes.delete()` - 已添加
- ✅ `api.scoreAnalysis.getExamAnalysis()` - 已添加
- ✅ `api.scoreAnalysis.getClassAnalysis()` - 已添加
- ✅ `api.algorithm.getCompositeScores()` - 已添加
- ✅ `api.devices.bindClass()` - 已添加
- ✅ `api.devices.bindAdmin()` - 已添加
- ✅ `api.devices.remoteControl()` - 已添加
- ✅ `api.devices.otaUpgrade()` - 已添加
- ✅ `api.devices.bulkOTAUpgrade()` - 已添加
- ✅ `api.devices.resolveAlert()` - 已添加
- ✅ `api.devices.updateSettings()` - 已添加
- ✅ `api.devices.getStats()` - 已添加
- ✅ `api.devices.getAdvancedStats()` - 已添加
- ✅ `api.devices.getAlerts()` - 已更新支持 resolved 参数
- ✅ `api.subAccounts.getAll()` - 已添加
- ✅ `api.subAccounts.getById()` - 已添加
- ✅ `api.subAccounts.create()` - 已添加
- ✅ `api.subAccounts.update()` - 已添加
- ✅ `api.subAccounts.delete()` - 已添加
- ✅ `api.permissionLogs.getAll()` - 已添加

### 语法错误修复
- ✅ 修复 api.ts 中 `by firmware` 命名错误为 `by_firmware`

### 类型定义完善
- ✅ 完善 User 接口，添加 father_name、mother_name、guardian_relation 等属性
- ✅ 添加 SubAccount 接口定义
- ✅ 添加 PermissionLog 接口定义
- ✅ 导出 OperationLog 接口
- ✅ 修复 PermissionManagement.tsx 类型冲突（使用 api.ts 导出的 Admin、ClassInfo、SubAccount 类型）
- ✅ 修复 UserManagement.tsx 类型冲突（使用 api.ts 导出的 Admin、ClassInfo 类型）

## 待解决的问题
### 页面迁移
- ✅ 所有计划中的页面组件已完成迁移
- setupProxy.js 保持为 .js（CRA 要求 CommonJS 格式）
```

## 参考资源

- [TypeScript官方文档](https://www.typescriptlang.org/docs/)
- [React TypeScript最佳实践](https://react-typescript-cheatsheet.netlify.app/)
- [Zustand TypeScript支持](https://github.com/pmndrs/zustand#typescript-support)