export const onboardingGuideSteps = [
    {
        id: 'ai-models',
        route: '/settings/ai-models',
        target: '[data-guide="ai-models"]',
        title: '第一步：配置并测试 AI 模型',
        description: '先进入 AI 模型，填写 OpenAI 兼容 Endpoint、模型名和 API Key，并用页面里的测试功能确认模型可用。',
        placement: 'right'
    },
    {
        id: 'work-context',
        route: '/',
        target: '[data-guide="work-context"]',
        title: '第二步：选择项目和分卷',
        description: '所有素材、计划和正文都会绑定到当前项目与分卷。生成前先确认这里选中了正确的写作上下文。',
        placement: 'bottom'
    },
    {
        id: 'novel-seed',
        route: '/generate/novel-seed',
        target: '[data-guide="novel-seed"]',
        title: '第三步：用 AI 开书生成基础素材',
        description: '通过一段小说描述生成世界观、角色、势力、地点、卷设计、章节计划和章节蓝图。',
        placement: 'right'
    },
    {
        id: 'planning',
        route: '/generate/chapter_plans',
        target: '[data-guide="chapter-plans"]',
        title: '第四步：检查章节计划和蓝图',
        description: '先检查章节顺序、标题、简介和核心事件。计划没问题，再进入正文生成会更稳。',
        placement: 'right'
    },
    {
        id: 'auto-generation',
        route: '/generate/chapters',
        target: '[data-guide="chapter-generation"]',
        title: '第五步：后台自动生成章节',
        description: '先预览标题和简介，确认不跑偏后启动后台任务。前台关闭后，任务也可以继续跑。',
        placement: 'right'
    },
    {
        id: 'editor',
        route: '/editor/chapters',
        target: '[data-guide="chapter-editor"]',
        title: '第六步：编辑和抽查正文',
        description: '批量生成后在这里查看、修改和保存章节，重点抽查承接、称呼、段落和标题是否一致。',
        placement: 'right'
    },
    {
        id: 'validation',
        route: '/validate',
        target: '[data-guide="validation"]',
        title: '第七步：校验并修订',
        description: '每生成一批章节后运行校验，按提示回到计划、蓝图、规则或正文里修正问题。',
        placement: 'right'
    }
];
