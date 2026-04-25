# 文档索引

`docs/` 是仓库唯一的文档根目录。主 `README` 只保留快速开始、核心风险、致谢和索引；更详细的说明统一拆到这里。

## 用户文档

- [`guide.zh-CN.md`](./guide.zh-CN.md)
  主体导览。适合第一次进入项目的用户，包含推荐路线、安装方式、快速开始和常见使用场景。

- [`features.zh-CN.md`](./features.zh-CN.md)
  功能列表。包含能力范围、命令分类、功能覆盖边界和完整命令索引。

- [`implementation.zh-CN.md`](./implementation.zh-CN.md)
  具体实现细节。包含配置模型、环境变量、输出模型、收藏语义、仓库开发入口和项目结构。

- [`experimental.zh-CN.md`](./experimental.zh-CN.md)
  实验性功能说明。包含 OAuth、Turnstile、本地 helper、private session、hosted backend 以及当前已知限制。

## 其他文档

- [`skills/README.md`](./skills/README.md)
  仓库内 Skill 文档索引和说明。

- [`research/`](./research/)
  研究记录、接口调查、设计草案和一次性参考资料。

- [`experimental/`](./experimental/)
  归档的实验文档。它们保留在仓库中供参考，但不属于普通用户的默认阅读路径。

## 规则

- 不新增平行的顶层 `doc/` 目录。
- 新的 Markdown 文档统一放在 `docs/` 下。
- 面向用户的拆分文档当前统一使用简体中文维护。
