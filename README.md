# Linkcard 0.3.3

Fast, single-object preview cards for Figma Design. 快速生成可整张拖动的图片卡片。

本机开发版为 0.3.3，Section 粘贴修复等待 Figma 实机确认，尚未发布下载包。 / Local development version 0.3.3 includes the Section paste fix; actual Figma verification is pending and no download package has been published for it.

[上一预发布版 / Previous prerelease v0.3.2](https://github.com/kuanfuweimu/linkmark/releases/tag/v0.3.2) · [反馈问题 / Report an issue](https://github.com/kuanfuweimu/linkmark/issues)

## Use / 使用

For a new installation, extract `Linkcard-0.3.2.zip`, then in Figma desktop choose Plugins → Development → Import plugin from manifest and select `Linkcard/manifest.json`. No Node.js build is needed to run the plugin. Python 3 is only required for the optional local preview helper.

首次安装：解压下载包，在 Figma 桌面版开发插件菜单导入 `Linkcard/manifest.json`。运行插件无需构建；可选本机解析器需要 Python 3。

1. Close the old Linkcard instance and run Linkcard again. The brief notification says **Linkcard 0.3.3 ready**; no editor panel opens.
2. Paste a public URL onto an empty part of the canvas or inside a Section. The plugin converts a newly created, selected URL text layer under the page or visible, unlocked Sections. It also handles an explicit user paste delivered to the hidden worker iframe.
3. A single image card appears first. Metadata and cover update that same object when ready. You can move or resize it while waiting.

中文：停止旧实例后重新运行 Linkcard，看到 0.3.3 ready 提示后，在画布或分区空白处粘贴公开 URL。转换页面下或可见、未锁定分区内新建且选中的 URL 文字，也接收用户直接粘贴到隐藏窗口的链接。先出现可整张拖动的图片卡片，封面随后原位补齐；加载期间可移动、缩放。

The old preview/editor, Upload cover, Use selection as cover, layout controls and Reconnect panel have been removed. No system clipboard watcher or startup task was added. The existing optional local HTTP helper is unchanged; `Start-Linkcard.ps1` starts it on 127.0.0.1:43187 if needed. Without it, public preview services are attempted.

旧编辑界面及封面上传功能已移除，不新增监听剪贴板的常驻助手或开机启动。已有可选本机网页解析器保持原样。

## Behavior / 行为

- Each card is one Rectangle with a 720 × 640 JPEG image, displayed at 360 × 320. No child layers or font downloads.
- Initial card generation does not wait for metadata, cover, favicon or Figma font loading.
- Up to three previews run concurrently; duplicate requests share work. Up to 20 completed card images are cached in memory for the current plugin run.
- A late cover does not reset position, scale, rotation or selection. Deleted cards and manually replaced image fills are left alone.
- Failed retrieval retains the initial card and reports the limitation. Failed results are not cached permanently.
- Original URL is retained as plugin data. The flattened card has no editable text or text hyperlink; it is a movable image, not a live website embed.
- Existing text, collaborators' changes, text inside Frames/components, and undo-restored URLs are not automatically converted. Section children are supported, including nested Sections.

分区内（含嵌套分区）的新粘贴已纳入转换；保留所在分区、局部坐标和层级顺序。已有文字、协作者的修改、Frame/组件内文字以及撤销恢复的 URL 不自动转换。 / Newly pasted Section text retains its parent, local coordinates and stacking order when replaced.

**The plugin still must be started and remain running.** Closing it or starting another plugin stops conversion. This is not a native global paste extension and is not an always-on clipboard listener.

**仍需先启动并保持插件运行。** 关闭插件或切换其他插件后，自动转换停止。图片卡片没有可编辑文字或文字超链接，源 URL 保留在插件数据中。

## Validation / 验证

2026-11-06: 30 plugin regression checks and the official Plugin API typecheck passed for 0.3.3; 14 unchanged helper tests and a live HTTP/raster check passed for 0.3.0. Native Canvas2D rendered and decoded the actual 2× preview, including a separate Chinese/long-title case. No screen or browser UI automation was used.

中文：0.3.3 通过 30 项插件回归及官方 API 类型检查。未修改的解析器在 0.3.0 时通过 14 项测试及真实 HTTP/图片生成检查。使用原生 Canvas2D 渲染、解码双倍分辨率预览及中文长标题；未使用屏幕或浏览器自动化。

- Local first-card mock: 7.3 ms (excludes the 80 ms event debounce and real Figma IPC/image import).
- One public Behance project: 2686 ms for metadata, cover and full raster; repeated cached build: 0.05 ms; final JPEG: 109029 bytes.
- The old helper baseline for the same page was 2647 ms / 1596 ms across two requests, excluding Figma layer creation. These timings do not establish faster network retrieval. The change makes the initial object available earlier and removes repeat retrieval and editable-layer work.
- The user's diagnostic screenshot confirms host/worker handshake and a real CREATE event for TEXT under SECTION, rejected by the old filter. Actual card creation, hidden execution, dragging and undo after this fix still need confirmation. Native Canvas2D output is not a Figma or Chromium screenshot.

中文：实测证明本地首卡无需等待网络、重复链接复用缓存；没有宣称网页首次抓取本身变快。用户诊断截图确认主脚本和后台握手完成，Section 内 TEXT 的 CREATE 事件被旧过滤器跳过。修复后的实际生成、隐藏运行、拖动和撤销仍待实机确认。

```sh
npm ci
npm run check
npm run test:helper
```

Source / 源码: [kuanfuweimu/linkmark](https://github.com/kuanfuweimu/linkmark). Version 0.3.2 is a GitHub prerelease; Figma Community publication has not been completed. The repository keeps its original name for existing links.

Before replacing an existing installation, save a copy of that plugin folder. To roll back, restore that copy and reopen the plugin. Keep the imported folder path unchanged when updating an existing installation.

中文：0.3.2 为 GitHub 预发布版，尚未发布 Figma Community。更新前保留原插件目录备份；回退时恢复备份并重开插件。现有导入目录应保留原路径。

## 0.3.1 paste fix / 粘贴修复

The page listener now reads the node ID from `change.node.id` and does not require undocumented `origin` or top-level `id` fields. Explicit `REMOTE` origins are still ignored when supplied, and newly created text must be selected before conversion. The documented `{type, node}` event shape is covered by a regression that failed on 0.3.0 and passes on 0.3.1.

An explicit paste delivered to the hidden iframe now creates a card even when no canvas text node is created. No operating-system clipboard polling or resident helper is added. Worker startup and missing image replies now produce error notifications, instead of leaving only Figma's generic Running status.

中文：修复页面事件字段读取错误，并接收隐藏窗口获得的用户粘贴事件。新增启动/首卡响应超时提示。0.3.0 在文档所定义的事件格式下可复现跳过转换，0.3.1 对应回归通过；当前用户的 Figma 实机结果仍待确认。

API reference: https://developers.figma.com/docs/plugins/api/NodeChange/

## 0.3.2 startup fix / 启动修复

Removed the 1 px `showUI` width override. Figma documents a minimum width of 70 px, including hidden workers; Linkcard now uses Figma's default dimensions with `visible: false`. A startup notification identifies the loaded version before the iframe is created. Synchronous host startup errors now close the plugin with the actual error message. The test host enforces Figma's documented dimension limits instead of accepting invalid options.

中文：去掉低于 Figma 最小宽度要求的1px窗口参数，使用默认尺寸且保持隐藏。加载时先显示0.3.2 starting，后台连接成功才显示ready；启动异常显示原始错误并退出。本机实际成功运行仍需验证，不能把模拟测试当作实机结论。

API reference: https://developers.figma.com/docs/plugins/api/properties/figma-showui/

## 0.3.3 分区粘贴修复 / Section paste fix

根据用户实际日志中的 `parentType: SECTION, eligible: false` 修复仅允许页面直属文字的条件。支持可见且未锁定的分区及嵌套分区，按原父级、坐标与层级顺序替换为图片；在同页分区间拖动加载中的卡片也能继续更新封面。移除临时诊断窗口，恢复隐藏模式。新增回归先在旧代码上失败，修复后通过；不将模拟测试当作实机成功。

The user's runtime log showed `parentType: SECTION, eligible: false`. The filter now accepts visible, unlocked Sections and nested Sections, replacing text under its original parent at its local position and stacking order. Moving a loading card between Sections on the same page still allows its cover to update. The temporary diagnostic panel is removed and hidden mode restored. The new regression failed on the old code and passed after the fix; simulated checks do not establish real Figma success.
