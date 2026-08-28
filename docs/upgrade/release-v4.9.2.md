# 学工智伴 v4.9.2 前瞻版发布审计

更新时间：2026-08-28

## 当前结论

本轮工作区目标为 v4.9.2 前瞻版。2026-08-28 已在本机完成 r16 Windows x64/ARM64、macOS Universal DMG/ZIP、唯一网页端和三份 PDF 的重新生成与校验，并已通过部署密钥将公开产物暂存到目标服务器用户目录。此前 `r14` 及 r15 仍作为同版本历史修订保留；r16 与它们的产品版本号相同，不能通过软件内更新自动替换，遇到 `LICENSE_SERVICE_NETWORK_FAILED` 必须直接下载安装本轮完整包。公网下载中心仍需 root 提权、签名清单发布和静态文件替换后才能称为 r16 已上线；当前公网仍是上一轮同名文件。本记录不宣称已完成公网替换。当前版本仍不能被描述为已经完成代码签名、公证、支付闭环或真实设备验收的正式商业稳定版。v4.9.0 历史资产、v4.8.5 正式维护线和旧数据格式均保留。

## 本轮已实现

- 宿舍查寝异常、量化考评规则明细、竞赛资源、学生报名与分工采用正文区与操作区分离的布局；正文允许正常换行，手机端操作区自动换到下一行。
- 局域网同步保留主机、配对和同步的核心路径，并将令牌、设备指纹、手动队列等高级信息收进高级区域。
- 文件库继续支持表格、模板、政策 PDF、图片和业务附件；样例文件可以查看，真实文件上传经过 file_upload 权益和业务层二次校验。
- 未激活工作区只能浏览、筛选和查看样例；样例改写和真实新增、编辑、删除、导入、换机包导入、备份恢复和文件上传不能通过按钮或底层动作绕过授权。
- 新增独立 AI 对话页面。默认不带学生数据；选择学生或班级后，必须预览脱敏发送范围，再发送问题；对话只保留当前会话，不自动修改事实记录。
- 友情 AI 资格激活后，AI 工作台和对话页不再要求用户填写普通模型 Key、模型名称或服务地址，改显示托管服务状态和上游波动提示。
- 构建入口、产品手册源文件、速查手册和前瞻交付脚本切换到 v4.9.2。
- 修复 r7 交付包未激活仍可使用普通业务的缺陷：新的网页和 Electron 包都嵌入商业模式；未激活只能浏览样例，真实数据、文件上传、导入、备份恢复和更新检查均由底层授权守卫拒绝。
- 修复授权服务活动隔离：部署配置存在时只接受当前五个活动哈希，数据库中残留的旧活动不能再兑换；当前四个商品活动和友情托管活动已在独立测试工作区完成公网验收。更新权限也已通过对应档位的真实服务请求验证：10/40 元档返回 `403 LICENSE_UPDATE_NOT_ENTITLED`，20/60 元档返回带签名的 v4.9.2 清单。
- Windows 安装器保留创建“学工智伴”桌面快捷方式；安装器因系统策略未创建时，已安装应用会在首次启动补建，不覆盖用户已有图标。macOS 应用复制到“应用程序”后首次启动会创建桌面别名，DMG 挂载盘临时运行不会生成失效别名。
- 修复 Electron IPC 错误属性未透传时的授权提示：服务器已返回的“兑换码无效”“友情 AI 码无效”等明确错误会被正确显示，不再一律显示“请联网重试”。
- 修复不同网络下本地网页的激活兼容性：授权服务在不放开订单、更新、管理或数据接口的前提下，同时兼容 Chromium 的 `Origin: file://` 与其他浏览器的 `Origin: null`；Nginx 同时提供 X25519/P-256 TLS 密钥组，避免部分设备在 TLS 1.3 密钥协商阶段失败。激活窗口会先给出授权服务连通性结果，并区分网络、超时、TLS 与业务校验错误。

## 自动化验证状态

本轮已完成的定向检查：

```text
pnpm lint
pnpm check:public
pnpm check:secrets
pnpm test:commercial
node tests/license-contract.js
node tests/redemption-client.js
node tests/desktop-shortcut.js
node tests/electron-package-config.js
node tests/desktop-windows-architecture.js
node tests/desktop-installer-smoke.js
node tests/desktop-packaged-smoke.js
node tests/desktop-packaged-license-connectivity.js
```

前一轮 v4.9.2 代码和交付物曾通过完整门禁；r16 在此基础上补齐共享联网诊断核心进入 Electron 包，并按受影响范围执行 HTTP/CORS 契约、真实公网健康/产品/无效码探针、`file://` Chrome 激活流程、TLS 1.2/TLS 1.3 P-256 握手、本地商业构建和 macOS Universal 包验收。当前交付仍使用 [r9 授权边界复核](./v4.9.2-commercial-boundary-r9.md) 作为商业权益矩阵证据；r16 不改变该矩阵，r8 至 r15 记录保留仅用于追溯此前修订。

## 公网服务器实测

| 地址 | 结果 | 说明 |
| --- | --- | --- |
| `https://license.windsky.store/api/v1/health` | HTTP 200 | PostgreSQL 授权服务可访问 |
| `https://license.windsky.store/api/v1/products` | HTTP 200 | 四档目录可访问，价格为 10/20/40/60 元 |
| `https://license.windsky.store/api/v1/updates/latest?channel=preview` | 匿名 HTTP 401；10/40 元档 HTTP 403；20/60 元档 HTTP 200 | 已按四档授权权益实测：永久更新档返回 v4.9.2 preview 清单、平台地址、哈希、最低版本和签名 |
| `https://license.windsky.store/downloads/v4.9.2/` | HTTP 200 | 下载中心可达，但同名文件仍是上一轮产物；r16 已暂存、尚未提升 |
| `https://license.windsky.store/downloads/preview/counselor-desk-4.9.2-x64.exe` | HTTP 200 | 地址可访问，但公网大小仍为上一轮值，不是 r16 |
| `https://license.windsky.store/downloads/preview/counselor-desk-4.9.2-arm64.exe` | HTTP 200 | 地址可访问，但公网大小仍为上一轮值，不是 r16 |
| `https://license.windsky.store/downloads/preview/counselor-desk-4.9.2-mac-universal.zip` | HTTP 200 | 地址可访问，但公网大小仍为上一轮值，不是 r16 |
| `https://license.windsky.store/downloads/preview/counselor-desk-4.9.2-mac-universal.dmg` | HTTP 200 | 地址可访问，但公网大小仍为上一轮值，不是 r16 |

因此，前瞻通道的软件内更新协议和公网入口已经具备，但当前 r16 尚未被静态目录和 API 清单共同发布；当前 v4.9.2 已是最新版本时不会重复提示更新。前瞻包使用明确的 `unsigned-preview-v1` 诊断标记，只在 preview 配置下跳过平台代码签名校验；正式商业通道仍必须使用已签名安装包。

2026-08-27 的网页公网兼容性验收确认：Windows Chrome 从本地 `file://` 打开商业离线网页后，能够读取健康状态并把一个结构正确、但无效的测试兑换码显示为“兑换码无效”，不再误报为网络不可用。服务端对 `Origin: file://` 和 `Origin: null` 仅放行健康、产品目录以及三条激活路线；遥测、订单、更新、管理和数据接口继续拒绝。r16 桌面包把同一诊断核心纳入 Electron 运行时；r14/r15 及更早桌面包遇到 `LICENSE_SERVICE_NETWORK_FAILED` 时仍必须重新下载当前完整包。

2026-08-28 的本地产物验收确认：r16 Windows x64/ARM64 SHA-256 分别为 `8536dbd79f94cd4f69cb1bac5cb141ba4e5eaa9040a7b1ff5c4e8615aebe9d1e` 与 `b851df769db0b74cb1cad1663d420edc0eacbb9347b86ae69d487270e87050b9`；macOS Universal ZIP/DMG 分别为 `6bb3a1a485a4608c5b01838269b7ff36038a23744ec3dbf167df23192421576a` 与 `7c8d5566e1e35b76772df0c7be01e0b88de578c4b9b7d0c733a4b0aea8e43b01`。r16 完整包已在本机生成并上传到服务器暂存目录；公网同名 URL 当前返回上一轮文件，必须完成 root 提升和 API 清单发布后重新比对服务器。

## 未完成事项

- Windows Authenticode、macOS Developer ID 签名和公证尚未提供证据；本轮生成的桌面包只能标为前瞻诊断包。
- 支付平台 webhook、自动邮件交付、正式 KMS/HSM、真实订单发码和换机售后仍需生产配置。
- 公众号本轮只允许保存草稿和自动回复配置，不直接群发；真实开发者二维码素材缺失时保留占位，不伪造二维码。
- Windows、macOS、浏览器 IndexedDB、离线 HTML、局域网手机、备份恢复和包含照片/证书/活动附件的数据集仍需按最终清单进行真实设备验收。
- preview 更新服务已部署，但这不等于静默更新、平台签名、跨重启回滚和真实设备升级已经完成验收。
- r16 与 r9 至 r15 的产品版本号相同，不能通过既有 preview 清单向旧客户端自动更新；必须把本轮文件上传到服务器，后续修订再提升版本号、重建清单并部署。
- 本轮 r16 已完成服务器用户目录暂存；目标静态目录为 `root:root` 且当前账号不可写，`sudo -n` 失败，root 直登未授权。还需要 root 提权和更新 API 管理 Key 才能执行仓库中的原子发布脚本，因此公网发布链路尚未完成。

## 发布纪律

真实许可证、活动兑换码、托管 AI Key、服务器凭据、管理员 Key 和更新签名私钥不得进入 Git、安装包、普通文档、日志、备份、公众号文章或聊天。完成最终门禁并取得服务器/真实设备证据前，不创建 v4.9.2 正式 Tag 或正式商业 Release。
