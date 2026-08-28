# 学工智伴 v4.9.3 网络链路诊断与部署说明

更新时间：2026-08-28

本说明记录前瞻版联网请求的可追踪边界。它服务于部署排障和用户反馈，不把学生资料、附件内容、许可证原文或模型密钥写入日志。

## 1. 请求链路

一次联网操作使用同一个 `X-CWB-Request-Id` 尽量贯穿以下节点：

| 节点 | 记录位置 | 典型操作 | 可核对内容 |
| --- | --- | --- | --- |
| 网页渲染层 | 浏览器 `localStorage` 环形日志 | `license...`、`update...`、`sync.client...`、`ai...` | 发起、发送、响应、完成/失败、耗时 |
| Electron 主进程 | 用户数据目录 `logs/network-diagnostics.jsonl` | `license.request`、`update.manifest`、`update.package` | 请求 ID、状态码、字节数、错误码 |
| Nginx 入口 | `/var/log/nginx/license.windsky.store.network.log` | `/api/...`、`/downloads/...` | 网关路径、状态、请求/响应字节数、代理耗时 |
| 授权服务 | `CWB_LICENSE_NETWORK_LOG_FILE` | `license/api_v1_...` | 服务端收到的请求 ID、状态码和脱敏错误码 |
| AI Relay 入站 | `AI_RELAY_NETWORK_LOG_FILE` | `ai.relay.inbound...` | Relay 是否收到请求、返回状态 |
| AI Relay 上游 | 同一 Relay 日志 | `ai.relay.upstream.chat`、`...transcribe`、`...source` | 上游握手、状态码、耗时和响应大小 |
| 局域网主机 | Electron 日志 | `sync.server...` | 配对、同步、附件分块请求的服务端结果 |

客户端发送请求前生成或沿用请求 ID；授权服务和 AI Relay 会在响应头回传该 ID。排查时按请求 ID 和时间顺序串联记录，不要按许可证原文、学生姓名或文件名搜索。

## 2. 日志字段与隐私边界

允许的字段只有：时间、请求 ID、规范化操作名、传输方式、脱敏路径、阶段、状态码、耗时、请求/响应字节数、脱敏错误码和组件名。URL 查询参数、请求正文、响应正文、`Authorization`、订单令牌、激活码、API Key、学生数据和附件二进制不会被写入诊断日志。

阶段顺序通常为：

```text
started -> request_sent -> response -> completed
                         \-> failed / aborted
```

网页日志保留最近 240 条；桌面 JSONL 默认保留最近 240 条并在达到大小上限时轮转。日志导出属于诊断资料，发送给维护者前仍需检查是否含有学校内部 URL 或业务时间信息。

## 3. 服务端配置

在授权服务器的部署环境中设置日志路径，路径必须位于服务账号可写目录，并由部署账号设置为仅服务账号可读：

```text
CWB_LICENSE_NETWORK_LOG_FILE=/var/log/counselor-desk/license-network.jsonl
AI_RELAY_NETWORK_LOG_FILE=/var/log/counselor-desk/ai-relay-network.jsonl
```

前者由 `bootstrap.cjs` 传给授权服务，后者由 `serve-ai-relay.js` 传给 AI Relay。两个日志写入器都使用 JSONL、自动限制大小并使用 `0600` 文件模式；生产环境仍应由 logrotate 或集中日志系统按最小保留期管理，并限制运维访问。

Nginx 站点配置中的 access log 只记录 URI 路径，不记录带查询参数的完整请求行：

```text
时间 request_id=... method=... uri=... status=... request_bytes=... response_bytes=... request_time=... upstream_status=...
```

如果 Nginx 日志中 `request_id` 为空，仍可用应用日志中的服务端请求 ID定位；这表示请求在到达客户端前没有携带请求 ID，不表示请求没有被服务端处理。

## 4. 用户侧排障顺序

1. 在同一台设备打开 `https://license.windsky.store/api/v1/health`，先确认 DNS、TLS 和公网入口可达。
2. 回到工作台点击激活或“检查更新”，记录页面显示的错误码、当前版本和时间。
3. 从设置右上角的诊断入口导出诊断包；桌面端同时读取用户数据目录 `logs/network-diagnostics.jsonl`。
4. 维护者按请求 ID依次检查客户端、Nginx、授权服务或 Relay 日志，先判断请求是否到达，再判断业务校验或上游模型失败。
5. 不要让用户重复发送激活码、许可证文件、API Key、真实学生资料或完整业务附件。

以下结果含义不同，不能混为“激活码错误”：

| 结果 | 优先检查 |
| --- | --- |
| 没有 `request_sent` | 客户端配置、浏览器能力或本地拦截 |
| 有客户端发送但服务端没有同一 ID | DNS、TLS、Nginx、反向代理或公网入口 |
| 服务端有 ID并返回 `4xx` | 激活码/许可证/更新权益或 CORS 业务规则 |
| 服务端返回 `5xx` | 数据库、签名器、更新存储、Relay 或上游服务 |
| 有 `response`但没有 `completed` | 客户端读取响应、解析或进程中断 |

## 5. 当前前瞻版边界

公网健康、产品目录、下载目录和主要包 URL 已从当前环境验证可达；匿名更新清单按设计返回 `401`，10 元/40 元档不能读取更新清单，20 元/60 元档才可在已激活桌面端检查更新。该结果证明公网入口和权限边界，不等同于所有用户网络、代码签名、公证、支付或真实设备升级已经完成验收。

前瞻包仍未完成 Windows Authenticode、macOS Developer ID 签名和公证。真实激活码、托管 AI Key、管理员密钥和更新签名私钥继续只保存在受控环境，不进入 Git、安装包、公开文档、日志或聊天。
