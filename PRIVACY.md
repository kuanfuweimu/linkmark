# Privacy / 隐私说明

Linkcard watches only newly created, selected, local top-level URL text on the current Figma page while the plugin is running. It does not read the Windows clipboard, scan existing documents or start automatically.

## Network

- The unchanged optional helper binds to 127.0.0.1:43187 and fetches public pages/images. It logs no request URLs and keeps no URL-history database.
- Public Behance projects use an in-memory anonymous visitor session. No browser profile, login cookie, account token or personal browser data is read.
- The helper rejects private/reserved generic destinations, credentials and nonstandard ports, validates redirect destinations and preserves TLS hostname verification.
- If a local Windows proxy uses Fake-IP DNS, the helper can resolve public hostnames through dns.alidns.com before tunneling to a validated public IP. The resolver receives the hostname. Fixed Behance project/CDN hosts retain the existing proxy and same-host redirect checks.
- If local retrieval fails, the public URL including query parameters may go to api.microlink.io or public video oEmbed providers. Covers are fetched through the helper or their public hosts.
- No website icons, uploaded covers or selected-canvas artwork are requested in 0.3.0.

## Storage

Up to 20 completed raster previews are cached in memory until the plugin stops. Each card is a single image in Figma; original URL and title are stored in plugin data. Normal Figma storage and synchronization apply. No analytics, passwords, keys, clipboard history, private-account import or local-file read endpoint.

中文：插件仅在运行期间处理当前页新粘贴的公开 URL，不监听系统剪贴板、不扫描原有文档、不设置开机自启。先用已有本机解析器，失败时可能请求公开预览服务；不读取浏览器登录信息。卡片图片、来源 URL 按正常 Figma 文档机制保存。最多20份会话内存缓存随插件停止清空。
