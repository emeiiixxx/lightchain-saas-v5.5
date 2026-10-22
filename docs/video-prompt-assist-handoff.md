# 提示词特效按钮开发交付

用于视频工作台的短视频、长视频节点及放大输入框。统一使用 `PromptAssistButton`，图标与文字使用 Text/link 基色，并共享一条从左向右移动的柔和扫光；三处行为与样式一致。

## 颜色与外观

| 主题 | 图标与文字基色 |
| --- | --- |
| 深色 | `Text/link` · `#0BC1B8` |
| 浅色 | `Text/link` · `#069B96` |

基色统一读取 `--text-link`。扫光使用同色提亮值 `color-mix(in srgb, var(--text-link) 40%, white)`，只显示在图标与字形内部。切换主题时即时换色，保持当前动画进度。

沿用 Beta Ghost 按钮：高24px、左右内边距8px、圆角6px，图标16px，图文间距4px，文字12px/20px、字重500。悬停沿用 State/hover，保留键盘聚焦反馈，不显示 tooltip。按钮位于字数左侧，间距4px。

## 动效配置

基于设计提供的 React Bits `GradientText` 源码，新增本地 `shimmer` 分支，复用图文共用尺寸和动画生命周期。使用项目 TypeScript，无新增依赖。

| 参数 | 取值 |
| --- | --- |
| `variant` | `shimmer`，本地扫光分支 |
| `angle` | `90`，从左到右 |
| `animationSpeed` | `2`，单次扫光2秒 |
| `pauseDuration` | `0.5`，每次扫光后停顿500ms |
| `glow` | `0`，无外发光 |
| `yoyo` | `false` |
| `showBorder` | `false` |
| `pauseOnHover` | `false` |
| `followPointer` | `false` |

总周期2.5秒：单条柔和光带用2秒从图标左缘进入，经过文字并从文字右缘离开；随后停顿500ms，只显示纯 Text/link 基色，再开始下一次。始终从左向右，不倒放、不加外发光。

图标和文字以整条图文内容的尺寸共用同一扫光坐标，文字不重新起光。文案或语言变化时，坐标随内容尺寸自动同步。

悬停和聚焦等状态沿用200ms ease-out。按钮离开视口或浏览器进入后台时暂停，返回后继续；卸载清理动画。系统开启减少动态效果时使用纯 Text/link，不播放扫光。高对比度模式使用可见的普通文字与图标。

## 文案与点击

- 输入为空或只有空格、换行：显示「提示词生成」，点击传出 `generate`。
- 输入包含有效内容：显示「提示词扩写」，点击传出 `expand`。
- 输入、清空、应用提示词后即时切换；节点与放大输入框共用同一个输入值。
- 按钮只负责显示和传出操作，调用方负责接入服务。当前 Demo 点击提示服务未接入，不修改原文；请求、结果写回及请求中状态待业务接口接入时实现。

## 源码与接入

| 文件 | 用途 |
| --- | --- |
| `src/components/PromptAssistButton.tsx`、`.css` | 业务按钮、文案判断、图标和文字布局 |
| `src/components/GradientText.tsx`、`.css` | 本地 shimmer 分支、图文共用尺寸及动画生命周期 |
| `src/tokens.css` | 深浅主题的 Text/link 颜色变量 |
| `src/components/VideoWorkflowNode.tsx` | 节点接入示例 |
| `src/components/PromptTools.tsx` | 通过 `expandedAction` 在放大输入框复用按钮 |

按钮依赖项目现有 `ui` 中的 Beta `Button`，图标继续使用设计导出的原SVG。迁入其他项目时，一并映射 Button、图标及颜色变量。

```tsx
import { PromptAssistButton } from './PromptAssistButton';

const action = (
  <PromptAssistButton
    value={prompt}
    icon={promptIcon}
    onAction={kind => onPromptAssist(kind, prompt)}
  />
);

// 节点底部渲染 action；展开编辑器通过同一个 value 和 action 同步。
<PromptTools
  value={prompt}
  onChange={setPrompt}
  labels={labels}
  maxLength={5000}
  expandedAction={action}
/>
```

`onPromptAssist` 由业务调用方提供。中英日文可通过 `generateLabel`、`expandLabel` 传入文案，默认使用中文。

## 验收要点

深浅主题的图标与文字均使用上表基色；空白与有内容时的名称、点击操作一致；节点与放大框同步；扫光从图标延续到文字，2秒扫完、停500ms后循环，不倒放、无外发光；切换文案或语言后光带仍连续，布局不跳动；停顿期间及减少动态效果时显示纯 Text/link；键盘可聚焦和触发按钮。Demo 发布记录与源码可供研发对照，视觉验收需在实际页面进行。
