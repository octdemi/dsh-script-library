# dsh-script-library

> 一个为 DeepSeek Harness 打造的**脚本库**插件：自动收集 PTC/`run_code` 产出的脚本到暂存区，让你在侧边栏一键查看、确认入库或删除。

![dsh](https://img.shields.io/badge/DeepSeek%20Harness-0.1.0--rc.6-blue)
![license](https://img.shields.io/badge/license-MIT-green)

## ✨ 功能

- **🟢🟡🔴 三分法脚本库** —— 每一条脚本按「通用 / 半通用 / 项目特有」分类入库，沉淀可复用的 PTC 脚本资产
- **🤖 自动检测暂存** —— 节点端观察者自动配对 `tool/call` + `tool/result` 事件，把 `run_code` 脚本产出写入 `INDEX.staging.md` 暂存区
- **📚 侧边栏徽标** —— 浏览器端 UI 在侧边栏底部显示「脚本库」入口 + 待确认数量红色徽标（30 秒自动刷新）
- **🗂 管理面板** —— 点击入口弹出面板，逐条查看待确认条目，支持「确认入库」晋升正式索引、或「删除」丢弃
- **📏 写前必查规则** —— 通过 `systemPrompt.section` 注入使用纪律，引导每次写脚本前先查索引、写后按类型入库

## 📦 安装

### 前置条件

- DeepSeek Harness `0.1.0-rc.6`（或兼容版本）
- 工作目录：`~/.dsh/profiles/web/`（web profile）

### 步骤

```bash
# 1. 安装插件包到 profile 的 node_modules
mkdir -p ~/.dsh/profiles/node_modules/dsh-script-library
cp -r lib package.json ~/.dsh/profiles/node_modules/dsh-script-library/

# 2. 注册插件到 profile 的 patch 层
cat >> ~/.dsh/profiles/web/cordis.patch.yml <<'EOF'
- insert:
    - id: script-library
      name: 'dsh-script-library'
      config: {}
EOF

# 3. 重启 Web GUI（让 dsh-client-modules 重建 client 加载图）
#    重新打开 http://127.0.0.1:3080 即可看到侧边栏「脚本库」入口
```

> 注意：注册后需要**重启 DSH Web 服务**才能生效 —— client bundle 的哈希在服务启动时构建。

### 脚本库目录（首次运行自动创建）

`~/.dsh/script-library/`

```
INDEX.md          # 正式索引（三分法：🟢通用 / 🟡半通用 / 🔴项目特有）
INDEX.staging.md  # 暂存索引（插件自动追加，等待人工确认）
CONTRIBUTING.md   # 入库规则与清扫流程
entries/          # 每条脚本的 README 存放目录
```

## 🚀 使用

1. 正常使用 DSH 的 PTC 模式（agent-presets.default 为 code）；运行 `run_code` 工具后，产出会自动进入暂存区
2. 侧边栏底部出现「📚 脚本库」按钮，红点数字 = 待确认条数
3. 点开面板 → 每条候选显示「类型建议 / 名称 / 一句话说明 / 来源会话」
4. 决定：**确认入库**（晋升 `INDEX.md`，按三分法标注）或 **删除**（丢弃）
5. 建议每周做一次暂存区清扫（见 `CONTRIBUTING.md`）

## 🧩 架构

```
┌─ 浏览器端（client bundle）─────────────────────────────┐
│  sidebar.footer.action 入口 + 徽标                       │
│  DOM 管理面板（纯 DOM，不依赖 slots 重渲染）              │
│        │ 直接 RPC（fetch /api/scriptLibrary/*）          │
└────────┼────────────────────────────────────────────────┘
         ▼
┌─ 节点端（cordis 服务）──────────────────────────────────┐
│  TypertRemoteService：listStaged / countStaged          │
│                       approveEntry / deleteEntry        │
│  会话观察者：tool/call+tool/result 配对 → 自动暂存       │
│  systemPrompt.section：写前必查纪律                      │
└────────┼────────────────────────────────────────────────┘
         ▼
      INDEX.staging.md / INDEX.md（~/.dsh/script-library/）
```

### 关键技术说明

- **Remote 网关**：服务继承 `TypertRemoteService`，方法用 `@Remote` 装饰器标记；descriptor 手写（`typert.host.js` / `typert.remote-client.js`），与 generator 输出同构
- **为什么 client 用直接 RPC 而不是 `ctx.remote`**：命名空间在 `apply()` 内通过 `$mount` 自挂载，无法在 `inject` 中声明（会造成 cordis fiber 死锁），不声明又会被注入守卫拦截 —— 因此采用与 connection carrier 相同的 wire 格式直接 fetch
- **为什么面板用纯 DOM**：`shell.overlay` 列表槽的渲染由 slots 版本驱动，普通 state 变化不会触发重渲染；纯 DOM 面板（`renderPanelDom`）完全可控
- **实现语言**：纯手写 ESM JS，无构建步骤（tsdown 下游不可用时的务实选择），`lib/` 与 `src/` 内容一致

## 🛠 开发

```bash
# 目录
src/host/index.js            # 节点端插件（服务+观察者+提示词规则）
src/host/typert.host.js      # TYPERT host descriptor
src/client/client.js         # 浏览器端 bundle（lazy-CJS 形态）
src/client/typert.remote.js  # TYPERT remote-client descriptor（参考）

# 修改后同步三处（开发树 lib / 安装目录）
cp src/host/index.js lib/index.js
cp src/host/typert.host.js lib/typert.host.js
cp src/client/client.js lib/client.js
cp src/client/typert.remote.js lib/typert.remote-client.js
cp lib/*.js ~/.dsh/profiles/node_modules/dsh-script-library/lib/
```

服务端插件逻辑变更后需重启 DSH；client bundle 变更会被 `dsh-client-modules` 哈希识别（rev 变化），刷新页面即可生效。

## 📄 License

[MIT](./LICENSE)