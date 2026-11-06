# Linkcard 0.3.4

Fast, single-object preview cards for Figma Design. 快速生成可整张拖动的图片卡片。

当前开发源码为 0.3.4，加入原生标题超链接。用户已确认 0.3.3 分区粘贴正常；0.3.4 标题点击仍待实机确认，尚未发布对应下载包。 / Current development source 0.3.4 adds native title hyperlinks. The user confirmed Section paste works in 0.3.3; actual title clicks in 0.3.4 remain unverified and no corresponding download package has been published.

[上一预发布版 / Previous prerelease v0.3.2](https://github.com/kuanfuweimu/linkmark/releases/tag/v0.3.2) · [反馈问题 / Report an issue](https://github.com/kuanfuweimu/linkmark/issues)

## Use / 使用

For a new installation of 0.3.4, download and extract the current repository source, then in Figma desktop choose Plugins → Development → Import plugin from manifest and select its `manifest.json`. No Node.js build is needed to run the plugin. Python 3 is only required for the optional local preview helper.

首次安装 0.3.4：下载并解压本仓库当前源码，在 Figma 桌面版开发插件菜单导入其中的 `manifest.json`。运行插件无需构建；可选本机解析器需要 Python 3。

1. Close the old Linkcard instance and run Linkcard again. The brief notification says **Linkcard 0.3.4 ready**; no editor panel opens.
2. Paste a public URL onto an empty part of the canvas or inside a Section. The plugin converts a newly created, selected URL text layer under the page or visible, unlocked Sections. It also handles an explicit user paste delivered to the hidden worker iframe.
3. A single image card appears first. Metadata and cover update that same object when ready. You can move or resize it while waiting.

中文：停止旧实例后重新运行 Linkcard，看到 0.3.4 ready 提示后，在画布或分区空白处粘贴公开 URL。转换页面下或可见、未锁定分区内新建且选中的 URL 文字，也接收用户直接粘贴到隐藏窗口的链接。先出现可整张拖动的卡片，封面随后原位补齐；加载期间可移动、缩放。

点击带下划线的标题打开来源链接；拖动封面或其他区域可整张移动。首次访问外部网站时 Figma 可能要求确认。旧版 0.3.x 卡片：停止插件，选中需要升级的旧卡，再 Run 即补上标题链接，不重新抓取网络内容。不扫描整页。

Click the underlined title to follow its source link; drag the cover or another area to move the whole card. Figma may ask for confirmation on the first external visit. To upgrade existing 0.3.x cards, stop the plugin, select the legacy cards and Run again. Only selected cards are upgraded, with no network refetch or whole-page scan.

The old preview/editor, Upload cover, Use selection as cover, layout controls and Reconnect panel have been removed. No system clipboard watcher or startup task was added. The existing optional local HTTP helper is unchanged; `Start-Linkcard.ps1` starts it on 127.0.0.1:43187 if needed. Without it, public preview services are attempted.

旧编辑界面及封面上传功能已移除，不新增监听剪贴板的常驻助手或开机启动。已有可选本机网页解析器保持原样。

## Behavior / 行为

- Each card is one movable Frame with a 720 × 640 JPEG background, displayed at 360 × 320, and a locked native title-link area inside. Inter Regular loads once per session after the first bitmap; failure retains the complete raster title.
- Initial card generation does not wait for metadata, cover, favicon or Figma font loading.
- Up to three previews run concurrently; duplicate requests share work. Up to 20 completed card images are cached in memory for the current plugin run.
- A late cover does not reset position, scale, rotation or selection. Deleted cards and manually replaced image fills are left alone.
- Failed retrieval retains the initial card and reports the limitation. Failed results are not cached permanently.
- Original URL is retained as plugin data and as a native title hyperlink. Cover and description remain rasterized; there is no editor panel or live website embed.
- Existing text, collaborators' changes, text inside Frames/components, and undo-restored URLs are not automatically converted. Section children are supported, including nested Sections.

分区内（含嵌套分区）的新粘贴已纳入转换；保留所在分区、局部坐标和层级顺序。已有文字、协作者的修改、Frame/组件内文字以及撤销恢复的 URL 不自动转换。 / Newly pasted Section text retains its parent, local coordinates and stacking order when replaced.

卡片外层整体可拖动，内部仅标题链接区域为锁定的原生文字，封面和描述仍为图片。Inter Regular 在首卡之后加载，每次运行复用；加载失败保留完整图片标题。运行期间缩放会同步标题尺寸，停止插件后需要等比缩放请使用 Scale 工具（K）。停止插件不影响已经写入文档的标题链接。

The outer card moves as one object; only its native title-link area is locked text, while cover and description remain rasterized. Resizing while the plugin runs updates title geometry. After stopping it, use the Scale tool (K) for proportional scaling. Existing native title links continue to work after the plugin stops.

**The plugin still must be started and remain running.** Closing it or starting another plugin stops conversion. This is not a native global paste extension and is not an always-on clipboard listener.

**仍需先启动并保持插件运行。** 关闭插件或切换其他插件后，自动转换停止；已有标题超链接保留，源 URL 也保存在插件数据中。

## Validation / 验证

2026-11-06: 36 plugin regression checks and the official Plugin API typecheck passed for 0.3.4; 14 unchanged helper tests and a live HTTP/raster check passed for 0.3.0. Native Canvas2D rendered and decoded the actual 2× preview, including a separate Chinese/long-title case. No screen or browser UI automation was used.

中文：0.3.4 通过 36 项插件回归及官方 API 类型检查。未修改的解析器在 0.3.0 时通过 14 项测试及真实 HTTP/图片生成检查。使用原生 Canvas2D 渲染、解码双倍分辨率预览及中文长标题；未使用屏幕或浏览器自动化。

- Local first-card mock: 7.3 ms (excludes the 80 ms event debounce and real Figma IPC/image import).
- One public Behance project: 2686 ms for metadata, cover and full raster; repeated cached build: 0.05 ms; final JPEG: 109029 bytes.
- The old helper baseline for the same page was 2647 ms / 1596 ms across two requests, excluding Figma layer creation. These timings do not establish faster network retrieval. The change makes the initial object available earlier and removes repeat retrieval and editable-layer work.
- The user confirmed real Section paste succeeds in 0.3.3. Real title clicks, font layout, locked-title interactions and legacy-upgrade undo in 0.3.4 still need confirmation. Native Canvas2D output is not a Figma or Chromium screenshot.

中文：实测证明本地首卡无需等待网络、重复链接复用缓存；没有宣称网页首次抓取本身变快。用户已确认 0.3.3 分区粘贴成功。0.3.4 的真实标题点击、字体布局、锁定交互和旧卡升级撤销仍待实机确认。

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

## 0.3.4 标题链接 / Title links

参考 FigJam 的原生链接预览，但 `createLinkPreviewAsync` 只支持 FigJam。Design 编辑画布无法直接给图片挂链接，因此使用真正的 TextNode 超链接，默认锁定以减少误编辑，用户仍可主动解锁。点击、悬停和外部网站确认由 Figma 管理，不通过选择事件强行打开浏览器。字体加载不阻塞首卡；仅升级 Run 时选中的旧版卡片。新增测试覆盖原 URL、最终标题、字体延迟/失败、删除/换图保护、缩放及旧卡升级。回退插件文件不会撤回画布升级；画布改动使用 Figma Undo。

FigJam provides native link previews, but `createLinkPreviewAsync` is FigJam-only. Images cannot carry editor hyperlinks directly in Design, so this version uses a real TextNode hyperlink, locked by default to reduce accidental edits; users can explicitly unlock it. Figma controls clicks, hover and external-site confirmation; selection events never force the browser to open. Fonts do not block the first card. Only legacy cards selected on Run are upgraded. New tests cover source URLs, final titles, delayed/failed fonts, deletion/repaint guards, scaling and legacy upgrades. Restoring plugin files does not revert canvas upgrades; use Figma Undo for document changes.

[FigJam API](https://developers.figma.com/docs/plugins/api/properties/figma-createlinkpreviewasync/) · [文字链接 / Text links](https://help.figma.com/hc/en-us/articles/360045942953-Add-links-to-text)


## 中文补充：行为与历史测量

首卡不等待元数据、封面、favicon 或字体。最多三路预览并行，重复请求共用工作，每次运行内缓存最多 20 张完整卡片。封面晚到不重置位置、缩放、旋转或选择；已删除卡片及手动替换的填充保持不动。抓取失败保留首卡并提示，不永久缓存失败结果。原 URL 同时保存在插件数据及原生标题超链接，封面和描述保持图片形式。

历史测量：本地首卡模拟 7.3 ms，不含 80 ms 防抖和真实 Figma IPC/图片导入。一条公开 Behance 链接的元数据、封面、完整栅格合计 2686 ms；缓存重复构建 0.05 ms，JPEG 109029 字节。旧辅助服务同页两次请求为 2647 / 1596 ms，不含 Figma 图层创建。这不证明网络变快，只说明首卡更早可用，减少重复抓取与可编辑图层处理。当前实机验证状态以上方 0.3.4 记录为准。

仓库保留旧名以兼容链接。更新前备份插件目录，替换时保留导入路径，回退恢复副本并重新运行；画布升级仍需 Figma Undo。

### 0.3.1 修复细节
页面监听从 `change.node.id` 读取 ID，不依赖未记录的 `origin` 或顶层 `id`；若提供明确 REMOTE 则忽略，新建文本必须选中。官方 `{type,node}` 事件格式的回归在 0.3.0 失败，在 0.3.1 通过。隐藏 iframe 收到明确粘贴时即使没有画布文本也可创建卡片。不增加系统剪贴板轮询或常驻辅助程序。worker 启动与图片响应缺失会提示错误，不再只留下通用 Running 状态。

### 0.3.2 修复细节
移除 1 px `showUI` 宽度，因为官方最小为 70 px，包括隐藏 worker；使用默认尺寸且 `visible:false`。iframe 创建前提示版本，同步宿主启动异常显示实际错误并关闭插件。测试宿主严格检查官方尺寸边界，不再放过无效值。真实桌面成功运行仍未确认。
