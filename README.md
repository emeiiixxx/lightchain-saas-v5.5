# Lightchain SaaS v5.5 · Flow 画布交互优化

基于 Lightchain SaaS v5.3 的独立交互演示项目，使用 React 19、TypeScript、Vite 7 和 Tailwind CSS 4，沿用 v5.1 Beta 组件库。

当前保留 v5.3 Flow 画布功能，已配置独立仓库、页面版本和发布路径。「添加示意」交互待 Figma 设计确定后实现。

## 版本基础

- 来源：[v5.3 仓库](https://github.com/emeiiixxx/lightchain-saas-v5.3)，基线提交 `b633be4`。
- 当前仓库：[lightchain-saas-v5.5](https://github.com/emeiiixxx/lightchain-saas-v5.5)。
- v5.3 仓库与分享地址继续保留；本项目不自动包含 v5.4 改动。

## 本地运行

```sh
npm ci
npm run dev -- --port 4173
```

打开 http://127.0.0.1:4173/ 。生产构建使用 `npm run build`；构建后可运行 `npm run preview -- --port 4173`。

## 当前交互

- 无限画布：上传、拖动、框选、缩放、网格吸附、辅助线、整理画布、小地图、删除、撤销与重做。
- 融合节点：同一主图可创建多个独立编辑器；单张主图、最多四张参考图、从画布选择、提示词和生成设置；图片与节点可独立删除，空节点可重新添加主图。
- 抠图编辑：画笔、加减选区、框选、套索、钢笔多边形选区、笔触大小和本地透明图片导出；结果与原图连线。
- 提示词：全屏展开编辑、调整编辑区尺寸、保存、搜索、新增、编辑、删除；支持嵌套打开提示词库并返回编辑器。
- 提示词关联图片：含三条评审演示记录；按提示词身份和生成时原文匹配，另存新条目不会继承旧图。
- 深浅主题、组件状态、Tab 导航焦点与 200ms 缓出动效。

- 演示生成：点击生成追加固定示例图并连接对应编辑器，支持继续派生节点；无真实 AI 请求、任务或扣费。
- 整理画布：按真实连接分层，同源编辑器同列、后续步骤向右延伸；独立图片另区摆放。详见 [布局交付规则](docs/canvas-layout-and-fit.md)。

## 数据与服务边界

这是前端交互演示，AI 融合生成、智能搜图、远程素材库及真实生成历史尚未接入后端。演示图片与关联记录不代表真实账号历史。手动抠图导出在浏览器本地完成。

画布图片保存在当前页面会话，刷新后清空；提示词库、项目名称和部分偏好通过当前浏览器 localStorage 保存，不随 Git 仓库同步。v5.5 使用独立的 `lc-v55-` 存储键，不读取或覆盖 v5.3 的本地数据。

## 基线设计来源

- [Lightchain SaaS v5.3](https://www.figma.com/design/lDDzsXpslev95eZ1ZpAHVt)
- [Lightchain v5.1 libraries Beta](https://www.figma.com/design/FO7bCfBv6NPle8egsVaDvG)

`docs/` 保留各次设计来源和组件记录；`AGENTS.md` 记录最新交互约定。图片与图标资源位于 `public/assets/`。

## 目录

- `src/`：组件、画布状态、主题 token 与样式。
- `public/`：运行时静态资源。
- `tests/`：画布行为检查。
- `docs/`：设计与实现来源。
- `artifacts/`：历史视觉检查截图和记录。

## 在线演示

[打开 v5.5 Flow 画布演示](https://emeiiixxx.github.io/lightchain-saas-v5.5/#/canvas)

推送到 main 后，GitHub Actions 自动构建和部署。`node scripts/build-pages.mjs` 使用项目子路径构建，并处理演示素材的静态资源路径；本地开发地址不变。

## 基线参考文档

以下文档描述 v5.3 基线，不作为 v5.5 新增功能的需求说明。

- [SaaS v5.3 产品需求文档](https://lightchain.feishu.cn/wiki/WpiswINzhiJLCxkrmZncdhRenxb)
- [本地 Markdown 版本](docs/SaaS-v5.3-产品需求文档.md)
- [画布与提示词功能规则总结](docs/画布与提示词功能规则总结.md)
