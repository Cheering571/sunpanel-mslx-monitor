# 微应用模板更新工具

用于将 `microapp-hello-world` 模板的构建代码同步到衍生项目。

## 使用方式

### 在衍生项目根目录执行

```bash
node scripts/update-template.mjs              # 交互模式：展示 diff，确认后更新
node scripts/update-template.mjs --force      # 强制模式：直接覆盖
node scripts/update-template.mjs --dry-run    # 干运行：仅生成变更报告，不执行修改
node scripts/update-template.mjs --help       # 显示帮助信息
```

### 直接调用脚本（高级）

```bash
node scripts/update-template.mjs [目标目录] [选项]
```

## 参数说明

| 参数 | 说明 |
|------|------|
| `-h`, `--help` | 显示帮助信息 |
| `-f`, `--force` | 强制覆盖，跳过 diff 展示和确认提示 |
| `--local` | 使用本地模板目录（不从 GitHub 拉取） |
| `--dry-run` | 干运行模式：仅生成变更报告，不执行任何修改 |
| `--no-stash` | 更新前不自动 git stash（默认会自动 stash 安全备份） |
| 目标目录 | 要更新的衍生项目目录（默认：当前目录） |

## 同步的文件

支持通配符模式（`**` 递归匹配），自动同步目录内新增文件：

- `vite.config.js` - Vite 构建配置
- `build/**` - 构建相关脚本（通配符，自动同步新增文件）
- `eslint.config.js` - ESLint 配置
- `package.json` - 智能合并（保留项目特有配置）
- `jsconfig.json` - JavaScript 配置
- `scripts/**` - 更新脚本和配置（通配符，自动同步新增文件）
- `src/main.js` - 微应用入口文件（模板有更新时覆盖）
- `src/vite-env.d.ts` - Vite 类型声明（模板有更新时覆盖）
- `src/builtins/**` - 内置文件（通配符，模板有更新时覆盖）
- `src/utils/assetPath.js` - 资产路径工具函数（模板有更新时覆盖）

## 不会更新的文件

- `src/!(main.js|vite-env.d.ts|builtins/**|utils/assetPath.js)` - 业务代码
- `config/**` - 项目配置
- `app.json` - 小程序配置
- `public/**` - 静态资源
- `locales/**` - 多语言文件
- `dist/**` - 构建产物

## 工作流程

1. **获取模板源码**
   - GitHub 模式：从远程仓库拉取最新代码（clone depth 50）
   - 本地模式：直接使用本地模板目录
   - 自动读取并对比远程/本地模板版本号
   - 自动对比 Git commit SHA，精确判断是否有新提交

2. **对比文件差异**
   - 通配符模式自动展开，匹配目录内所有文件
   - 单独定义的条目优先于通配符匹配（去重机制）
   - 计算每个文件的 diff
   - 非强制模式下展示变更预览

3. **自动备份**
   - 更新前自动执行 `git stash` 保护未提交的更改
   - 支持 `--no-stash` 跳过备份
   - 非 git 仓库自动跳过

4. **冲突处理**
   - 交互模式下：检测到本地修改时，提供三选一：
     - `覆盖` — 用模板版本替换本地修改
     - `保留` — 跳过此文件，保留本地修改
     - `跳过全部` — 取消所有后续冲突文件的更新
   - 强制模式下：仅警告，直接覆盖

5. **执行更新**
   - 普通文件：直接覆盖
   - `package.json`：智能合并（保留项目特有字段）
   - `overwriteIfUnchanged` 文件：仅模板有更新时覆盖

6. **写入同步信息**
   - 更新成功后，自动写入 `.template-sync-info.json`
   - 记录 commit SHA、同步时间、版本号

7. **生成报告**
   - 输出成功/跳过/保留/失败文件统计

8. **清理临时文件**
   - GitHub 模式下自动清理临时克隆的仓库

## 版本管理

### 语义化版本号

`template-files.json` 中包含 `version` 字段（语义化版本号），脚本启动时会自动对比：

```
ℹ️  当前模板版本: 1.1.0
ℹ️  远程模板版本: 1.2.0
⚠️  版本差异: 1.1.0 → 1.2.0
```

### Git Commit SHA 精确追踪

每次同步成功后，脚本会在项目根目录写入 `.template-sync-info.json`：

```json
{
  "commitSha": "eaf4b2f...",
  "commitShortSha": "eaf4b2f",
  "commitDate": "2026-07-26 22:19:40 +0800",
  "syncedAt": "2026-07-27T10:00:00.000Z",
  "version": "1.1.0",
  "remoteVersion": "1.2.0"
}
```

下次更新时，脚本会对比远程仓库的最新 commit 与记录的 commit SHA，精确判断是否有新提交：

```
ℹ️  上次同步: 2026-07-27T10:00:00.000Z (commit: eaf4b2f)
⚠️  模板有新提交: eaf4b2f → 7c3d4e5
```

### 干运行报告

使用 `--dry-run` 预览变更而不执行：

```
🔧 干运行报告
  ℹ️  总计 5 个文件需要处理：

  📥 新增文件 (1):
  🔍 build/new-file.js

  📝 需要更新 (2):
  🔍 build/generators/app-json.js (3 处变更)
  🔍 src/main.js (1 处变更)

  🔀 需要合并 (1):
  🔍 package.json (保留项目特有配置)

  ⚠️  其中 2 个文件有本地修改，更新时需要处理冲突

📋 干运行完成，未修改任何文件
```

## 首次使用

从模板创建衍生项目后，脚本会自动同步到衍生项目。如果脚本不存在，需要手动添加：

```bash
# 在衍生项目中添加更新脚本
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.scripts = pkg.scripts || {};
Object.assign(pkg.scripts, {
  'update': 'node scripts/update-template.mjs',
  'update:force': 'node scripts/update-template.mjs --force',
  'update:dry-run': 'node scripts/update-template.mjs --dry-run',
  'update:help': 'node scripts/update-template.mjs --help'
});
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
```

## 注意事项

1. **网络要求**: GitHub 模式需要网络连接
2. **Git 依赖**: GitHub 模式需要安装 git
3. **权限问题**: 确保有写入权限
4. **自动备份**: 默认会自动 git stash，可通过 `--no-stash` 跳过
5. **npm 参数传递**: 使用 `node scripts/update-template.mjs --help` 查看帮助，或 `node scripts/update-template.mjs -h`
6. **同步信息**: `.template-sync-info.json` 会自动创建和更新，建议加入 `.gitignore`

## 故障排除

### 问题：使用 -h 参数显示 npm 帮助

**原因**: npm 默认会拦截 `-h` 参数

**解决**: 直接使用 `node scripts/update-template.mjs --help`

### 问题：克隆仓库失败

**可能原因**:
- 网络连接问题（请检查网络代理设置）
- 仓库不存在或分支名错误
- GitHub 访问受限

**解决**:
- 检查网络连接
- 确认仓库地址正确
- 安装 Git: `brew install git` (macOS) 或 `apt install git` (Linux)
- 使用 `--local` 模式跳过网络拉取

### 问题：文件冲突

**说明**: 脚本在交互模式下会检测本地修改的文件，提供三选一：
- 覆盖：用模板版本替换本地修改
- 保留：跳过此文件，保留本地修改
- 跳过全部：取消所有后续冲突文件的更新

更新前的更改已通过 git stash 备份，可通过 `git stash pop` 恢复。

### 问题：权限不足

**解决**:
- 确保对目标目录有写入权限
- 使用管理员权限运行（不推荐）

## 示例

### 更新当前项目

```bash
cd my-microapp
node scripts/update-template.mjs
```

### 预览变更（不执行）

```bash
node scripts/update-template.mjs --dry-run
```

### 强制更新（跳过确认）

```bash
cd my-microapp
node scripts/update-template.mjs --force
```

### 更新指定目录

```bash
cd template-project
node scripts/update-template.mjs ../derived-project --force
```

### 强制更新（跳过确认）

```bash
node scripts/update-template.mjs --force
```

### 查看帮助

```bash
node scripts/update-template.mjs --help
```
