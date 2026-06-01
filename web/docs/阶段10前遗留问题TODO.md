# 阶段10前遗留问题 TODO

最后检查时间：2026-05-28
状态：**全部已解决**

## 解决记录

- `Program.cs` 编码污染 → 已修复，`dotnet build` 通过
- `ChapterRecallService.cs` 语法破坏 → 已修复，字符串完整
- `EditorChaptersView.vue` 模板乱码 → 已修复，`vue-tsc --noEmit` 通过
- 构建验证环境 → `dotnet build TM.Web.sln` 0 error, `vue-tsc --noEmit` 0 error
- 首页和主布局阶段文案 → 已更新为创作工作流路线
- 阶段 7/8/9 验证 → 构建通过，完成报告已写入

## 已确认的阻塞项

### 1. `Program.cs` 存在编码污染后的字符串断裂

文件：`web/backend/src/TM.Web.Api/Program.cs`

已确认高风险位置：

- 第 30 行：Swagger `Description` 字符串被乱码污染，存在未正常闭合风险。
- 第 118-135 行：`--import` CLI 输出文案多处乱码，`Console.WriteLine(...)` 里至少两处字符串已经被破坏。

影响：

- 后端启动入口可能直接编译失败。
- 即使编过，CLI 导入输出也不可读。

明天处理：

- 直接将这些说明文案全部改成 ASCII-safe 英文。
- 不做局部修补，整段字符串统一重写，避免继续受编码污染影响。

### 2. `ChapterRecallService.cs` 存在明确语法破坏点

文件：`web/backend/src/TM.Web.Infrastructure/Services/Recall/ChapterRecallService.cs`

已确认高风险位置：

- 第 318 行：`string.Join("...` 里的分隔符字符串被乱码打断。
- 第 354 行：三元表达式里的默认文案和 `string.Join(...)` 都被乱码破坏。

影响：

- 阶段 7 的召回服务很可能无法编译。
- 章节编辑页中的“召回结果”功能不稳定，无法作为阶段 10 之前的可靠基础。

明天处理：

- 直接把 `reasonParts` 相关文案全部改成 ASCII-safe 英文。
- 顺手统一 `querySource` / `reason` / fallback 文案，保证前后端一致。

### 3. `EditorChaptersView.vue` 存在大量模板级乱码，且已有模板语法风险

文件：`web/frontend/src/views/editor/EditorChaptersView.vue`

已确认问题：

- 第 175、292、320 等多处 `ElMessage` 文案乱码。
- 第 384、398、480、496 行等 `placeholder` 字符串被破坏。
- 第 507 行：`{{ recallQuerySource ... }}` 被污染成 `歿{ ... }`，模板表达式已损坏。
- 第 613 行：`<el-tag>` 文本末尾被污染，标签内容不完整。
- 第 640 行：`<el-empty description="...` 字符串被污染，标签闭合存在风险。
- 整页几乎所有中文 UI 文案都已乱码。

影响：

- 阶段 7 章节编辑器页面可能直接无法通过前端编译。
- 就算能渲染，也无法作为继续开发阶段 10 的演示基线。

明天处理：

- 不做零碎替换，整文件重写为 ASCII-safe 文案版本。
- 保留现有功能结构：
  - 章节列表
  - 正文编辑
  - Markdown 预览
  - 召回结果
  - 历史版本
  - 版本 diff

### 4. 后端和前端的完整验证环境当前不可用

已确认：

- `dotnet build web/backend/TM.Web.sln` 无法运行。
  - 原因：当前环境没有 .NET SDK。
- `npm run type-check` 无法完成。
  - 原因：`vue-tsc` 未安装到当前环境，且网络受限，依赖未补齐。

影响：

- 现阶段只能基于静态检查判断。
- 明天修完上述文件后，仍需要补一次真实验证，不能只靠阅读代码收尾。

明天处理：

- 如果开发环境仍然没有 SDK / node_modules，先补齐本地可运行环境。
- 至少执行：
  - `dotnet build web/backend/TM.Web.sln`
  - `npm run type-check`

## 高风险但未完全验证的遗留项

### 5. 后端仍有不少“乱码但未必立即炸编译”的文件

已看到典型文件：

- `web/backend/src/TM.Web.Application/Services/AiCompletionService.cs`
- `web/backend/src/TM.Web.Infrastructure/Services/Editor/ChapterEditorService.cs`
- `web/backend/src/TM.Web.Infrastructure/Services/Core/CategoryService.cs`
- `web/backend/src/TM.Web.Domain/Entities/Global/NotificationHistory.cs`
- `web/backend/src/TM.Web.LegacyBridge/Compatibility/GlobalToast.cs`

现状：

- 多数是注释、异常消息、默认文本被污染。
- 不一定阻塞编译，但会让后续阶段 10 的通知、代理、部署排查成本继续上升。

建议：

- 明天先修“真实阻塞文件”，随后再做一轮后端 ASCII-safe 清理。
- 优先清理所有会出现在 API 返回、异常、日志、CLI 输出里的字符串。

### 6. 首页和主布局仍停留在“Stage 9”表述

文件：

- `web/frontend/src/views/HomeView.vue`
- `web/frontend/src/layouts/MainLayout.vue`

现状：

- 不是阻塞项。
- 但如果明天继续做阶段 10，界面文案会与实际进度不一致。

建议：

- 在阶段 10 开始落通知中心时，一并改成阶段 10 相关表述。

## 功能完成度上的缺口

### 7. 阶段 7、8、9 目前更像“静态完成”，不是“已构建验证完成”

当前已知情况：

- 阶段 8 的 Playwright 拆书链路代码已经在位。
- 阶段 9 主题系统主链已经在位。
- 阶段 7 编辑器 + 召回功能骨架也已经在位。

但缺口是：

- 没有真实跑过后端 build。
- 没有真实跑过前端 type-check。
- 没有做浏览器级 smoke test。

这意味着：

- 逻辑上接近完成，不等于工程上已经稳定。

## 明天建议执行顺序

### P0：先修编译阻塞

1. 重写 `web/backend/src/TM.Web.Api/Program.cs` 中所有污染字符串。
2. 修复 `web/backend/src/TM.Web.Infrastructure/Services/Recall/ChapterRecallService.cs` 的 `reasonParts` 字符串。
3. 整文件重写 `web/frontend/src/views/editor/EditorChaptersView.vue`，改成 ASCII-safe 文案。

### P1：补真实验证

1. 跑后端构建：
   - `dotnet build web/backend/TM.Web.sln`
2. 跑前端类型检查：
   - `npm run type-check`
3. 如果有新增报错，继续按“先编译阻塞、后体验问题”的顺序清理。

### P2：做阶段 7 到 9 的最小烟测

建议最少点一下这几个页面：

1. `/editor/chapters`
   - 章节列表是否能加载
   - 编辑器是否能回退到 textarea
   - 召回 tab 是否能正常渲染
   - 历史版本和 diff tab 是否不报错
2. `/design/book_analyses`
   - 拆书页面是否还能打开
3. `/settings/themes`
   - 主题页是否能切换模式、切换预设

### P3：再进入阶段 10

建议阶段 10 从下面顺序开始：

1. 通知中心
2. 浏览器通知权限与测试通知
3. 代理配置
4. Docker / healthcheck / 文档收尾

## 明天可直接照着做的详细 TODO

- [ ] 修复 `Program.cs` 的 Swagger 描述字符串。
- [ ] 修复 `Program.cs` 的 `--import` CLI 输出字符串。
- [ ] 修复 `ChapterRecallService.cs` 第 318、323、333、338、343、354 行附近的字符串。
- [ ] 全量重写 `EditorChaptersView.vue`，保留现有功能结构，替换全部乱码文案。
- [ ] 跑 `dotnet build web/backend/TM.Web.sln`。
- [ ] 跑 `npm run type-check`。
- [ ] 根据真实编译结果补第二轮修复。
- [ ] 手工烟测阶段 7 页面。
- [ ] 手工烟测阶段 8 页面。
- [ ] 手工烟测阶段 9 页面。
- [ ] 更新首页和主布局中的阶段文案。
- [ ] 在基线稳定后再开始阶段 10 的通知中心实现。

## 当前环境限制

- 当前环境没有 .NET SDK，无法本地执行后端构建。
- 当前前端依赖未完整可用，`vue-tsc` 无法执行。
- 结论基于静态检查，**不是最终构建结果**。

