<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="home">
    <el-card shadow="never">
      <h2 class="title">天命 Web · 阶段 0 骨架</h2>
      <p class="lead">
        这是从 WPF 桌面版迁移而来的 Web 版骨架。当前会话只完成端到端 AI 流式 Demo，
        所有业务模块（设计 / 生成 / 校验 / AI 助手 / 编辑器）会在后续阶段逐步迁移。
      </p>

      <el-divider />

      <h3>验证两个端到端切片</h3>
      <el-space wrap :size="12" style="margin-top: 8px">
        <el-button type="primary" @click="router.push('/health')">健康检查</el-button>
        <el-button type="success" @click="router.push('/ai-test')">AI 流式测试</el-button>
      </el-space>

      <el-divider />

      <h3>端口约定</h3>
      <ul class="port-list">
        <li><strong>后端</strong> ASP.NET Core 8 · <code>http://localhost:38721</code></li>
        <li><strong>前端</strong> Vite Dev · <code>http://localhost:38720</code></li>
        <li><strong>Swagger</strong> <code>http://localhost:38721/swagger</code></li>
      </ul>

      <el-divider />

      <h3>下一步</h3>
      <p>
        阶段 1 起开始接入原 WPF 项目的 <code>Services/Modules/ProjectData</code> 业务代码，
        完成 SQLite schema + 数据导入工具；详见 <code>web/docs/迁移路线图.md</code>。
      </p>
    </el-card>
  </div>
</template>

<style scoped>
.home {
  max-width: 900px;
  margin: 0 auto;
}
.title {
  font-size: 22px;
  font-weight: 600;
  color: var(--tm-fg-primary);
  margin: 0 0 12px;
}
.lead {
  color: var(--tm-fg-secondary);
  line-height: 1.7;
  font-size: 14px;
}
h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--tm-fg-primary);
  margin: 0 0 8px;
}
.port-list {
  list-style: none;
  padding: 0;
  margin: 0;
  color: var(--tm-fg-secondary);
  line-height: 2;
  font-size: 13px;
}
.port-list code {
  background: var(--tm-bg-elevated);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}
</style>
