# Privacy / 隐私说明

Linkcard handles newly created, selected URL text on the current page or in visible unlocked Sections, plus explicit user paste events delivered to its hidden iframe. Explicitly remote changes are ignored. On Run it reads plugin data from selected legacy cards to add title links without refetching. It does not poll the Windows clipboard, scan the whole document or start automatically.

插件处理当前页面或可见未锁定分区内新建且选中的 URL 文字，以及用户主动粘贴到隐藏窗口的链接；忽略明确标记为远端的修改。Run 时读取所选旧卡的插件数据以补上标题链接，无需重新抓取。不轮询系统剪贴板、不扫描整页、不自启。

## Network

- The unchanged optional helper binds to 127.0.0.1:43187 and fetches public pages/images. It logs no request URLs and keeps no URL-history database.
- Public Behance projects use an in-memory anonymous visitor session. No browser profile, login cookie, account token or personal browser data is read.
- The helper rejects private/reserved generic destinations, credentials and nonstandard ports, validates redirect destinations and preserves TLS hostname verification.
- If a local Windows proxy uses Fake-IP DNS, the helper can resolve public hostnames through dns.alidns.com before tunneling to a validated public IP. The resolver receives the hostname. Fixed Behance project/CDN hosts retain the existing proxy and same-host redirect checks.
- If local retrieval fails, the public URL including query parameters may go to api.microlink.io or public video oEmbed providers. Covers are fetched through the helper or their public hosts.
- No website icons, uploaded covers or selected-canvas artwork are requested in 0.3.0.

## Storage

Up to 20 completed raster previews are cached in memory until the plugin stops. Each card stores a raster background and a locked native title hyperlink in Figma; original URL and title are also stored in plugin data. Inter Regular loads through Figma for the title. Clicking links uses Figma/browser navigation, independently of preview fetching. Normal Figma storage and synchronization apply. No analytics, passwords, keys, clipboard history, private-account import or local-file read endpoint.

0.3.4 的卡片底图、锁定的原生标题超链接均保存在 Figma 文档，来源 URL 与标题同时保存在插件数据中。标题字体 Inter Regular 通过 Figma 加载。点击链接由 Figma/浏览器打开，与预览抓取独立。最多 20 份图片预览缓存随插件停止清空，遵循普通 Figma 文档存储与同步机制。

中文：插件仅在运行期间处理当前页新粘贴的公开 URL，不监听系统剪贴板、不扫描原有文档、不设置开机自启。先用已有本机解析器，失败时可能请求公开预览服务；不读取浏览器登录信息。卡片图片、来源 URL 按正常 Figma 文档机制保存。最多20份会话内存缓存随插件停止清空。
