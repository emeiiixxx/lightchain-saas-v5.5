# 提示词特效按钮开发交付

用于视频工作台的短视频、长视频节点及放大输入框。统一使用 `PromptAssistButton`，文字和原有图标显示流动渐变；三处行为与样式一致。

## 颜色与外观

| 主题 | 渐变起点 | 渐变终点 |
| --- | --- | --- |
| 深色 | `Gradient/Aquamarine-300` · `#71F4D3` | `Gradient/Perfume-300` · `#CCB2FF` |
| 浅色 | `--primitive-brand-500` · `#0BC1B8` | `--primitive-purple-400` · `#A78BFA` |

组件统一读取 `--prompt-assist-gradient-start` 和 `--prompt-assist-gradient-end`，由主题映射到上表颜色。切换主题时即时换色，保持当前动画进度。浅色值取自设计提供的色块。

沿用 Beta Ghost 按钮：高24px、左右内边距8px、圆角6px，图标16px，图文间距4px，文字12px/20px、字重500。悬停沿用 State/hover，保留键盘聚焦反馈，不显示 tooltip。按钮位于字数左侧，间距4px。

## 动效配置

采用设计提供的 React Bits `GradientText` 源码，已适配项目 TypeScript，无新增依赖。

| 参数 | 取值 |
| --- | --- |
| `variant` | `flow` |
| `animationSpeed` | `3` |
| `glow` | `0`，无外发光 |
| `yoyo` | `false` |
| `scale` | `3` |
| `showBorder` | `false` |
| `pauseOnHover` | `false` |
| `followPointer` | `false` |

默认持续流动，无外发光。`animationSpeed=3` 是速度参数，flow不会每3秒重置；当前源码的flow分支不读取yoyo，显式关闭该参数不改变flow的流动方式。悬停和聚焦等状态沿用200ms ease-out。按钮离开视口或浏览器进入后台时暂停，返回后继续；卸载清理动画。系统开启减少动态效果时保留静态渐变。高对比度模式使用可见的普通文字与图标。

## 文案与点击

- 输入为空或只有空格、换行：显示「提示词生成」，点击传出 `generate`。
- 输入包含有效内容：显示「提示词扩写」，点击传出 `expand`。
- 输入、清空、应用提示词后即时切换；节点与放大输入框共用同一个输入值。
- 按钮只负责显示和传出操作，调用方负责接入服务。当前 Demo 点击提示服务未接入，不修改原文；请求、结果写回及请求中状态待业务接口接入时实现。

## 源码与接入

| 文件 | 用途 |
| --- | --- |
| `src/components/PromptAssistButton.tsx`、`.css` | 业务按钮、文案判断、图标和文字布局 |
| `src/components/GradientText.tsx`、`.css` | React Bits 渐变效果及动画生命周期 |
| `src/tokens.css` | 深浅色映射与颜色变量 |
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

深浅主题颜色分别符合上表；空白与有内容时的名称、点击操作一致；节点与放大框同步；图标和文字连续流动且布局不跳动；减少动态效果时静态显示；键盘可聚焦和触发按钮。Demo 发布记录与源码可供研发对照，视觉验收需在实际页面进行。
