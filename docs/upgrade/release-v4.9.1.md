# 学工智伴 v4.9.1 前瞻版发布审计

更新时间：2026-08-26

## 当前结论

本轮工作区目标为 v4.9.1 前瞻版，当前交付修订为 `r8`。它可以作为受控体验包使用；`license.windsky.store` 已部署 preview 更新清单和 v4.9.1 下载目录，配置正确的 v4.9.0+ 前瞻桌面包可以从公网获取更新。它仍不能被描述为已经完成代码签名、公证、支付闭环或真实设备验收的正式商业稳定版。v4.9.0 历史资产、v4.8.5 正式维护线和旧数据格式均保留。

## 本轮已实现

- 宿舍查寝异常、量化考评规则明细、竞赛资源、学生报名与分工采用正文区与操作区分离的布局；正文允许正常换行，手机端操作区自动换到下一行。
- 局域网同步保留主机、配对和同步的核心路径，并将令牌、设备指纹、手动队列等高级信息收进高级区域。
- 文件库继续支持表格、模板、政策 PDF、图片和业务附件；样例文件可以查看，真实文件上传经过 file_upload 权益和业务层二次校验。
- 未激活工作区可以浏览样例数据、清空和恢复样例快照；真实新增、编辑、删除、导入、换机包导入、备份恢复和文件上传不能通过按钮或底层动作绕过授权。
- 新增独立 AI 对话页面。默认不带学生数据；选择学生或班级后，必须预览脱敏发送范围，再发送问题；对话只保留当前会话，不自动修改事实记录。
- 友情 AI 资格激活后，AI 工作台和对话页不再要求用户填写普通模型 Key、模型名称或服务地址，改显示托管服务状态和上游波动提示。
- 构建入口、产品手册源文件、速查手册和前瞻交付脚本切换到 v4.9.1。
- 修复 r7 交付包未激活仍可使用普通业务的缺陷：新的网页和 Electron 包都嵌入商业模式；未激活只能浏览样例，真实数据、文件上传、导入、备份恢复和更新检查均由底层授权守卫拒绝。
- 修复授权服务活动隔离：部署配置存在时只接受当前五个活动哈希，数据库中残留的旧活动不能再兑换；四个商品码和友情托管码已用独立测试工作区完成公网验收。

## 自动化验证状态

本轮已完成的定向检查：

```text
pnpm lint
node tests/license-contract.js
node tests/entitlements.js
node --check src/core/cwb-license.js
```

前一轮 v4.9.1 代码和交付物曾通过完整门禁；本轮 r8 在此后新增了商业边界和活动白名单修复，因此最终门禁需要在 r8 文档、Windows/macOS 产物和交付包组装完成后重新执行。当前已完成的 r8 定向检查见[授权边界复核](./v4.9.1-commercial-boundary-r8.md)。

## 公网服务器实测

| 地址 | 结果 | 说明 |
| --- | --- | --- |
| `https://license.windsky.store/api/v1/health` | HTTP 200 | PostgreSQL 授权服务可访问 |
| `https://license.windsky.store/api/v1/products` | HTTP 200 | 四档目录可访问，价格为 10/20/40/60 元 |
| `https://license.windsky.store/api/v1/updates/latest?channel=preview` | 匿名 HTTP 401；永久更新许可证设备认证后 HTTP 200 | 返回 v4.9.1 preview 清单、平台地址、哈希、最低版本和清单签名 |
| `https://license.windsky.store/downloads/v4.9.1/` | HTTP 200 | 下载中心已部署 v4.9.1 网页端、PDF、Windows/macOS 前瞻包 |
| `https://license.windsky.store/downloads/preview/counselor-desk-4.9.1-x64.exe` | HTTP 200 | Windows x64 更新包地址可访问，清单标记为 `unsigned-preview-v1` |
| `https://license.windsky.store/downloads/preview/counselor-desk-4.9.1-arm64.exe` | HTTP 200 | Windows ARM64 更新包地址可访问，清单标记为 `unsigned-preview-v1` |
| `https://license.windsky.store/downloads/preview/counselor-desk-4.9.1-mac-universal.zip` | HTTP 200 | macOS Universal 更新包地址可访问，清单标记为 `unsigned-preview-v1` |
| `https://license.windsky.store/downloads/preview/counselor-desk-4.9.1-mac-universal.dmg` | HTTP 200 | macOS Universal DMG 地址可访问，前瞻包仍未签名/公证 |

因此，前瞻通道的软件内“检查更新、下载和哈希/清单验签”链路已经具备公网入口；当前 v4.9.1 已是最新版本时不会重复提示更新。前瞻包使用明确的 `unsigned-preview-v1` 诊断标记，只在 preview 配置下跳过平台代码签名校验；正式商业通道仍必须使用已签名安装包。

## 未完成事项

- Windows Authenticode、macOS Developer ID 签名和公证尚未提供证据；本轮生成的桌面包只能标为前瞻诊断包。
- 支付平台 webhook、自动邮件交付、正式 KMS/HSM、真实订单发码和换机售后仍需生产配置。
- 公众号本轮只允许保存草稿和自动回复配置，不直接群发；真实开发者二维码素材缺失时保留占位，不伪造二维码。
- Windows、macOS、浏览器 IndexedDB、离线 HTML、局域网手机、备份恢复和包含照片/证书/活动附件的数据集仍需按最终清单进行真实设备验收。
- preview 更新服务已部署，但这不等于静默更新、平台签名、跨重启回滚和真实设备升级已经完成验收。

## 发布纪律

真实许可证、活动兑换码、托管 AI Key、服务器凭据、管理员 Key 和更新签名私钥不得进入 Git、安装包、普通文档、日志、备份、公众号文章或聊天。完成最终门禁并取得服务器/真实设备证据前，不创建 v4.9.1 正式 Tag 或正式商业 Release。
