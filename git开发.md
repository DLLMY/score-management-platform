好的，我将为你提供 **“服务器主动拉取”模式** 的完整操作方案。这种模式下，**服务器不需要有公网 IP，也无需开放任何入站端口**，只需要服务器能正常访问互联网（git clone、npm install 等）。部署会通过服务器上的定时任务自动完成。

***

## 整体思路

1. 在服务器上编写一个脚本，它会：
   - 检查远程 Git 仓库是否有新提交（比较 commit hash）。
   - 如果有新代码，执行 `git pull`、安装依赖、构建前端、重启后端服务。
2. 通过 `cron` 设置定时任务（例如每 5 分钟运行一次脚本）。
3. 本地开发完成后，只需 `git push`，服务器会在下一个定时周期自动部署。

***

## 步骤一：确保服务器上已有项目代码（首次部署）

你需要先在服务器上把仓库克隆下来。如果你之前已经手动部署过，这一步可以跳过。

```bash
# SSH 登录服务器（通过任何可用方式，如堡垒机、VPN、跳板机等）
ssh user@<服务器可达地址>

# 进入你想放置项目的目录，例如 /var/www 或 /home/user
cd /home/user

# 克隆你的仓库（使用 HTTPS 或 SSH 方式，推荐 SSH 避免每次输入密码）
git clone https://github.com/yourname/yourrepo.git project
# 或者使用 SSH 协议（需提前配置好服务器的 SSH 密钥）
git clone git@github.com:yourname/yourrepo.git project

cd project
```

> 如果仓库是私有的且使用 HTTPS，建议配置 Git 凭据缓存或使用 SSH 密钥，否则 `git pull` 会要求输入密码，导致自动化失败。\
> 最简单的方法：在服务器上生成 SSH 密钥（`ssh-keygen -t rsa -b 4096`），将公钥添加到 GitHub 账户的 SSH keys 中，然后使用 SSH 地址克隆。

***

## 步骤二：编写自动部署脚本

在项目根目录下创建一个脚本文件，例如 `auto_deploy.sh`。

```bash
cd /home/user/project
touch auto_deploy.sh
chmod +x auto_deploy.sh
```

使用 `vim` 或 `nano` 编辑脚本，内容如下（请根据你的技术栈调整）：

```bash
#!/bin/bash

# 自动部署脚本 - 适用于前后端一体化项目
# 使用方法：放在项目根目录，通过 cron 定时执行

# ---------- 配置区域 ----------
PROJECT_PATH="/home/user/project"   # 项目绝对路径
BRANCH="main"                       # 要跟踪的分支
LOG_FILE="/home/user/deploy.log"    # 日志文件路径
# 如果你的后端需要单独重启，可以指定进程名或 PM2 应用名
PM2_APP_NAME="my-backend"           # PM2 应用名称（如果使用 PM2）
# 前端构建产物复制目标（如果需要交给 Nginx 托管）
FRONTEND_DIST="/home/user/project/frontend/dist"
NGINX_SERVE_DIR="/var/www/html"
# ---------- 配置结束 ----------

cd $PROJECT_PATH || exit 1

# 获取当前远程仓库的 commit hash（不拉取代码）
remote_hash=$(git ls-remote origin $BRANCH | cut -f1)
# 获取本地当前 commit hash
local_hash=$(git rev-parse HEAD)

echo "$(date): 远程 commit = $remote_hash"
echo "$(date): 本地 commit = $local_hash"

# 如果 hash 相同，说明没有新代码，直接退出
if [ "$remote_hash" = "$local_hash" ]; then
    echo "$(date): 没有检测到新代码，退出。"
    exit 0
fi

echo "$(date): 发现新代码，开始部署..."

# 拉取最新代码
git pull origin $BRANCH

# 如果项目有子模块，可以取消注释下一行
# git submodule update --init --recursive

# ---------- 后端依赖安装（如果有） ----------
# 假设后端代码在 backend 目录，且使用 npm
if [ -f "$PROJECT_PATH/backend/package.json" ]; then
    echo "$(date): 安装后端依赖..."
    cd $PROJECT_PATH/backend
    npm install --production   # 生产环境可以不安装 devDependencies
fi

# ---------- 前端构建（如果有） ----------
# 假设前端代码在 frontend 目录，且使用 npm + webpack/vite
if [ -f "$PROJECT_PATH/frontend/package.json" ]; then
    echo "$(date): 安装前端依赖并构建..."
    cd $PROJECT_PATH/frontend
    npm install
    npm run build   # 这个命令应在 package.json 中定义，例如 "build": "vite build"
fi

# ---------- 将前端构建产物复制到 Nginx 托管目录（如果需要） ----------
# 如果你的后端直接服务静态文件，可以跳过这一步
if [ -d "$FRONTEND_DIST" ] && [ -d "$NGINX_SERVE_DIR" ]; then
    echo "$(date): 复制前端构建产物到 Nginx 目录..."
    rm -rf $NGINX_SERVE_DIR/*
    cp -r $FRONTEND_DIST/* $NGINX_SERVE_DIR/
fi

# ---------- 重启后端服务 ----------
# 方法1：使用 PM2（推荐）
if command -v pm2 &> /dev/null; then
    echo "$(date): 通过 PM2 重启后端应用 $PM2_APP_NAME ..."
    pm2 restart $PM2_APP_NAME
    pm2 save
fi

# 方法2：如果你使用 systemd 管理服务，可以运行：
# systemctl restart your-backend.service

# 方法3：如果是简单的 Node.js 脚本，你可以用 kill + 重新启动，但不推荐

echo "$(date): 部署完成！"
```

**根据你的具体技术栈修改以下部分：**

- 如果你的前后端在同一个目录（例如后端是 `server.js`，前端在 `public` 目录），简化脚本。
- 如果前端构建产物直接由后端托管（如 Express 静态目录），则无需复制到 Nginx。
- 如果不使用 PM2，而是用 `systemctl`，把重启命令改成 `sudo systemctl restart your-service`（需要配置 sudo 免密或赋予权限）。

***

## 步骤三：测试脚本（手动执行一次）

```bash
cd /home/user/project
./auto_deploy.sh
```

观察输出和日志文件 `/home/user/deploy.log`，确保没有报错。如果出现问题，根据错误信息调整脚本。

***

## 步骤四：设置 cron 定时任务

我们希望脚本每隔一定时间自动运行一次（例如每 5 分钟）。使用 `crontab`：

```bash
crontab -e
```

添加以下行（每 5 分钟执行一次）：

```cron
*/5 * * * * /home/user/project/auto_deploy.sh >> /home/user/deploy.log 2>&1
```

如果你希望更频繁，可以改为每分钟：`* * * * * ...`，但注意 GitHub API 的请求限制（对于公共仓库限制较松，私有仓库稍严）。一般每 5 分钟足够。

保存并退出。你可以用 `crontab -l` 查看当前定时任务。

**可选**：也可以将错误输出单独记录，不过 `>> /home/user/deploy.log 2>&1` 已经将标准输出和错误都重定向到了同一个日志文件。

***

## 步骤五：验证自动部署

1. 在本地开发环境中修改代码，`git commit` 并 `git push` 到 `main` 分支。
2. 等待最多 5 分钟（或你设置的间隔）。
3. 查看服务器上的日志：
   ```bash
   tail -f /home/user/deploy.log
   ```
   你应该能看到脚本检测到新的 commit hash 并执行了 `git pull`、构建和重启。
4. 访问你的网站或 API，确认新功能已生效。

***

## 补充说明与最佳实践

### 1. 避免 Git 冲突

由于服务器脚本会自动 `git pull`，请确保你在本地开发时**不要修改服务器上可能被修改的文件**（比如日志文件、上传的图片等）。那些文件应该加入 `.gitignore`。如果服务器上有运行时生成的配置文件，建议把它们放在项目目录之外，或者使用环境变量。

### 2. 处理 npm install 耗时问题

每次部署都运行 `npm install` 可能会比较慢。可以优化为：

- 只在 `package.json` 发生变化时才运行 `npm install`。\
  在脚本中比较 `package.json` 的 hash 或文件修改时间，但这会增加复杂度。对于小型项目，每次都运行是可以接受的。

### 3. 使用锁文件避免并发执行

如果脚本执行时间超过定时间隔（例如部署需要 2 分钟，而 cron 设为每分钟运行），可能会同时运行多个实例。使用 `flock` 或简单的 pid 文件来避免。

**改进版脚本开头添加：**

```bash
LOCKFILE="/tmp/auto_deploy.lock"
# 如果锁文件存在且进程还在运行，则退出
if [ -f "$LOCKFILE" ]; then
    echo "$(date): 已有部署进程在运行，退出。"
    exit 0
fi
touch $LOCKFILE
trap "rm -f $LOCKFILE" EXIT   # 确保脚本结束时删除锁文件
```

### 4. 监控与通知

可以在脚本中加入失败通知（例如通过 curl 调用企业微信/钉钉/webhook 发送消息），这样你就能及时知道部署失败。

### 5. 安全性

- 确保服务器上的 `.git` 目录不会被外部访问（如果是 web 可访问目录，设置好 Nginx 禁止访问 `.git`）。
- 使用 SSH 方式克隆仓库，私钥文件权限设为 `600`。

***

## 常见问题排查

| 问题                                 | 解决方案                                                 |
| :--------------------------------- | :--------------------------------------------------- |
| `git ls-remote` 要求输入用户名密码          | 改用 SSH 克隆仓库，并配置好 SSH 密钥。                             |
| `npm install` 或 `npm run build` 报错 | 手动在服务器上以同一用户身份运行命令，检查 Node.js 版本是否匹配。                |
| 服务没有成功重启                           | 确认 PM2 应用名是否正确：`pm2 list` 查看。如果使用 systemd，检查服务名和权限。  |
| 日志显示“Permission denied”            | 确保脚本有执行权限（`chmod +x`），并且运行 crontab 的用户对项目目录有读写权限。    |
| 前端构建产物未复制                          | 检查 `FRONTEND_DIST` 路径是否正确；如果前端构建输出目录不是 `dist`，请修改脚本。 |

***

## 总结

你现在拥有了一个完整的、由服务器主动拉取的自动部署方案：

- **优点**：不需要服务器有公网 IP，不需要配置内网穿透，不依赖第三方 CI 服务，实现简单。
- **缺点**：部署有延迟（你设定的 cron 间隔），不适合需要秒级发布的项目。

对于绝大多数个人项目、小团队内部系统，这个方案完全够用且极其稳定。如果你之后希望实现“push 后立即部署”，可以平滑迁移到 GitHub Actions + 自托管 Runner（前文提到的方案 C），但主动拉取模式已经可以解决你的跨网络部署需求。

如果你在配置中遇到具体问题，欢迎提供你的技术栈（前端/后端框架、进程管理方式），我可以帮你定制脚本。
