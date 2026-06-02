export const SUPPORTED_LOCALES = ['zh-CN', 'en'];
export const DEFAULT_LOCALE = 'zh-CN';
export const FALLBACK_LOCALE = 'en';
export const messages = {
    'zh-CN': {
        app: {
            title: '天命 Web'
        },
        routes: {
            home: '首页',
            health: '健康检查',
            aiTest: 'AI 流式测试',
            aiModels: 'AI 模型',
            themeStudio: '主题工坊',
            notificationCenter: '通知中心',
            chapterEditor: '章节编辑',
            designModules: '设计模块',
            generationWorkbench: '生成工作台',
            novelSeed: 'AI 开书',
            chapterGeneration: '章节生成',
            generationGate: '生成闸门',
            generationPlanning: '生成规划',
            editorWorkspace: '写作编辑器',
            validationWorkbench: '校验工作台',
            aiAssistant: 'AI 助手',
            login: '登录'
        },
        layout: {
            stageBadge: '设计 → 规划 → 打包 → 生成 → 校验',
            stageTag: '闭环',
            project: '项目',
            volume: '卷',
            notSelected: '未选择',
            themeStudio: '主题工坊',
            language: '语言',
            logout: '退出',
            followSystem: '跟随系统',
            scheduled: '定时切换',
            currentThemeAndSource: '{theme} / {source}',
            source: {
                preset: '手动主题',
                system: '系统主题',
                schedule: '定时主题',
                holiday: '节日主题',
                custom: '自定义主题'
            },
            messages: {
                selectProjectFirst: '请先选择项目。',
                projectNameRequired: '项目名称不能为空。',
                volumeTitleRequired: '卷标题不能为空。',
                projectCreated: '项目已创建。',
                projectCreateFailed: '创建项目失败。',
                volumeCreated: '卷已创建。',
                volumeCreateFailed: '创建卷失败。',
                logoutFailed: '退出登录失败。'
            },
            dialogs: {
                newProject: '新建项目',
                newVolume: '新建卷',
                name: '名称',
                summary: '简介',
                number: '编号',
                title: '标题',
                theme: '主题',
                confirm: '确认',
                cancel: '取消',
                create: '创建'
            },
            menu: {
                healthCheck: '健康检查',
                aiStreaming: 'AI 流式测试',
                generate: '生成',
                novelSeed: 'AI 开书',
                writerEditor: '写作编辑器',
                validation: '校验',
                worldRules: '世界规则',
                characterRules: '角色规则',
                factionRules: '势力规则',
                locationRules: '地点规则',
                plotRules: '剧情规则',
                creativeMaterials: '创意素材',
                bookAnalyses: '拆书分析',
                outlines: '大纲',
                volumeDesigns: '卷设计',
                chapterPlans: '章节计划',
                chapterBlueprints: '章节蓝图',
                workbench: '工作台',
                chapterDrafts: '章节草稿',
                generationGate: '生成闸门'
            },
            placeholders: {
                selectProject: '未选择',
                selectVolume: '未选择'
            },
            volumeOption: '第 {number} 卷 | {title}'
        },
        home: {
            eyebrow: '天命创作闭环',
            title: '设计 → 规划 → 打包 → 生成 → 校验',
            summary: '按原生天命 2.8.7 的推荐路线组织入口：先配置模型和拆书素材，再维护世界观、角色、势力、位置、剧情、大纲、分卷、章节和蓝图；修改设计或规划后必须重新打包，再进入创作台生成与校验。',
            quickActions: {
                aiModels: '模型配置',
                bookAnalyses: '智能拆书',
                creativeMaterials: '创意素材',
                outlines: '大纲设计',
                generationWorkbench: '创作规划',
                aiAssistant: '创作台 AI'
            },
            preview: {
                current: '当前：{theme}',
                mode: '模式：{mode}',
                source: '来源：{source}',
                holiday: '节日：{holiday}',
                next: '下一次：{next}',
                none: '无',
                notScheduled: '未安排',
                modeValue: {
                    preset: '手动主题',
                    system: '跟随系统',
                    schedule: '定时切换'
                },
                sourceValue: {
                    preset: '手动主题',
                    system: '系统主题',
                    schedule: '定时主题',
                    holiday: '节日主题',
                    custom: '自定义主题'
                }
            },
            sections: {
                currentFocus: '推荐路线',
                runtime: '运行环境'
            },
            focusItems: {
                step1: '模型配置 → 智能拆书 → 创意素材',
                step2: '世界观 / 角色 / 势力 / 位置 / 剧情规则',
                step3: '大纲设计 → 分卷设计 → 章节设计 → 蓝图设计',
                step4: '数据中心重新打包 → 章节预览 → Agent/Plan 生成 → 校验修复'
            },
            runtimeItems: {
                backend: '后端：{url}',
                frontend: '前端：{url}',
                swagger: 'Swagger：{url}',
                theme: '主题状态会持久化到本地存储。'
            }
        },
        health: {
            title: '健康检查',
            hint: '调用 GET /api/health 确认后端已在线，并返回版本号与时间戳信息。如果请求失败，请确认 API 正在 http://localhost:38721 运行。',
            action: '调用 /api/health',
            success: '后端健康检查成功',
            failure: '健康检查请求失败',
            labels: {
                status: '状态',
                version: '版本',
                env: '环境',
                time: '时间',
                timeUtc: 'UTC 时间'
            }
        },
        aiTest: {
            title: 'AI 流式测试',
            hint: '此页面会向 POST /api/ai/test-completion 发起请求，通过 SignalR ChatHub 接收流式 token，并在浏览器中实时渲染结果。',
            memoryOnly: 'API Key 仅在内存中使用，不会写入本地存储。',
            messages: {
                required: '请填写 endpoint、model 和 prompt；如果 API Key 留空，则会优先使用已选配置中保存的 Key。',
                signalrFailed: 'SignalR 连接失败：{message}',
                unknownError: '未知错误',
                requestFailed: '请求失败。',
                loadConfigsFailed: '加载 AI 配置失败。'
            },
            labels: {
                config: '已添加配置',
                configSummary: '当前配置',
                endpoint: 'Endpoint',
                apiKey: 'API Key',
                model: '模型',
                systemPrompt: '系统提示词',
                userPrompt: '用户提示词',
                temperature: '温度',
                maxTokens: '最大 Tokens',
                noSavedKey: '未显示已保存 Key'
            },
            placeholders: {
                endpoint: 'https://api.openai.com/v1',
                apiKey: 'sk-...',
                model: 'gpt-4o-mini / deepseek-chat / ...',
                systemPrompt: '可选的系统指令'
            },
            actions: {
                running: '运行中...',
                send: '发送请求',
                clear: '清空'
            },
            status: {
                label: '状态：{status}',
                chunks: '分块',
                chars: '字符',
                completed: '已完成',
                noOutput: '暂无输出'
            }
        },
        aiModels: {
            title: 'AI 平台配置',
            hint: '只维护实际要用的平台配置。新增时先选平台，再填写可选自定义 Endpoint 与 API Key，随后通过 /v1/models 拉取模型列表并选择目标模型。',
            provider: {
                title: '平台配置',
                empty: '还没有平台配置',
                selectedEmpty: '请先从左侧选择一个平台配置',
                disabled: '已禁用',
                create: '新增配置',
                edit: '编辑',
                delete: '删除'
            },
            config: {
                create: '新增平台配置',
                edit: '编辑平台配置',
                fields: {
                    platform: '平台',
                    endpoint: 'Endpoint',
                    model: '模型',
                    key: 'Key'
                },
                form: {
                    platform: '平台',
                    platformRequired: '请选择平台。',
                    name: '配置名称',
                    nameRequired: '请填写配置名称。',
                    endpoint: 'Endpoint',
                    endpointRequired: '请填写 Endpoint。',
                    apiKey: 'API Key',
                    keyRequired: '请填写 API Key。',
                    apiKeyName: 'Key 名称',
                    notes: '备注',
                    sortOrder: '排序',
                    enabled: '启用',
                    selectedModel: '已选模型',
                    modelRequired: '请先选择模型。'
                },
                placeholders: {
                    name: '例如：主账号 OpenAI',
                    keepExistingKey: '留空则保留现有 Key',
                    keyName: '例如：Default / Primary',
                    notes: '可选说明，例如账号用途、代理环境等',
                    searchModel: '搜索模型代码'
                },
                modelSection: {
                    title: '模型发现',
                    hint: '点击后由服务端请求当前 Endpoint 的 /v1/models，返回可用模型列表。',
                    fetch: '拉取模型'
                },
                empty: {
                    noKey: '未配置 Key',
                    noModel: '未选模型',
                    neverUsed: '尚未使用',
                    noDiscoveredModels: '还没有可选模型，请先拉取模型列表。'
                }
            },
            status: {
                enabled: '启用',
                disabled: '禁用'
            },
            actions: {
                new: '新建',
                edit: '编辑',
                delete: '删除',
                cancel: '取消',
                save: '保存',
                close: '关闭'
            },
            messages: {
                providersLoadFailed: '加载 Providers 失败。',
                providerCreated: 'Provider 已创建。',
                providerUpdated: 'Provider 已更新。',
                providerDeleted: 'Provider 已删除。',
                providerSaveFailed: '保存 Provider 失败。',
                providerDeleteFailed: '删除 Provider 失败。',
                providerDeleteConfirm: '删除 Provider “{name}”？相关模型和 API Keys 也会一并删除。',
                modelsDiscovered: '已拉取 {count} 个模型。',
                modelsDiscoverFailed: '拉取模型列表失败。'
            }
        },
        notifications: {
            title: '通知中心',
            eyebrow: '阶段 10',
            description: '浏览器通知链路已经作为阶段 10 的第一个检查点接入。此页面用于查看权限状态、发起授权请求，并在持久化收件箱完全落地前先验证测试通知流程。',
            statusCard: {
                title: '浏览器通知 API',
                support: '支持：{value}',
                lastAction: '最近动作：{value}',
                available: '可用',
                unavailable: '不可用'
            },
            permission: {
                title: '权限',
                canRequest: '当前浏览器可以请求通知权限。',
                unsupported: '当前浏览器不支持 Notification API。',
                refresh: '刷新状态',
                request: '请求权限'
            },
            delivery: {
                title: '测试投递',
                hint: '这里只会发送本地浏览器通知，目前不会额外写回后端。',
                send: '发送测试通知'
            },
            history: {
                title: '通知历史',
                empty: '暂无通知历史。',
                read: '已读',
                unread: '未读',
                markRead: '标记已读',
                markUnread: '标记未读',
                noBody: '没有正文。',
                noRoute: '无跳转路由'
            },
            permissionState: {
                granted: '已授权',
                denied: '已拒绝',
                unsupported: '不支持',
                default: '默认'
            },
            messages: {
                notRequested: '尚未请求。',
                loadFailed: '加载通知历史失败。',
                unsupported: '当前浏览器不支持 Notification API。',
                permissionFinished: '权限请求已完成，结果为“{result}”。',
                permissionFailed: '权限请求失败。',
                browserUnavailable: '当前浏览器无法使用通知功能。',
                grantFirst: '请先授予通知权限，再发送测试通知。',
                sendFailed: '发送通知失败。',
                updateFailed: '更新通知状态失败。',
                sentAt: '测试通知已发送，时间 {time}。',
                testTitle: '天命 Web 通知检查',
                testBody: '阶段 10 的浏览器通知接线已启用。'
            }
        },
        generationWorkbench: {
            eyebrow: '创作规划 / 正文配置',
            title: '创作规划工作台',
            subtitle: '对齐原生路线：大纲 → 分卷 → 章节 → 蓝图 → 数据中心打包 → 章节预览 → 创作台生成 → 校验。当前 Web 已接入规划、正文生成记录与闸门，打包和章节预览仍标记为待接入。',
            context: {
                project: '项目',
                volume: '卷',
                notSelected: '未选择',
                volumeLabel: '第 {number} 卷 / {title}'
            },
            cardStatus: {
                ready: '就绪',
                pending: '待处理'
            },
            cards: {
                outlines: {
                    title: '大纲',
                    desc: '定义故事范围、主题和顶层结构。'
                },
                volumes: {
                    title: '卷设计',
                    desc: '组织每卷目标、节奏和章节分配。'
                },
                chapterPlans: {
                    title: '章节计划',
                    desc: '起草目标结果、冲突节拍和交付点。'
                },
                blueprints: {
                    title: '章节蓝图',
                    desc: '准备每章的场景顺序、视角和必需细节。'
                },
                draftChapters: {
                    title: '创作台生成',
                    desc: '通过 Agent/Plan 触发正式章节生成、续写或重写。'
                },
                package: {
                    title: '数据中心打包',
                    desc: '把已启用的设计数据和创作规划编译为 AI 可读取的上下文包；原生流程要求修改后重新打包。'
                },
                preview: {
                    title: '章节预览',
                    desc: '写正文前检查打包后的章节树、实体引用、章节信息和蓝图信息。'
                },
                gate: {
                    title: '生成闸门',
                    desc: '复查生成记录、重试情况与闸门结果。'
                }
            }
        },
        generationGate: {
            stats: {
                totalRuns: '总运行数',
                firstPass: '首次通过',
                failures: '失败数',
                passRate: '通过率'
            },
            title: '生成记录',
            refresh: '刷新',
            emptyProject: '请先选择项目。',
            result: '结果',
            chapter: '章节',
            attempts: '尝试次数',
            rewrites: '重写次数',
            gateStages: '闸门阶段',
            startedAt: '开始时间',
            success: '成功',
            failed: '失败',
            none: '无',
            attempt: '尝试 {value}',
            gatePassed: '闸门通过',
            gateFailed: '闸门失败',
            unknownModel: '未知模型',
            chars: '字符',
            rawPayload: '原始尝试载荷',
            loadFailed: '加载生成闸门记录失败。'
        },
        validationWorkbench: {
            eyebrow: '阶段 5 / 校验',
            title: '校验工作台',
            subtitle: '对当前项目或卷运行一致性检查，查看校验摘要，并检查已持久化的事实快照。',
            currentTarget: '当前目标',
            projectScope: '项目范围',
            volumeScope: '第 {number} 卷',
            validatedAt: '校验时间',
            moduleResults: '模块结果',
            problemItems: '问题项',
            chapterDisplay: '第 {number} 章 / {title}',
            chapterOnly: '第 {number} 章',
            archiveTitle: '第 {number} 卷 / {time}',
            lastChapterId: '最后章节 ID',
            target: {
                noProjectSelected: '未选择项目',
                volume: '{project} / 第 {number} 卷 / {title}'
            },
            result: {
                passed: '通过',
                failed: '失败',
                warning: '警告'
            },
            chapterStatus: {
                planned: '待规划',
                blueprinted: '已蓝图',
                drafted: '已起草',
                needsFix: '待修复',
                validated: '已校验',
                archived: '已归档'
            },
            actions: {
                refresh: '刷新',
                runValidation: '运行校验',
                markNeedsFix: '标记待修复',
                markValidated: '标记已校验'
            },
            panels: {
                summaries: '校验摘要',
                reports: '章节报告',
                factOverview: '事实快照总览',
                trackingSummary: '追踪摘要',
                timeline: '时间线快照',
                archives: '卷归档'
            },
            empty: {
                summaries: '暂无校验摘要。',
                factOverview: '暂无事实快照。',
                trackingSummary: '暂无追踪摘要。',
                archives: '暂无归档。'
            },
            columns: {
                chapter: '章节',
                summary: '摘要',
                result: '结果',
                chapterStatus: '章节状态',
                validatedAt: '校验时间',
                actions: '操作',
                check: '检查项',
                details: '详情',
                suggestion: '建议',
                name: '名称',
                status: '状态',
                detail: '明细',
                importance: '重要性',
                timePeriod: '时间段',
                elapsed: '已过时间',
                keyEvent: '关键事件'
            },
            factOverview: {
                chapters: {
                    label: '章节数',
                    hint: '当前快照覆盖的章节'
                },
                characterStates: {
                    label: '角色状态',
                    hint: '{count} 个状态点'
                },
                characterRules: {
                    label: '角色规则',
                    hint: '设计中的角色规则'
                },
                conflictProgress: {
                    label: '冲突进展',
                    hint: '{count} 个进展点'
                },
                factionStates: {
                    label: '势力状态',
                    hint: '{count} 个状态点'
                },
                locationStates: {
                    label: '地点状态',
                    hint: '{count} 个状态点'
                },
                locationRules: {
                    label: '地点规则',
                    hint: '设计中的地点规则'
                },
                worldConstraints: {
                    label: '世界约束',
                    hint: '硬性规则与特殊法则'
                },
                characterLocations: {
                    label: '角色位置',
                    hint: '{count} 次移动'
                },
                itemStates: {
                    label: '物品状态',
                    hint: '{count} 个状态点'
                },
                foreshadowing: {
                    label: '伏笔',
                    hint: '{unresolved} 个未回收 / {overdue} 个逾期'
                },
                plotPoints: {
                    label: '情节点',
                    hint: '{count} 个时间线条目'
                },
                volumeArchives: {
                    label: '卷归档',
                    hint: '已归档的事实快照'
                }
            },
            messages: {
                loadFailed: '加载校验数据失败。',
                selectProjectFirst: '请先选择项目。',
                runSuccess: '校验已完成。',
                runFailed: '校验失败。',
                markNeedsFixReason: '已从校验报告标记为待跟进修复。',
                markValidatedReason: '已从校验报告标记为已校验。',
                markNeedsFixSuccess: '章节已标记为待修复。',
                markValidatedSuccess: '章节已标记为已校验。',
                updateStatusFailed: '更新章节状态失败。'
            }
        },
        themeStudio: {
            eyebrow: '阶段 9',
            title: '主题工坊',
            description: '完整主题系统，支持预设配色、跟随浏览器、定时切换、节日覆盖、图片取色和 AI 风格调色板生成。',
            source: {
                preset: '手动主题',
                system: '系统主题',
                schedule: '定时主题',
                holiday: '节日主题',
                custom: '自定义主题'
            },
            mode: {
                preset: { label: '预设', hint: '手动选择主题。' },
                system: { label: '系统', hint: '跟随浏览器浅色或深色偏好。' },
                schedule: { label: '定时', hint: '按时间或日出日落事件切换。' }
            },
            hero: {
                currentTheme: '当前主题',
                nextSwitch: '下一次切换',
                holiday: '节日',
                sunTimes: '日出日落',
                none: '无',
                notScheduled: '未安排'
            },
            paletteStats: {
                title: '配色统计',
                subtitle: '内置预设拆分'
            },
            presetStat: {
                total: '总数',
                light: '浅色',
                dark: '深色',
                seasonal: '季节',
                focus: '专注'
            },
            sections: {
                mode: { title: '模式', subtitle: '切换策略' },
                systemFollow: { title: '系统跟随', subtitle: '浏览器偏好：{value}' },
                presets: { title: '预设', subtitle: '{count} 个从桌面主题系统映射而来的内置配色' },
                schedule: { title: '定时', subtitle: '{value}' },
                holidayOverride: { title: '节日覆盖', subtitle: '可选的特殊日期主题' },
                upcomingHolidays: { title: '即将到来的节日', subtitle: '来自阶段 9 节日库' },
                generatedTheme: { title: '生成主题', subtitle: '图片提取与 AI 调色板' },
                liveTokens: { title: '实时 Tokens', subtitle: '当前解析后的主题色板' }
            },
            systemFollow: {
                lightMapping: '浅色映射',
                darkMapping: '深色映射'
            },
            presetFilter: {
                all: '全部',
                light: '浅色',
                dark: '深色',
                seasonal: '季节',
                focus: '专注'
            },
            schedule: {
                noNextSwitch: '还没有下一次切换',
                basis: '依据：{value}',
                day: '白天：{value}',
                night: '夜间：{value}',
                enable: '启用定时切换',
                useSunTimes: '使用日出日落',
                dayTheme: '白天主题',
                nightTheme: '夜间主题',
                sunriseAccent: '日出强调',
                sunsetAccent: '日落强调',
                dayStart: '白天开始',
                nightStart: '夜间开始',
                latitude: '纬度',
                longitude: '经度'
            },
            holiday: {
                enableOverride: '启用节日主题覆盖'
            },
            generated: {
                pickImage: '选择图片生成配色',
                seedPlaceholder: '种子词、题材、氛围……',
                generate: '生成',
                clearCustom: '清除自定义主题',
                dark: '深色',
                light: '浅色',
                imageGenerated: '已根据图片生成主题',
                imageFailed: '生成图片主题失败',
                aiGenerated: '已生成 AI 风格调色板'
            },
            token: {
                primary: '主色',
                background: '背景',
                surface: '表面',
                text: '文本',
                border: '边框',
                selection: '选区'
            },
            scheduleValue: {
                sunriseSunset: '日出 / 日落',
                fixedTime: '固定时间',
                dayStart: '白天开始',
                nightStart: '夜间开始',
                sunriseAccent: '日出强调',
                sunsetAccent: '日落强调',
                at: '{label} 于 {time}'
            },
            customSource: {
                image: '图片生成',
                ai: 'AI 生成'
            }
        },
        themePreset: {
            light: { label: '浅色', description: '干净的中性色工作区。' },
            green: { label: '纸感绿', description: '柔和对比的暖调阅读配色。' },
            dark: { label: '深色', description: '适合长时间使用的平衡深色界面。' },
            arctic: { label: '极地', description: '冰蓝色白天主题。' },
            forest: { label: '森林', description: '低疲劳的柔和绿色阅读配色。' },
            violet: { label: '紫罗兰', description: '柔和对比的明亮紫调。' },
            business: { label: '商务', description: '保守克制的办公中性色。' },
            minimalBlack: { label: '极简黑', description: '高克制高对比的深色主题。' },
            modernBlue: { label: '现代蓝', description: '偏产品感的深蓝界面。' },
            warmOrange: { label: '暖橙', description: '带编辑感对比的暖色米白主题。' },
            pink: { label: '粉色', description: '高可读性的柔和玫瑰配色。' },
            techCyan: { label: '科技青', description: '冷色科技风深色主题。' },
            sunset: { label: '晚霞', description: '温暖的黄昏主题。' },
            morandi: { label: '莫兰迪', description: '低饱和设计感配色。' },
            highContrast: { label: '高对比', description: '优先照顾可访问性的高对比主题。' }
        },
        holiday: {
            newYear2024: '2024 元旦',
            springFestival2024: '2024 春节',
            qingming2024: '2024 清明',
            labourDay2024: '2024 劳动节',
            dragonBoat2024: '2024 端午',
            midAutumn2024: '2024 中秋',
            nationalDay2024: '2024 国庆',
            newYear2025: '2025 元旦',
            springFestival2025: '2025 春节',
            qingming2025: '2025 清明',
            labourDay2025: '2025 劳动节',
            dragonBoat2025: '2025 端午',
            nationalDay2025: '2025 国庆',
            midAutumn2025: '2025 中秋',
            newYear: '元旦',
            valentines: '情人节',
            labourDay: '劳动节',
            childrenDay: '儿童节',
            nationalDay: '国庆节',
            halloween: '万圣节',
            christmasEve: '平安夜',
            christmas: '圣诞节',
            newYearEve: '跨年夜'
        },
        validation: {
            title: '校验工作台',
            eyebrow: '阶段 5 / 校验',
            subtitle: '对当前项目或卷运行一致性校验，查看校验摘要，并检查持久化的事实快照。',
            targetLabel: {
                none: '未选择项目',
                volume: '{project} / 第 {volume} 卷 / {title}'
            },
            actions: {
                refresh: '刷新',
                run: '运行校验',
                markNeedsFix: '标记待修复',
                markValidated: '标记已校验'
            },
            panels: {
                summaries: '校验摘要',
                reports: '章节报告',
                factOverview: '事实快照总览',
                trackingSummary: '追踪摘要',
                timeline: '时间线快照',
                archives: '卷归档'
            },
            empty: {
                summaries: '暂无校验摘要。',
                facts: '暂无事实快照。',
                tracking: '暂无追踪摘要。',
                archives: '暂无归档。'
            },
            labels: {
                currentTarget: '当前目标',
                projectScope: '项目范围',
                volume: '第 {value} 卷',
                validatedAt: '校验时间：{value}',
                moduleResults: '模块结果',
                problemItems: '问题项',
                chapter: '章节',
                summary: '摘要',
                result: '结果',
                chapterStatus: '章节状态',
                validatedAtColumn: '校验时间',
                actions: '操作',
                check: '检查项',
                details: '详情',
                suggestion: '建议',
                name: '名称',
                status: '状态',
                detail: '详情',
                importance: '重要性',
                chapterLabel: '章节 {value}',
                timePeriod: '时间段',
                elapsed: '经过时间',
                keyEvent: '关键事件',
                lastChapterId: '最后章节 ID：{value}',
                chapterReportTitle: '章节 {number} / {title}',
                overview: {
                    chapters: '章节',
                    chaptersHint: '当前快照覆盖',
                    characterStates: '角色状态',
                    characterStatesHint: '{count} 个状态点',
                    characterRules: '角色规则',
                    characterRulesHint: '设计角色规则',
                    conflictProgress: '冲突进度',
                    conflictProgressHint: '{count} 个进度点',
                    factionStates: '势力状态',
                    factionStatesHint: '{count} 个状态点',
                    locationStates: '地点状态',
                    locationStatesHint: '{count} 个状态点',
                    locationRules: '地点规则',
                    locationRulesHint: '设计地点规则',
                    worldConstraints: '世界约束',
                    worldConstraintsHint: '硬规则与特殊法则',
                    characterLocations: '角色位置',
                    characterLocationsHint: '{count} 次移动',
                    itemStates: '物品状态',
                    itemStatesHint: '{count} 个状态点',
                    foreshadowing: '伏笔',
                    foreshadowingHint: '{unresolved} 个未回收 / {overdue} 个超期',
                    plotPoints: '剧情点',
                    plotPointsHint: '{count} 个时间线项目',
                    volumeArchives: '卷归档',
                    volumeArchivesHint: '已归档事实快照'
                }
            },
            messages: {
                loadFailed: '加载校验数据失败。',
                selectProjectFirst: '请先选择项目。',
                completed: '校验完成。',
                failed: '校验失败。',
                markFollowUp: '已从校验报告标记为后续修复。',
                markValidated: '已从校验报告标记为已校验。',
                chapterMarkedNeedsFix: '章节已标记为待修复。',
                chapterMarkedValidated: '章节已标记为已校验。',
                updateChapterStatusFailed: '更新章节状态失败。'
            }
        },
        chapterGeneration: {
            messages: {
                loadChaptersFailed: '加载章节失败。',
                loadChapterDetailsFailed: '加载章节详情失败。',
                selectProjectVolumeFirst: '请先选择项目和卷。',
                chapterTitleRequired: '章节标题不能为空。',
                chapterCreated: '章节已创建。',
                createChapterFailed: '创建章节失败。',
                deleteConfirm: '删除章节 {number} / {title}？',
                chapterDeleted: '章节已删除。',
                deleteChapterFailed: '删除章节失败。',
                loadAiConfigFailed: '加载 AI 配置失败。',
                selectChapterFirst: '请先选择或创建章节。',
                endpointModelRequired: 'Endpoint 和 Model 必填。',
                selectConfigOrKeyFirst: '请先选择已保存配置，或手动填写 API Key。',
                promptRequired: 'Prompt 不能为空。',
                draftGenerated: '草稿已生成并保存到章节。',
                generationFailed: '生成失败。',
                draftSaved: '草稿已保存。',
                saveDraftFailed: '保存草稿失败。',
                firstChapterAlreadyExists: '当前卷已经有章节，不能再执行一键生成第一章。',
                validationRerunCompleted: '已根据最新正文自动重新运行校验。'
            },
            chapter: {
                panelTitle: '章节',
                refresh: '刷新',
                empty: '请先选择项目和卷。',
                create: '创建章节',
                number: '章节号',
                title: '标题',
                summary: '摘要',
                titlePlaceholder: '章节标题',
                summaryPlaceholder: '章节目标或摘要',
                tableTitle: '标题',
                tableStatus: '状态',
                header: '章节 {number} / {title}',
                draftFallback: '章节草稿',
                defaultFirstChapterTitle: '第一章 开局',
                autoTitle: '第 {number} 章'
            },
            actions: {
                saveDraft: '保存草稿',
                generateDraft: '生成草稿',
                generateFirstChapter: '一键生成第一章',
                refreshAiConfig: '刷新 AI 配置'
            },
            ai: {
                config: '已保存配置',
                apiKey: 'API Key',
                model: '模型',
                endpoint: 'Endpoint',
                systemPrompt: '系统提示词',
                prompt: 'Prompt',
                temperature: '温度',
                maxTokens: '最大 Tokens',
                maxRewrites: '最大重写次数',
                selectConfig: '选择已保存配置',
                autoRerunValidation: '修后自动复检',
                manualValidation: '手动复检',
                apiKeyPlaceholder: 'sk-...',
                modelPlaceholder: 'gpt-4o-mini / deepseek-chat / ...',
                endpointPlaceholder: 'https://api.openai.com/v1',
                outputPlaceholder: '生成的草稿内容会流式显示在这里。'
            },
            status: {
                record: '记录 {id}'
            },
            batch: {
                title: '自动连续生成',
                subtitle: '先确认标题和简介，再按章节号连续生成并自动保存。',
                start: '开始自动生成',
                preview: '生成标题简介',
                confirmStart: '确认并生成正文',
                stop: '停止',
                startNumber: '起始章',
                count: '生成章数',
                options: '选项',
                createMissing: '缺章节自动创建',
                overwriteExisting: '覆盖已有正文',
                stopOnFailure: '失败后停止',
                countRequired: '生成章数必须大于 0。',
                previewReady: '标题和简介已生成，请确认后再生成正文。',
                previewFailed: '生成标题和简介失败。',
                previewRequired: '请先生成并确认标题和简介。',
                previewTitle: '正文生成前确认',
                previewSubtitle: '可直接修改每章标题和简介；确认后后台会按这份清单生成正文。',
                refreshPreview: '重新生成',
                previewNumber: '章节',
                previewTitleColumn: '标题',
                previewSummaryColumn: '简介',
                previewState: '状态',
                previewNew: '新建',
                previewExists: '已有章节',
                previewHasContent: '已有正文',
                missingChapter: '第 {number} 章不存在，且未启用自动创建。',
                created: '已创建第 {number} 章：{title}',
                generated: '已生成第 {number} 章：{title}',
                skippedExisting: '已跳过第 {number} 章：{title}，已有正文。',
                failed: '第 {number} 章生成失败：{title}',
                queued: '后台任务已提交：{id}',
                queueFailed: '提交后台章节生成任务失败。',
                loadJobFailed: '加载后台章节生成任务失败。',
                cancelFailed: '取消后台章节生成任务失败。',
                jobId: '任务 {id}',
                stopRequested: '将在当前章节结束后停止自动生成。',
                stopped: '已停止自动生成。',
                completed: '自动生成完成：成功 {completed} 章，跳过 {skipped} 章，失败 {failed} 章。',
                progress: '成功 {completed} / 跳过 {skipped} / 失败 {failed} / 总计 {total}',
                current: '当前：第 {number} 章 / {title}',
                status: {
                    idle: '空闲',
                    queued: '排队中',
                    running: '后台运行中',
                    completed: '已完成',
                    failed: '已结束',
                    cancelled: '已取消'
                }
            }
        },
        aiAssistant: {
            title: 'AI 助手',
            mode: {
                agent: '代理',
                plan: '计划',
                edit: '编辑'
            },
            status: {
                pending: '等待中',
                running: '运行中',
                completed: '已完成',
                failed: '失败',
                cancelled: '已取消',
                unknown: '未知'
            },
            labels: {
                toolCall: '工具调用',
                executionTrace: '执行轨迹',
                executionTraceWithTools: '执行轨迹 / 工具调用',
                waitingToolDetails: '正在等待工具调用详情',
                arguments: '参数',
                result: '结果',
                error: '错误',
                rows: '{count} 行',
                steps: '{count} 步',
                completedSteps: '{count} 已完成',
                failedSteps: '{count} 失败',
                executionRequired: '需要执行',
                chapters: '章节 {start}-{end}',
                chapter: '章节 {value}',
                continue: '续写 {value}',
                rewrite: '重写 {value}'
            },
            normalization: {
                singleChapterMerged: '单章合并',
                chapterRangeSplit: '章节拆分',
                multiChapterPreserved: '多章保留'
            },
            directive: {
                continue: '续写',
                rewrite: '重写',
                default: '指令'
            },
            targetPanel: {
                ExecutionPlan: '执行计划',
                ExecutionPanel: '执行面板'
            },
            actions: {
                newSession: '新建会话',
                saveSettings: '保存设置',
                executePlan: '执行计划',
                send: '发送'
            },
            placeholders: {
                provider: 'Provider',
                key: 'Key',
                apiKey: 'API key',
                model: 'Model',
                sessionTitle: '会话标题',
                endpoint: 'Endpoint，例如 https://api.openai.com/v1',
                composer: '输入任务、计划请求，或需要编辑的文本……'
            },
            empty: {
                sessions: '还没有会话。',
                messages: '开始一段对话吧。',
                toolDetails: '已收到执行事件，等待工具详情中。'
            },
            messages: {
                loadSessionsFailed: '加载会话失败。',
                createSessionFailed: '创建会话失败。',
                saveSessionSuccess: '会话设置已保存。',
                saveSessionFailed: '保存会话设置失败。',
                deleteConfirm: '删除会话“{title}”？',
                deleteFailed: '删除会话失败。',
                enterMessage: '请先输入消息。',
                endpointModelRequired: 'Endpoint 和 Model 必填。',
                selectProviderFirst: '请先选择 Provider。',
                tempKeyRequired: '请输入临时 API Key。',
                sendFailed: '发送消息失败。',
                executingAnother: '已有其他执行任务进行中。',
                executeFinishedWithFailures: '计划执行结束，但包含失败步骤。',
                executeCompleted: '计划执行完成。',
                executeFailed: '执行计划失败。'
            },
            switch: {
                savedKey: '已保存 Key',
                temporaryKey: '临时 Key'
            },
            thinking: '思考'
        },
        design: {
            modules: {
                world_rules: '世界规则',
                character_rules: '角色规则',
                faction_rules: '势力规则',
                location_rules: '地点规则',
                plot_rules: '剧情规则',
                creative_materials: '创意素材',
                book_analyses: '拆书分析',
                outlines: '大纲',
                volume_designs: '卷设计',
                chapter_plans: '章节计划',
                chapter_blueprints: '章节蓝图'
            },
            labels: {
                sourceBook: '来源书',
                all: '全部',
                new: '新建',
                setProjectDefault: '设为项目默认',
                categories: '{module} 分类',
                allUncategorized: '全部 / 未分类',
                noCategories: '暂无分类',
                builtIn: '内置',
                records: '{module} 记录',
                crawlImport: '导入拆书',
                searchByName: '按名称搜索',
                category: '分类',
                enabled: '启用',
                disabled: '禁用',
                updatedFrom: '更新开始',
                updatedTo: '更新结束',
                onlyUncategorized: '仅未分类',
                status: '状态',
                updated: '更新时间',
                actions: '操作',
                edit: '编辑',
                delete: '删除',
                total: '共 {count} 条',
                on: '开启',
                off: '关闭',
                noRecordsInModule: '{module} 中暂无记录',
                newCategory: '新建分类',
                editCategory: '编辑分类',
                name: '名称',
                parent: '父级',
                rootCategory: '根分类',
                sort: '排序',
                save: '保存',
                cancel: '取消',
                categoryId: '分类 ID',
                sourceBookId: '来源书 ID',
                notBound: '未绑定',
                globalScope: '全局范围',
                newSourceBook: '新建来源书',
                create: '创建',
                crawlImportTitle: '导入拆书分析',
                bookDetailUrl: '书籍详情页 URL，或上传本地 TXT',
                preview: '预览',
                uploadTxt: '上传 TXT',
                uploadTxtHint: '支持本地 .txt 小说文本，会按章节标题拆分并生成草稿预览。',
                enterUrlPreviewApply: '输入 URL 或上传 TXT，预览结果后再应用到表单。',
                sourceUrl: '来源 URL',
                title: '标题',
                site: '站点',
                author: '作者',
                previewSummary: '预览摘要',
                sampleChapters: '示例章节：{count}',
                chapterCount: '章节数：{count}',
                totalWords: '总字数：{count}',
                summary: '摘要',
                noSummary: '暂无摘要',
                mappedDraftFields: '映射后的草稿字段',
                localTxtBook: '本地 TXT 小说',
                localTxtFile: '本地 TXT',
                txtAnalysisPlaceholder: '已从本地 TXT 导入原文，请在拆书分析中继续补充世界观、角色与剧情拆解。',
                fullText: '全文',
                aiAnalysis: 'AI 拆书分析',
                aiProviderConfig: 'AI 配置',
                aiProvider: 'Provider',
                aiKeyAuto: 'Key（可自动轮换）',
                aiModel: '模型',
                aiEndpoint: 'Endpoint',
                runAiAnalysis: 'AI 分析',
                generateCreativeMaterial: '生成创意素材',
                buildSkeleton: '建立骨架',
                aiStatus: 'AI 状态',
                aiIdle: '未运行',
                aiQueued: '排队中',
                aiRunning: '分析中',
                aiCompleted: '已完成',
                aiFailed: '失败',
                aiFailureReason: '失败原因',
                aiFailureUnknown: 'AI 分析失败，未返回具体原因。',
                aiAnalysisHint: '先上传 TXT 或预览 URL，再点击 AI 分析；完成后会自动回填世界观、角色与剧情字段。',
                na: 'N/A',
                close: '关闭',
                applyToCurrent: '应用到当前',
                newDraft: '新建草稿',
                webBookAnalysis: '网页拆书分析'
            },
            messages: {
                missingReferences: '缺失引用：{value}',
                currentValueMissing: '当前值“{value}”不在可用选项中。',
                removedInvalidReferences: '已移除 {count} 个无效引用。',
                invalidReferenceCleared: '已清除无效引用。',
                referencesStillInvalid: '引用已刷新，但仍有部分值无效。',
                referencesRefreshed: '引用已刷新。',
                refreshReferencesFailed: '刷新引用失败。',
                loadSourceBooksFailed: '加载来源书失败。',
                sourceBookNameRequired: '来源书名称不能为空。',
                sourceBookCreated: '来源书已创建。',
                createSourceBookFailed: '创建来源书失败。',
                selectProjectFirst: '请先选择项目。',
                bindSourceBookSuccess: '项目默认来源书已更新。',
                bindSourceBookFailed: '绑定来源书失败。',
                loadCategoriesFailed: '加载分类失败。',
                categoryCreated: '分类已创建。',
                categoryUpdated: '分类已更新。',
                saveCategoryFailed: '保存分类失败。',
                builtInCategoriesCannotDelete: '内置分类不可删除。',
                deleteCategoryConfirm: '删除分类“{name}”？',
                categoryDeleted: '分类已删除。',
                deleteCategoryFailed: '删除分类失败。',
                saveCategoryOrderFailed: '保存分类排序失败。',
                loadRecordsFailed: '加载记录失败。',
                loadRecordDetailFailed: '加载记录详情失败。',
                nameRequired: '名称不能为空。',
                recordCreated: '记录已创建。',
                recordUpdated: '记录已更新。',
                saveRecordFailed: '保存记录失败。',
                deleteRecordConfirm: '删除“{name}”？',
                recordDeleted: '记录已删除。',
                deleteRecordFailed: '删除记录失败。',
                sourceUrlRequired: '来源 URL 不能为空。',
                previewLoaded: '预览已加载。',
                crawlPreviewFailed: '抓取预览失败。',
                txtImportLoaded: 'TXT 已读取并生成预览。',
                txtImportFailed: 'TXT 读取失败。',
                previewRequiredForAi: '请先上传 TXT 或预览 URL。',
                aiConfigRequired: '请先选择 Provider、模型并填写 Endpoint。',
                aiAnalysisCompleted: 'AI 分析已完成并回填预览。',
                aiAnalysisFailed: 'AI 分析失败。',
                previewApplied: '预览已应用到表单。',
                creativeMaterialCreatedFromBookAnalysis: '已根据拆书生成创意素材：{name}',
                createCreativeMaterialFromBookAnalysisFailed: '根据拆书生成创意素材失败。',
                skeletonBuilt: '骨架已建立：五大规则 {rules} 条，大纲 {outlines} 条，分卷 {volumes} 条，章节 {chapters} 条，蓝图 {blueprints} 条。',
                skeletonBuildFailed: '建立骨架失败。',
                backgroundAiQueued: '后台 AI 分析已加入队列，可继续当前操作。',
                backgroundAiQueueFailed: '加入后台 AI 分析队列失败。',
                backgroundAiAlreadyRunning: '该记录已有后台 AI 分析任务正在执行。'
            }
        },
        editor: {
            actions: {
                refresh: '刷新',
                runRecall: '执行召回',
                saveContent: '保存正文',
                restoreVersion: '恢复到该版本'
            },
            tabs: {
                write: '正文编辑',
                preview: '预览',
                recall: '召回结果',
                history: '历史版本',
                diff: '版本对比'
            },
            labels: {
                chapterList: '章节列表',
                chapterNumber: '第 {number} 章',
                chapterTitle: '第 {number} 章 · {title}',
                volumeNumber: '第 {number} 卷',
                wordCount: '{count} 字',
                recallQuerySource: '查询来源：{source}',
                manualInput: '手动输入',
                score: '评分 {score}',
                current: '当前',
                currentVersionSuffix: '（当前）',
                unknownTime: '未知时间',
                sizeBytes: '{size} 字节',
                sizeKilobytes: '{size} KB',
                sizeMegabytes: '{size} MB'
            },
            placeholders: {
                filterBySourceBook: '按来源书筛选',
                searchKeyword: '搜索章节标题或摘要',
                recallQuery: '可选：自定义召回查询',
                editorContent: '在这里编辑章节正文，支持 Markdown。',
                selectVersion: '选择版本',
                selectDiffBaseVersion: '选择对比基准版本'
            },
            hints: {
                monacoFallback: 'Monaco 未加载，已回退为文本框',
                markdownFallback: '使用基础 Markdown 预览',
                diffBaseVsCurrent: '左侧为基准版本，右侧为当前编辑内容',
                diffFallback: '未加载 diff2html，当前使用轻量行级对比。',
                diffEnhanced: '已加载 diff2html，当前显示双栏差异。'
            },
            empty: {
                noSummary: '暂无摘要',
                noChapterSelected: '未选择章节',
                selectChapterFirst: '请先从左侧选择章节',
                noRecallResults: '尚未执行召回',
                noVersions: '暂无历史版本',
                noVersionSelected: '未选择版本',
                noVersionContent: '暂无版本内容',
                noDiff: '当前编辑内容与基准版本没有差异'
            },
            messages: {
                loadSourceBooksFailed: '加载来源书失败。',
                loadChaptersFailed: '加载章节失败。',
                loadChapterDetailFailed: '加载章节详情失败。',
                loadVersionsFailed: '加载版本历史失败。',
                loadVersionDetailFailed: '加载版本内容失败。',
                contentSaved: '章节内容已保存。',
                saveContentFailed: '保存章节内容失败。',
                versionRestored: '已恢复到所选版本。',
                restoreVersionFailed: '恢复版本失败。',
                loadRecallFailed: '加载召回结果失败。'
            }
        },
        editorWorkspace: {
            title: '写作编辑器',
            eyebrow: '阶段 7 / 编辑器',
            labels: {
                noProjectSelected: '未选择项目',
                volume: '第 {number} 卷',
                refresh: '刷新',
                save: '保存',
                chapters: '章节',
                noChapters: '暂无章节。',
                chapterTitle: '第 {number} 章 / {title}',
                unknown: '未知',
                chars: '{count} 字',
                updatedAt: '更新于 {time}',
                unsaved: '未保存',
                editorIndex: '编辑器索引',
                indexedChapters: '已索引章节',
                keywords: '关键词',
                staleChapters: '待更新章节',
                lastBuilt: '上次构建：{time}',
                refreshStatus: '刷新状态',
                rebuildIndex: '重建索引',
                vectorRecall: '向量召回',
                context: '上下文',
                insert: '插入',
                noQuery: '无查询',
                status: {
                    ready: '就绪',
                    empty: '空',
                    building: '构建中',
                    stale: '需更新',
                    failed: '失败',
                    planned: '已规划',
                    drafted: '草稿',
                    validated: '已校验',
                    needs_fix: '需修订'
                }
            },
            placeholders: {
                searchCurrentChapter: '搜索当前章节',
                replacementText: '替换文本',
                editorContent: '在这里编写章节正文……',
                recallQuery: '输入人物、地点、线索或世界规则'
            },
            actions: {
                prev: '上一个',
                next: '下一个',
                replace: '替换',
                replaceAll: '全部替换',
                searchRecall: '搜索召回'
            },
            empty: {
                selectProjectFirst: '请先选择项目。',
                selectChapterToEdit: '选择章节后开始编辑。',
                noRelatedContext: '搜索项目上下文，召回相关内容。'
            },
            messages: {
                enterSearchText: '请输入要搜索的文本。',
                noMatchesFound: '当前章节中没有匹配结果。',
                noMatchesToReplace: '没有可替换的匹配项。',
                replacedMatches: '已替换 {count} 处匹配。',
                recallSnippetInserted: '召回片段已插入。',
                loadIndexStatusFailed: '加载索引状态失败。',
                selectProjectFirst: '请先选择项目。',
                indexRebuilt: '编辑器索引已重建。',
                rebuildIndexFailed: '重建编辑器索引失败。',
                loadChaptersFailed: '加载章节失败。',
                loadChapterDetailsFailed: '加载章节详情失败。',
                selectChapterFirst: '请先选择章节。',
                contentSaved: '章节内容已保存。',
                saveContentFailed: '保存章节内容失败。',
                enterRecallKeywords: '请输入召回关键词。',
                noRelatedContextFound: '未找到相关上下文。',
                vectorRecallFailed: '向量召回失败。'
            }
        }
    },
    en: {
        app: {
            title: 'TM Web'
        },
        routes: {
            home: 'Home',
            health: 'Health Check',
            aiTest: 'AI Streaming Test',
            aiModels: 'AI Models',
            themeStudio: 'Theme Studio',
            notificationCenter: 'Notification Center',
            chapterEditor: 'Chapter Editor',
            designModules: 'Design Modules',
            generationWorkbench: 'Generation Workbench',
            novelSeed: 'Novel Seed',
            chapterGeneration: 'Chapter Generation',
            generationGate: 'Generation Gate',
            generationPlanning: 'Generation Planning',
            editorWorkspace: 'Editor Workspace',
            validationWorkbench: 'Validation Workbench',
            aiAssistant: 'AI Assistant',
            login: 'Login'
        },
        layout: {
            stageBadge: 'Design → Plan → Package → Generate → Validate',
            stageTag: 'Loop',
            project: 'Project',
            volume: 'Volume',
            notSelected: 'Not selected',
            themeStudio: 'Theme Studio',
            logout: 'Logout',
            language: 'Language',
            followSystem: 'Follow System',
            scheduled: 'Scheduled',
            currentThemeAndSource: '{theme} / {source}',
            source: {
                preset: 'Preset Theme',
                system: 'System Theme',
                schedule: 'Scheduled Theme',
                holiday: 'Holiday Theme',
                custom: 'Custom Theme'
            },
            messages: {
                selectProjectFirst: 'Select a project first.',
                projectNameRequired: 'Project name is required.',
                volumeTitleRequired: 'Volume title is required.',
                projectCreated: 'Project created.',
                projectCreateFailed: 'Failed to create project.',
                volumeCreated: 'Volume created.',
                volumeCreateFailed: 'Failed to create volume.',
                logoutFailed: 'Failed to logout.'
            },
            dialogs: {
                newProject: 'New Project',
                newVolume: 'New Volume',
                name: 'Name',
                summary: 'Summary',
                number: 'Number',
                title: 'Title',
                theme: 'Theme',
                confirm: 'Confirm',
                cancel: 'Cancel',
                create: 'Create'
            },
            menu: {
                healthCheck: 'Health Check',
                aiStreaming: 'AI Streaming',
                generate: 'Generate',
                novelSeed: 'Novel Seed',
                writerEditor: 'Writer Editor',
                validation: 'Validation',
                worldRules: 'World Rules',
                characterRules: 'Character Rules',
                factionRules: 'Faction Rules',
                locationRules: 'Location Rules',
                plotRules: 'Plot Rules',
                creativeMaterials: 'Creative Materials',
                bookAnalyses: 'Book Analyses',
                outlines: 'Outlines',
                volumeDesigns: 'Volume Designs',
                chapterPlans: 'Chapter Plans',
                chapterBlueprints: 'Chapter Blueprints',
                workbench: 'Workbench',
                chapterDrafts: 'Chapter Drafts',
                generationGate: 'Generation Gate'
            },
            placeholders: {
                selectProject: 'Not selected',
                selectVolume: 'Not selected'
            },
            volumeOption: 'Vol {number} | {title}'
        },
        home: {
            eyebrow: 'TM Creation Loop',
            title: 'Design → Plan → Package → Generate → Validate',
            summary: 'Entrypoints now follow the native TM 2.8.7 route: configure models and source analysis, maintain design rules and writing plans, repackage changed data, then generate and validate in the writing workspace.',
            quickActions: {
                aiModels: 'Model Setup',
                bookAnalyses: 'Book Analysis',
                creativeMaterials: 'Creative Materials',
                outlines: 'Outline Design',
                generationWorkbench: 'Writing Plans',
                aiAssistant: 'Writing AI'
            },
            preview: {
                current: 'Current: {theme}',
                mode: 'Mode: {mode}',
                source: 'Source: {source}',
                holiday: 'Holiday: {holiday}',
                next: 'Next: {next}',
                none: 'None',
                notScheduled: 'Not scheduled',
                modeValue: {
                    preset: 'Preset Theme',
                    system: 'Follow System',
                    schedule: 'Scheduled'
                },
                sourceValue: {
                    preset: 'Preset Theme',
                    system: 'System Theme',
                    schedule: 'Scheduled Theme',
                    holiday: 'Holiday Theme',
                    custom: 'Custom Theme'
                }
            },
            sections: {
                currentFocus: 'Recommended Route',
                runtime: 'Runtime'
            },
            focusItems: {
                step1: 'Model setup → book analysis → creative materials',
                step2: 'World / character / faction / location / plot rules',
                step3: 'Outline → volume design → chapter plan → blueprint',
                step4: 'Data center package → chapter preview → Agent/Plan generation → validation fixes'
            },
            runtimeItems: {
                backend: 'Backend: {url}',
                frontend: 'Frontend: {url}',
                swagger: 'Swagger: {url}',
                theme: 'Theme state persists in local storage.'
            }
        },
        health: {
            title: 'Health Check',
            hint: 'Call GET /api/health to confirm the backend is online and returning version plus timestamp data. If the request fails, verify the API is running on http://localhost:38721.',
            action: 'Call /api/health',
            success: 'Backend health check succeeded',
            failure: 'Health request failed',
            labels: {
                status: 'Status',
                version: 'Version',
                env: 'Env',
                time: 'Time',
                timeUtc: 'UTC Time'
            }
        },
        aiTest: {
            title: 'AI Streaming Test',
            hint: 'This page sends a request to POST /api/ai/test-completion, receives streamed tokens through SignalR ChatHub, and renders the result live in the browser.',
            memoryOnly: 'The API key is used in memory only and is not written to local storage.',
            messages: {
                required: 'Please provide endpoint, API key, model, and prompt.',
                signalrFailed: 'SignalR connection failed: {message}',
                unknownError: 'Unknown error',
                requestFailed: 'Request failed.',
                loadConfigsFailed: 'Failed to load AI configs.'
            },
            labels: {
                config: 'Saved Config',
                configSummary: 'Selected Config',
                endpoint: 'Endpoint',
                apiKey: 'API Key',
                model: 'Model',
                systemPrompt: 'System Prompt',
                userPrompt: 'User Prompt',
                temperature: 'Temperature',
                maxTokens: 'Max Tokens',
                noSavedKey: 'Saved key hidden'
            },
            placeholders: {
                endpoint: 'https://api.openai.com/v1',
                apiKey: 'sk-...',
                model: 'gpt-4o-mini / deepseek-chat / ...',
                systemPrompt: 'Optional system instruction'
            },
            actions: {
                running: 'Running...',
                send: 'Send Request',
                clear: 'Clear'
            },
            status: {
                label: 'Status: {status}',
                chunks: 'chunks',
                chars: 'chars',
                completed: 'completed',
                noOutput: 'No output yet'
            }
        },
        aiModels: {
            title: 'AI Platform Configs',
            hint: 'Only maintain the platform configs you actually use. Create a config by selecting a platform, optionally overriding the endpoint and API key, then fetch models from /v1/models and choose one.',
            provider: {
                title: 'Platform Configs',
                empty: 'No platform configs yet',
                selectedEmpty: 'Select a platform config from the left first',
                disabled: 'Disabled',
                create: 'New Config',
                edit: 'Edit',
                delete: 'Delete'
            },
            config: {
                create: 'New Platform Config',
                edit: 'Edit Platform Config',
                fields: {
                    platform: 'Platform',
                    endpoint: 'Endpoint',
                    model: 'Model',
                    key: 'Key'
                },
                form: {
                    platform: 'Platform',
                    platformRequired: 'Please select a platform.',
                    name: 'Config Name',
                    nameRequired: 'Please enter a config name.',
                    endpoint: 'Endpoint',
                    endpointRequired: 'Please enter an endpoint.',
                    apiKey: 'API Key',
                    keyRequired: 'Please enter an API key.',
                    apiKeyName: 'Key Name',
                    notes: 'Notes',
                    sortOrder: 'Sort Order',
                    enabled: 'Enabled',
                    selectedModel: 'Selected Model',
                    modelRequired: 'Please choose a model first.'
                },
                placeholders: {
                    name: 'For example: Main OpenAI Account',
                    keepExistingKey: 'Leave blank to keep the existing key',
                    keyName: 'For example: Default / Primary',
                    notes: 'Optional notes such as account purpose or proxy environment',
                    searchModel: 'Search model code'
                },
                modelSection: {
                    title: 'Model Discovery',
                    hint: 'The server requests /v1/models from the current endpoint and returns available models.',
                    fetch: 'Fetch Models'
                },
                empty: {
                    noKey: 'No key configured',
                    noModel: 'No model selected',
                    neverUsed: 'Never used',
                    noDiscoveredModels: 'No models yet. Fetch the model list first.'
                }
            },
            status: {
                enabled: 'Enabled',
                disabled: 'Disabled'
            },
            actions: {
                new: 'New',
                edit: 'Edit',
                delete: 'Delete',
                cancel: 'Cancel',
                save: 'Save',
                close: 'Close'
            },
            messages: {
                providersLoadFailed: 'Failed to load providers.',
                providerCreated: 'Provider created.',
                providerUpdated: 'Provider updated.',
                providerDeleted: 'Provider deleted.',
                providerSaveFailed: 'Failed to save provider.',
                providerDeleteFailed: 'Failed to delete provider.',
                providerDeleteConfirm: 'Delete provider "{name}"? Related models and API keys will be removed as well.',
                modelsDiscovered: '{count} models fetched.',
                modelsDiscoverFailed: 'Failed to fetch model list.'
            }
        },
        notifications: {
            title: 'Notification Center',
            eyebrow: 'Stage 10',
            description: 'Browser notification wiring is now available as the first Stage 10 checkpoint. This page exposes permission state, permission requests, and a test notification path before the persistent inbox fully lands.',
            statusCard: {
                title: 'Browser Notification API',
                support: 'Support: {value}',
                lastAction: 'Last action: {value}',
                available: 'Available',
                unavailable: 'Unavailable'
            },
            permission: {
                title: 'Permission',
                canRequest: 'The browser can request notification permission.',
                unsupported: 'Notification API is not available in this browser.',
                refresh: 'Refresh Status',
                request: 'Request Permission'
            },
            delivery: {
                title: 'Test Delivery',
                hint: 'Sends a local browser notification only. This does not persist to the backend yet.',
                send: 'Send Test Notification'
            },
            history: {
                title: 'Notification History',
                empty: 'No notification history yet.',
                read: 'Read',
                unread: 'Unread',
                markRead: 'Mark Read',
                markUnread: 'Mark Unread',
                noBody: 'No body text.',
                noRoute: 'No route'
            },
            permissionState: {
                granted: 'Granted',
                denied: 'Denied',
                unsupported: 'Unsupported',
                default: 'Default'
            },
            messages: {
                notRequested: 'Not requested yet.',
                loadFailed: 'Unable to load notification history.',
                unsupported: 'This browser does not support the Notification API.',
                permissionFinished: 'Permission request finished with "{result}".',
                permissionFailed: 'Permission request failed.',
                browserUnavailable: 'Notifications are not available in this browser.',
                grantFirst: 'Grant notification permission before sending a test notification.',
                sendFailed: 'Unable to send a notification.',
                updateFailed: 'Unable to update notification state.',
                sentAt: 'Test notification sent at {time}.',
                testTitle: 'TM Web Notification Check',
                testBody: 'Stage 10 browser notification wiring is active.'
            }
        },
        generationWorkbench: {
            eyebrow: 'Writing Plans / Content Config',
            title: 'Writing Plan Workbench',
            subtitle: 'Native route: outline → volumes → chapters → blueprints → data-center packaging → chapter preview → writing AI generation → validation. Web currently wires planning, generation records, and gates; packaging and chapter preview are marked pending.',
            actions: {
                packageNow: 'Package Now'
            },
            labels: {
                packageVersion: 'Package version: v{value}',
                packageFiles: 'Context files: {value}',
                packageModules: 'Enabled modules: {value}',
                packageTime: 'Packaged at: {value}'
            },
            empty: {
                package: 'No package snapshot yet.'
            },
            messages: {
                selectProjectFirst: 'Select a project first.',
                packageSuccess: 'Packaging completed: v{version}, {files} context files.',
                packageFailed: 'Packaging failed.'
            },
            context: {
                project: 'Project',
                volume: 'Volume',
                notSelected: 'Not selected',
                volumeLabel: 'Volume {number} / {title}'
            },
            cardStatus: {
                ready: 'Ready',
                pending: 'Pending'
            },
            cards: {
                outlines: {
                    title: 'Outlines',
                    desc: 'Define story scope, themes, and the top-level structure.'
                },
                volumes: {
                    title: 'Volumes',
                    desc: 'Organize volume goals, pacing, and chapter allocation.'
                },
                chapterPlans: {
                    title: 'Chapter Plans',
                    desc: 'Draft target outcomes, conflict beats, and delivery points.'
                },
                blueprints: {
                    title: 'Blueprints',
                    desc: 'Prepare scene order, POV, and required details per chapter.'
                },
                draftChapters: {
                    title: 'Writing AI Generation',
                    desc: 'Trigger formal chapter generation, continuation, or rewrite through Agent/Plan.'
                },
                package: {
                    title: 'Data Center Package',
                    desc: 'Compile enabled design data and writing plans into the context package read by AI; native flow requires repackaging after changes.'
                },
                preview: {
                    title: 'Chapter Preview',
                    desc: 'Check packaged chapter tree, entity references, chapter information, and blueprint data before writing prose.'
                },
                gate: {
                    title: 'Generation Gate',
                    desc: 'Review generation records, retries, and gate outcomes.'
                }
            }
        },
        generationGate: {
            stats: {
                totalRuns: 'Total Runs',
                firstPass: 'First Pass',
                failures: 'Failures',
                passRate: 'Pass Rate'
            },
            title: 'Generation Records',
            refresh: 'Refresh',
            emptyProject: 'Select a project first.',
            result: 'Result',
            chapter: 'Chapter',
            attempts: 'Attempts',
            rewrites: 'Rewrites',
            gateStages: 'Gate Stages',
            startedAt: 'Started At',
            success: 'Success',
            failed: 'Failed',
            none: 'None',
            attempt: 'Attempt {value}',
            gatePassed: 'Gate Passed',
            gateFailed: 'Gate Failed',
            unknownModel: 'Unknown model',
            chars: 'chars',
            rawPayload: 'Raw Attempt Payload',
            loadFailed: 'Failed to load generation gate records.'
        },
        validationWorkbench: {
            eyebrow: 'Stage 5 / Validation',
            title: 'Validation Workbench',
            subtitle: 'Run consistency checks for the current project or volume, review validation summaries, and inspect the persisted fact snapshot.',
            currentTarget: 'Current Target',
            projectScope: 'Project Scope',
            volumeScope: 'Volume {number}',
            validatedAt: 'Validated At',
            moduleResults: 'Module Results',
            problemItems: 'Problem Items',
            chapterDisplay: 'Chapter {number} / {title}',
            chapterOnly: 'Chapter {number}',
            archiveTitle: 'Volume {number} / {time}',
            lastChapterId: 'Last Chapter ID',
            target: {
                noProjectSelected: 'No project selected',
                volume: '{project} / Volume {number} / {title}'
            },
            result: {
                passed: 'Passed',
                failed: 'Failed',
                warning: 'Warning'
            },
            chapterStatus: {
                planned: 'Planned',
                blueprinted: 'Blueprinted',
                drafted: 'Drafted',
                needsFix: 'Needs Fix',
                validated: 'Validated',
                archived: 'Archived'
            },
            actions: {
                refresh: 'Refresh',
                runValidation: 'Run Validation',
                markNeedsFix: 'Mark Needs Fix',
                markValidated: 'Mark Validated'
            },
            panels: {
                summaries: 'Validation Summaries',
                reports: 'Chapter Reports',
                factOverview: 'Fact Snapshot Overview',
                trackingSummary: 'Tracking Summary',
                timeline: 'Timeline Snapshot',
                archives: 'Volume Archives'
            },
            empty: {
                summaries: 'No validation summaries yet.',
                factOverview: 'No fact snapshot available.',
                trackingSummary: 'No tracking summary available.',
                archives: 'No archives yet.'
            },
            columns: {
                chapter: 'Chapter',
                summary: 'Summary',
                result: 'Result',
                chapterStatus: 'Chapter Status',
                validatedAt: 'Validated At',
                actions: 'Actions',
                check: 'Check',
                details: 'Details',
                suggestion: 'Suggestion',
                name: 'Name',
                status: 'Status',
                detail: 'Detail',
                importance: 'Importance',
                timePeriod: 'Time Period',
                elapsed: 'Elapsed',
                keyEvent: 'Key Event'
            },
            factOverview: {
                chapters: {
                    label: 'Chapters',
                    hint: 'Covered in the current snapshot'
                },
                characterStates: {
                    label: 'Character States',
                    hint: '{count} state points'
                },
                characterRules: {
                    label: 'Character Rules',
                    hint: 'Design character rules'
                },
                conflictProgress: {
                    label: 'Conflict Progress',
                    hint: '{count} progress points'
                },
                factionStates: {
                    label: 'Faction States',
                    hint: '{count} state points'
                },
                locationStates: {
                    label: 'Location States',
                    hint: '{count} state points'
                },
                locationRules: {
                    label: 'Location Rules',
                    hint: 'Design location rules'
                },
                worldConstraints: {
                    label: 'World Constraints',
                    hint: 'Hard rules and special laws'
                },
                characterLocations: {
                    label: 'Character Locations',
                    hint: '{count} movements'
                },
                itemStates: {
                    label: 'Item States',
                    hint: '{count} state points'
                },
                foreshadowing: {
                    label: 'Foreshadowing',
                    hint: '{unresolved} unresolved / {overdue} overdue'
                },
                plotPoints: {
                    label: 'Plot Points',
                    hint: '{count} timeline items'
                },
                volumeArchives: {
                    label: 'Volume Archives',
                    hint: 'Archived fact snapshots'
                }
            },
            messages: {
                loadFailed: 'Failed to load validation data.',
                selectProjectFirst: 'Select a project first.',
                runSuccess: 'Validation completed.',
                runFailed: 'Validation failed.',
                markNeedsFixReason: 'Marked from validation report for follow-up.',
                markValidatedReason: 'Marked as validated from validation report.',
                markNeedsFixSuccess: 'Chapter marked for fixes.',
                markValidatedSuccess: 'Chapter marked as validated.',
                updateStatusFailed: 'Failed to update chapter status.'
            }
        },
        themeStudio: {
            eyebrow: 'Stage 9',
            title: 'Theme Studio',
            description: 'Full theme system with preset palettes, browser follow, scheduled switching, holiday overrides, image color extraction, and AI-style palette generation.',
            source: {
                preset: 'Preset Theme',
                system: 'System Theme',
                schedule: 'Scheduled Theme',
                holiday: 'Holiday Theme',
                custom: 'Custom Theme'
            },
            mode: {
                preset: { label: 'Preset', hint: 'Manual theme selection.' },
                system: { label: 'System', hint: 'Follow browser light or dark scheme.' },
                schedule: { label: 'Schedule', hint: 'Switch by time or sun events.' }
            },
            hero: {
                currentTheme: 'Current Theme',
                nextSwitch: 'Next Switch',
                holiday: 'Holiday',
                sunTimes: 'Sun Times',
                none: 'None',
                notScheduled: 'Not scheduled'
            },
            paletteStats: {
                title: 'Palette Stats',
                subtitle: 'Built-in preset breakdown'
            },
            presetStat: {
                total: 'Total',
                light: 'Light',
                dark: 'Dark',
                seasonal: 'Seasonal',
                focus: 'Focus'
            },
            sections: {
                mode: { title: 'Mode', subtitle: 'Switch strategy' },
                systemFollow: { title: 'System Follow', subtitle: 'Browser preference: {value}' },
                presets: { title: 'Presets', subtitle: '{count} built-in palettes mapped from the desktop theme system' },
                schedule: { title: 'Schedule', subtitle: '{value}' },
                holidayOverride: { title: 'Holiday Override', subtitle: 'Optional special-day themes' },
                upcomingHolidays: { title: 'Upcoming Holidays', subtitle: 'Loaded from the stage 9 holiday library' },
                generatedTheme: { title: 'Generated Theme', subtitle: 'Image extraction and AI palette' },
                liveTokens: { title: 'Live Tokens', subtitle: 'Current resolved theme palette' }
            },
            systemFollow: {
                lightMapping: 'Light Mapping',
                darkMapping: 'Dark Mapping'
            },
            presetFilter: {
                all: 'All',
                light: 'Light',
                dark: 'Dark',
                seasonal: 'Seasonal',
                focus: 'Focus'
            },
            schedule: {
                noNextSwitch: 'No next switch yet',
                basis: 'Basis: {value}',
                day: 'Day: {value}',
                night: 'Night: {value}',
                enable: 'Enable schedule',
                useSunTimes: 'Use sunrise and sunset',
                dayTheme: 'Day Theme',
                nightTheme: 'Night Theme',
                sunriseAccent: 'Sunrise Accent',
                sunsetAccent: 'Sunset Accent',
                dayStart: 'Day Start',
                nightStart: 'Night Start',
                latitude: 'Latitude',
                longitude: 'Longitude'
            },
            holiday: {
                enableOverride: 'Enable holiday theme override'
            },
            generated: {
                pickImage: 'Pick image for palette',
                seedPlaceholder: 'Seed words, genre, mood...',
                generate: 'Generate',
                clearCustom: 'Clear custom theme',
                dark: 'dark',
                light: 'light',
                imageGenerated: 'Generated theme from image',
                imageFailed: 'Unable to generate image theme',
                aiGenerated: 'Generated AI-style palette'
            },
            token: {
                primary: 'Primary',
                background: 'Background',
                surface: 'Surface',
                text: 'Text',
                border: 'Border',
                selection: 'Selection'
            },
            scheduleValue: {
                sunriseSunset: 'Sunrise / Sunset',
                fixedTime: 'Fixed Time',
                dayStart: 'Day start',
                nightStart: 'Night start',
                sunriseAccent: 'Sunrise accent',
                sunsetAccent: 'Sunset accent',
                at: '{label} at {time}'
            },
            customSource: {
                image: 'Image generated',
                ai: 'AI generated'
            }
        },
        themePreset: {
            light: { label: 'Light', description: 'Clean neutral workspace.' },
            green: { label: 'Paper Green', description: 'Warm reading palette with soft contrast.' },
            dark: { label: 'Dark', description: 'Balanced dark interface for long sessions.' },
            arctic: { label: 'Arctic', description: 'Ice-blue daylight palette.' },
            forest: { label: 'Forest', description: 'Muted green palette for low-fatigue reading.' },
            violet: { label: 'Violet', description: 'Luminous violet with soft contrast.' },
            business: { label: 'Business', description: 'Conservative office-friendly neutrals.' },
            minimalBlack: { label: 'Minimal Black', description: 'Flat dark palette with restrained highlights.' },
            modernBlue: { label: 'Modern Blue', description: 'Deep blue product aesthetic.' },
            warmOrange: { label: 'Warm Orange', description: 'Warm beige with editorial contrast.' },
            pink: { label: 'Pink', description: 'Soft rose palette with high readability.' },
            techCyan: { label: 'Tech Cyan', description: 'Cold-tech dark palette.' },
            sunset: { label: 'Sunset', description: 'Warm dusk palette.' },
            morandi: { label: 'Morandi', description: 'Muted designer palette.' },
            highContrast: { label: 'High Contrast', description: 'Accessibility-first high contrast palette.' }
        },
        holiday: {
            newYear2024: 'New Year 2024',
            springFestival2024: 'Spring Festival 2024',
            qingming2024: 'Qingming 2024',
            labourDay2024: 'Labour Day 2024',
            dragonBoat2024: 'Dragon Boat 2024',
            midAutumn2024: 'Mid-Autumn 2024',
            nationalDay2024: 'National Day 2024',
            newYear2025: 'New Year 2025',
            springFestival2025: 'Spring Festival 2025',
            qingming2025: 'Qingming 2025',
            labourDay2025: 'Labour Day 2025',
            dragonBoat2025: 'Dragon Boat 2025',
            nationalDay2025: 'National Day 2025',
            midAutumn2025: 'Mid-Autumn 2025',
            newYear: 'New Year',
            valentines: 'Valentine Day',
            labourDay: 'Labour Day',
            childrenDay: 'Children Day',
            nationalDay: 'National Day',
            halloween: 'Halloween',
            christmasEve: 'Christmas Eve',
            christmas: 'Christmas',
            newYearEve: 'New Year Eve'
        },
        validation: {
            title: 'Validation Workbench',
            eyebrow: 'Stage 5 / Validation',
            subtitle: 'Run consistency checks for the current project or volume, review validation summaries, and inspect the persisted fact snapshot.',
            targetLabel: {
                none: 'No project selected',
                volume: '{project} / Volume {volume} / {title}'
            },
            actions: {
                refresh: 'Refresh',
                run: 'Run Validation',
                markNeedsFix: 'Mark Needs Fix',
                markValidated: 'Mark Validated',
                goFixChapter: 'Open Fix Chapter'
            },
            panels: {
                summaries: 'Validation Summaries',
                reports: 'Chapter Reports',
                factOverview: 'Fact Snapshot Overview',
                trackingSummary: 'Tracking Summary',
                timeline: 'Timeline Snapshot',
                archives: 'Volume Archives'
            },
            empty: {
                summaries: 'No validation summaries yet.',
                facts: 'No fact snapshot available.',
                tracking: 'No tracking summary available.',
                archives: 'No archives yet.'
            },
            labels: {
                currentTarget: 'Current Target',
                projectScope: 'Project Scope',
                volume: 'Volume {value}',
                validatedAt: 'Validated at: {value}',
                moduleResults: 'Module Results',
                problemItems: 'Problem Items',
                chapter: 'Chapter',
                summary: 'Summary',
                result: 'Result',
                chapterStatus: 'Chapter Status',
                validatedAtColumn: 'Validated At',
                actions: 'Actions',
                check: 'Check',
                details: 'Details',
                suggestion: 'Suggestion',
                name: 'Name',
                status: 'Status',
                detail: 'Detail',
                importance: 'Importance',
                chapterLabel: 'Chapter {value}',
                timePeriod: 'Time Period',
                elapsed: 'Elapsed',
                keyEvent: 'Key Event',
                lastChapterId: 'Last Chapter ID: {value}',
                chapterReportTitle: 'Chapter {number} / {title}',
                overview: {
                    chapters: 'Chapters',
                    chaptersHint: 'Covered in the current snapshot',
                    characterStates: 'Character States',
                    characterStatesHint: '{count} state points',
                    characterRules: 'Character Rules',
                    characterRulesHint: 'Design character rules',
                    conflictProgress: 'Conflict Progress',
                    conflictProgressHint: '{count} progress points',
                    factionStates: 'Faction States',
                    factionStatesHint: '{count} state points',
                    locationStates: 'Location States',
                    locationStatesHint: '{count} state points',
                    locationRules: 'Location Rules',
                    locationRulesHint: 'Design location rules',
                    worldConstraints: 'World Constraints',
                    worldConstraintsHint: 'Hard rules and special laws',
                    characterLocations: 'Character Locations',
                    characterLocationsHint: '{count} movements',
                    itemStates: 'Item States',
                    itemStatesHint: '{count} state points',
                    foreshadowing: 'Foreshadowing',
                    foreshadowingHint: '{unresolved} unresolved / {overdue} overdue',
                    plotPoints: 'Plot Points',
                    plotPointsHint: '{count} timeline items',
                    volumeArchives: 'Volume Archives',
                    volumeArchivesHint: 'Archived fact snapshots'
                }
            },
            messages: {
                loadFailed: 'Failed to load validation data.',
                selectProjectFirst: 'Select a project first.',
                completed: 'Validation completed.',
                failed: 'Validation failed.',
                markFollowUp: 'Marked from validation report for follow-up.',
                markValidated: 'Marked as validated from validation report.',
                chapterMarkedNeedsFix: 'Chapter marked for fixes.',
                chapterMarkedValidated: 'Chapter marked as validated.',
                updateChapterStatusFailed: 'Failed to update chapter status.'
            },
        },
        chapterGeneration: {
            messages: {
                loadChaptersFailed: 'Failed to load chapters.',
                loadChapterDetailsFailed: 'Failed to load chapter details.',
                selectProjectVolumeFirst: 'Select a project and a volume first.',
                chapterTitleRequired: 'Chapter title is required.',
                chapterCreated: 'Chapter created.',
                createChapterFailed: 'Failed to create chapter.',
                deleteConfirm: 'Delete Chapter {number} / {title}?',
                chapterDeleted: 'Chapter deleted.',
                deleteChapterFailed: 'Failed to delete chapter.',
                loadAiConfigFailed: 'Failed to load AI configuration.',
                selectChapterFirst: 'Select or create a chapter first.',
                endpointModelRequired: 'Endpoint and model are required.',
                selectConfigOrKeyFirst: 'Select a saved config or enter an API key manually.',
                promptRequired: 'Prompt is required.',
                draftGenerated: 'Draft generated and saved to the chapter.',
                generationFailed: 'Generation failed.',
                draftSaved: 'Draft saved.',
                saveDraftFailed: 'Failed to save draft.',
                validationRerunCompleted: 'Validation was rerun automatically for the updated chapter.',
                firstChapterAlreadyExists: 'This volume already has chapters, so first-chapter auto generation is unavailable.'
            },
            chapter: {
                panelTitle: 'Chapters',
                refresh: 'Refresh',
                empty: 'Select a project and volume first.',
                create: 'Create Chapter',
                number: 'Chapter No.',
                title: 'Title',
                summary: 'Summary',
                titlePlaceholder: 'Chapter title',
                summaryPlaceholder: 'Chapter goal or summary',
                tableTitle: 'Title',
                tableStatus: 'Status',
                header: 'Chapter {number} / {title}',
                draftFallback: 'Chapter Draft',
                defaultFirstChapterTitle: 'Chapter 1 Opening',
                autoTitle: 'Chapter {number}'
            },
            actions: {
                saveDraft: 'Save Draft',
                generateDraft: 'Generate Draft',
                generateFirstChapter: 'Generate First Chapter',
                refreshAiConfig: 'Refresh AI Config'
            },
            ai: {
                config: 'Saved Config',
                apiKey: 'API Key',
                model: 'Model',
                endpoint: 'Endpoint',
                systemPrompt: 'System Prompt',
                prompt: 'Prompt',
                temperature: 'Temperature',
                maxTokens: 'Max Tokens',
                maxRewrites: 'Max Rewrites',
                selectConfig: 'Select saved config',
                autoRerunValidation: 'Auto rerun validation',
                manualValidation: 'Manual validation',
                apiKeyPlaceholder: 'sk-...',
                modelPlaceholder: 'gpt-4o-mini / deepseek-chat / ...',
                endpointPlaceholder: 'https://api.openai.com/v1',
                outputPlaceholder: 'Generated draft content will stream here.'
            },
            status: {
                record: 'Record {id}'
            },
            batch: {
                title: 'Auto Generate Chapters',
                subtitle: 'Confirm titles and summaries first, then generate and save chapters automatically.',
                start: 'Start Auto Generate',
                preview: 'Generate Titles',
                confirmStart: 'Confirm and Generate',
                stop: 'Stop',
                startNumber: 'Start No.',
                count: 'Chapter Count',
                options: 'Options',
                createMissing: 'Create missing chapters',
                overwriteExisting: 'Overwrite existing content',
                stopOnFailure: 'Stop on failure',
                countRequired: 'Chapter count must be greater than 0.',
                previewReady: 'Titles and summaries are ready. Confirm them before generating content.',
                previewFailed: 'Failed to generate titles and summaries.',
                previewRequired: 'Generate and confirm titles and summaries first.',
                previewTitle: 'Confirm Before Content Generation',
                previewSubtitle: 'Edit titles and summaries here; the background job will use this list.',
                refreshPreview: 'Regenerate',
                previewNumber: 'No.',
                previewTitleColumn: 'Title',
                previewSummaryColumn: 'Summary',
                previewState: 'State',
                previewNew: 'New',
                previewExists: 'Exists',
                previewHasContent: 'Has content',
                missingChapter: 'Chapter {number} does not exist and auto creation is disabled.',
                created: 'Created Chapter {number}: {title}',
                generated: 'Generated Chapter {number}: {title}',
                skippedExisting: 'Skipped Chapter {number}: {title}; content already exists.',
                failed: 'Chapter {number} failed: {title}',
                queued: 'Background job queued: {id}',
                queueFailed: 'Failed to queue background chapter generation.',
                loadJobFailed: 'Failed to load background chapter generation job.',
                cancelFailed: 'Failed to cancel background chapter generation job.',
                jobId: 'Job {id}',
                stopRequested: 'Auto generation will stop after the current chapter.',
                stopped: 'Auto generation stopped.',
                completed: 'Auto generation completed: {completed} succeeded, {skipped} skipped, {failed} failed.',
                progress: 'Done {completed} / skipped {skipped} / failed {failed} / total {total}',
                current: 'Current: Chapter {number} / {title}',
                status: {
                    idle: 'Idle',
                    queued: 'Queued',
                    running: 'Running in background',
                    completed: 'Completed',
                    failed: 'Finished',
                    cancelled: 'Cancelled'
                }
            }
        },
        aiAssistant: {
            title: 'AI Assistant',
            mode: {
                agent: 'Agent',
                plan: 'Plan',
                edit: 'Edit'
            },
            status: {
                pending: 'Pending',
                running: 'Running',
                completed: 'Completed',
                failed: 'Failed',
                cancelled: 'Cancelled',
                unknown: 'Unknown'
            },
            labels: {
                toolCall: 'Tool Call',
                executionTrace: 'Execution Trace',
                executionTraceWithTools: 'Execution Trace / Tool Calls',
                waitingToolDetails: 'Waiting for tool call details',
                arguments: 'Arguments',
                result: 'Result',
                error: 'Error',
                rows: '{count} rows',
                steps: '{count} steps',
                completedSteps: '{count} completed',
                failedSteps: '{count} failed',
                executionRequired: 'Execution Required',
                chapters: 'Chapters {start}-{end}',
                chapter: 'Chapter {value}',
                continue: 'Continue {value}',
                rewrite: 'Rewrite {value}'
            },
            normalization: {
                singleChapterMerged: 'Single Chapter Merge',
                chapterRangeSplit: 'Chapter Range Split',
                multiChapterPreserved: 'Multi Chapter Preserved'
            },
            directive: {
                continue: 'Continue',
                rewrite: 'Rewrite',
                default: 'Directive'
            },
            targetPanel: {
                ExecutionPlan: 'Execution Plan',
                ExecutionPanel: 'Execution Panel'
            },
            actions: {
                newSession: 'New Session',
                saveSettings: 'Save Settings',
                executePlan: 'Execute Plan',
                send: 'Send'
            },
            placeholders: {
                provider: 'Provider',
                key: 'Key',
                apiKey: 'API key',
                model: 'Model',
                sessionTitle: 'Session title',
                endpoint: 'Endpoint, for example https://api.openai.com/v1',
                composer: 'Enter a task, a planning request, or text to edit...'
            },
            empty: {
                sessions: 'No sessions yet.',
                messages: 'Start a conversation.',
                toolDetails: 'Execution events received, waiting for tool details.'
            },
            messages: {
                loadSessionsFailed: 'Failed to load chat sessions.',
                createSessionFailed: 'Failed to create a session.',
                saveSessionSuccess: 'Session settings saved.',
                saveSessionFailed: 'Failed to save session settings.',
                deleteConfirm: 'Delete session "{title}"?',
                deleteFailed: 'Failed to delete the session.',
                enterMessage: 'Enter a message first.',
                endpointModelRequired: 'Endpoint and model are required.',
                selectProviderFirst: 'Select a provider first.',
                tempKeyRequired: 'Enter a temporary API key.',
                sendFailed: 'Failed to send the message.',
                executingAnother: 'Another execution is already in progress.',
                executeFinishedWithFailures: 'Plan execution finished with failures.',
                executeCompleted: 'Plan execution completed.',
                executeFailed: 'Failed to execute the plan.'
            },
            switch: {
                savedKey: 'Saved key',
                temporaryKey: 'Temporary key'
            },
            thinking: 'thinking'
        },
        design: {
            modules: {
                world_rules: 'World Rules',
                character_rules: 'Character Rules',
                faction_rules: 'Faction Rules',
                location_rules: 'Location Rules',
                plot_rules: 'Plot Rules',
                creative_materials: 'Creative Materials',
                book_analyses: 'Book Analyses',
                outlines: 'Outlines',
                volume_designs: 'Volume Designs',
                chapter_plans: 'Chapter Plans',
                chapter_blueprints: 'Chapter Blueprints'
            },
            labels: {
                sourceBook: 'Source Book',
                all: 'All',
                new: 'New',
                setProjectDefault: 'Set As Project Default',
                categories: '{module} Categories',
                allUncategorized: 'All / Uncategorized',
                noCategories: 'No categories',
                builtIn: 'Built-in',
                records: '{module} Records',
                crawlImport: 'Import Analysis',
                searchByName: 'Search by name',
                category: 'Category',
                enabled: 'Enabled',
                disabled: 'Disabled',
                updatedFrom: 'Updated From',
                updatedTo: 'Updated To',
                onlyUncategorized: 'Only Uncategorized',
                status: 'Status',
                updated: 'Updated',
                actions: 'Actions',
                edit: 'Edit',
                delete: 'Delete',
                total: 'Total {count}',
                on: 'On',
                off: 'Off',
                noRecordsInModule: 'No records in {module}',
                newCategory: 'New Category',
                editCategory: 'Edit Category',
                name: 'Name',
                parent: 'Parent',
                rootCategory: 'Root category',
                sort: 'Sort',
                save: 'Save',
                cancel: 'Cancel',
                categoryId: 'Category ID',
                sourceBookId: 'Source Book ID',
                notBound: 'Not bound',
                globalScope: 'Global scope',
                newSourceBook: 'New Source Book',
                create: 'Create',
                crawlImportTitle: 'Import Book Analysis',
                bookDetailUrl: 'Book detail page URL, or upload local TXT',
                preview: 'Preview',
                uploadTxt: 'Upload TXT',
                uploadTxtHint: 'Supports local .txt novels; chapters are split by headings and converted to draft preview.',
                enterUrlPreviewApply: 'Enter a URL or upload TXT, preview the result, then apply it to a form.',
                sourceUrl: 'Source URL',
                title: 'Title',
                site: 'Site',
                author: 'Author',
                previewSummary: 'Preview Summary',
                sampleChapters: 'Sample chapters: {count}',
                chapterCount: 'Chapter count: {count}',
                totalWords: 'Total words: {count}',
                summary: 'Summary',
                noSummary: 'No summary',
                mappedDraftFields: 'Mapped Draft Fields',
                localTxtBook: 'Local TXT Novel',
                localTxtFile: 'Local TXT',
                txtAnalysisPlaceholder: 'Imported from local TXT. Continue filling world, character, and plot analysis.',
                fullText: 'Full Text',
                aiAnalysis: 'AI Book Analysis',
                aiProviderConfig: 'AI Config',
                aiProvider: 'Provider',
                aiKeyAuto: 'Key (auto rotation)',
                aiModel: 'Model',
                aiEndpoint: 'Endpoint',
                runAiAnalysis: 'AI Analyze',
                generateCreativeMaterial: 'Create Creative Material',
                buildSkeleton: 'Build Skeleton',
                aiStatus: 'AI Status',
                aiIdle: 'Idle',
                aiQueued: 'Queued',
                aiRunning: 'Running',
                aiCompleted: 'Completed',
                aiFailed: 'Failed',
                aiFailureReason: 'Failure Reason',
                aiFailureUnknown: 'AI analysis failed with no detailed reason returned.',
                aiAnalysisHint: 'Upload TXT or preview URL first, then run AI analysis. The world, character, and plot fields will be filled automatically.',
                na: 'N/A',
                close: 'Close',
                applyToCurrent: 'Apply To Current',
                newDraft: 'New Draft',
                webBookAnalysis: 'Web Book Analysis'
            },
            messages: {
                missingReferences: 'Missing references: {value}',
                currentValueMissing: 'Current value "{value}" does not exist in the available options.',
                removedInvalidReferences: 'Removed {count} invalid references.',
                invalidReferenceCleared: 'Invalid reference cleared.',
                referencesStillInvalid: 'References refreshed, but some values are still invalid.',
                referencesRefreshed: 'References refreshed.',
                refreshReferencesFailed: 'Failed to refresh references.',
                loadSourceBooksFailed: 'Failed to load source books.',
                sourceBookNameRequired: 'Source book name is required.',
                sourceBookCreated: 'Source book created.',
                createSourceBookFailed: 'Failed to create source book.',
                selectProjectFirst: 'Select a project first.',
                bindSourceBookSuccess: 'Project default source book updated.',
                bindSourceBookFailed: 'Failed to bind source book.',
                loadCategoriesFailed: 'Failed to load categories.',
                categoryCreated: 'Category created.',
                categoryUpdated: 'Category updated.',
                saveCategoryFailed: 'Failed to save category.',
                builtInCategoriesCannotDelete: 'Built-in categories cannot be deleted.',
                deleteCategoryConfirm: 'Delete category "{name}"?',
                categoryDeleted: 'Category deleted.',
                deleteCategoryFailed: 'Failed to delete category.',
                saveCategoryOrderFailed: 'Failed to save category order.',
                loadRecordsFailed: 'Failed to load records.',
                loadRecordDetailFailed: 'Failed to load record detail.',
                nameRequired: 'Name is required.',
                recordCreated: 'Record created.',
                recordUpdated: 'Record updated.',
                saveRecordFailed: 'Failed to save record.',
                deleteRecordConfirm: 'Delete "{name}"?',
                recordDeleted: 'Record deleted.',
                deleteRecordFailed: 'Failed to delete record.',
                sourceUrlRequired: 'A source URL is required.',
                previewLoaded: 'Preview loaded.',
                crawlPreviewFailed: 'Failed to crawl preview.',
                txtImportLoaded: 'TXT loaded and preview generated.',
                txtImportFailed: 'Failed to read TXT.',
                previewRequiredForAi: 'Upload TXT or preview URL first.',
                aiConfigRequired: 'Select Provider, model, and endpoint first.',
                aiAnalysisCompleted: 'AI analysis completed and filled the preview.',
                aiAnalysisFailed: 'AI analysis failed.',
                previewApplied: 'Preview applied to the form.',
                creativeMaterialCreatedFromBookAnalysis: 'Creative material created from book analysis: {name}',
                createCreativeMaterialFromBookAnalysisFailed: 'Failed to create creative material from book analysis.',
                skeletonBuilt: 'Skeleton built: {rules} rules, {outlines} outline, {volumes} volumes, {chapters} chapter plans, {blueprints} blueprints.',
                skeletonBuildFailed: 'Failed to build skeleton.',
                backgroundAiQueued: 'Background AI analysis has been queued. You can keep working.',
                backgroundAiQueueFailed: 'Failed to queue background AI analysis.',
                backgroundAiAlreadyRunning: 'A background AI analysis job is already running for this record.'
            }
        },
        editor: {
            actions: {
                refresh: 'Refresh',
                runRecall: 'Run Recall',
                saveContent: 'Save Content',
                restoreVersion: 'Restore This Version'
            },
            tabs: {
                write: 'Edit',
                preview: 'Preview',
                recall: 'Recall Results',
                history: 'Version History',
                diff: 'Compare Versions'
            },
            labels: {
                chapterList: 'Chapters',
                chapterNumber: 'Chapter {number}',
                chapterTitle: 'Chapter {number} · {title}',
                volumeNumber: 'Volume {number}',
                wordCount: '{count} words',
                recallQuerySource: 'Query Source: {source}',
                manualInput: 'Manual Input',
                score: 'Score {score}',
                current: 'Current',
                currentVersionSuffix: ' (Current)',
                unknownTime: 'Unknown time',
                sizeBytes: '{size} bytes',
                sizeKilobytes: '{size} KB',
                sizeMegabytes: '{size} MB'
            },
            placeholders: {
                filterBySourceBook: 'Filter by source book',
                searchKeyword: 'Search chapter title or summary',
                recallQuery: 'Optional: custom recall query',
                editorContent: 'Edit chapter content here. Markdown is supported.',
                selectVersion: 'Select a version',
                selectDiffBaseVersion: 'Select a base version for comparison'
            },
            hints: {
                monacoFallback: 'Monaco did not load. Switched to a textarea fallback.',
                markdownFallback: 'Using the basic Markdown preview.',
                diffBaseVsCurrent: 'The left side is the base version, and the right side is the current content.',
                diffFallback: 'diff2html did not load. Showing a lightweight line-by-line diff.',
                diffEnhanced: 'diff2html loaded. Showing a side-by-side diff.'
            },
            empty: {
                noSummary: 'No summary',
                noChapterSelected: 'No chapter selected',
                selectChapterFirst: 'Select a chapter from the left first.',
                noRecallResults: 'Recall has not been run yet.',
                noVersions: 'No version history yet.',
                noVersionSelected: 'No version selected',
                noVersionContent: 'No version content available',
                noDiff: 'There is no difference between the current content and the base version.'
            },
            messages: {
                loadSourceBooksFailed: 'Failed to load source books.',
                loadChaptersFailed: 'Failed to load chapters.',
                loadChapterDetailFailed: 'Failed to load chapter details.',
                loadVersionsFailed: 'Failed to load version history.',
                loadVersionDetailFailed: 'Failed to load version content.',
                contentSaved: 'Chapter content saved.',
                saveContentFailed: 'Failed to save chapter content.',
                versionRestored: 'Restored to the selected version.',
                restoreVersionFailed: 'Failed to restore the version.',
                loadRecallFailed: 'Failed to load recall results.'
            }
        },
        editorWorkspace: {
            title: 'Editor Workspace',
            eyebrow: 'Stage 7 / Editor',
            labels: {
                noProjectSelected: 'No project selected',
                volume: 'Volume {number}',
                refresh: 'Refresh',
                save: 'Save',
                chapters: 'Chapters',
                noChapters: 'No chapters yet.',
                chapterTitle: 'Chapter {number} / {title}',
                unknown: 'Unknown',
                chars: '{count} chars',
                updatedAt: 'Updated {time}',
                unsaved: 'Unsaved',
                editorIndex: 'Editor Index',
                indexedChapters: 'Indexed Chapters',
                keywords: 'Keywords',
                staleChapters: 'Stale Chapters',
                lastBuilt: 'Last built: {time}',
                refreshStatus: 'Refresh Status',
                rebuildIndex: 'Rebuild Index',
                vectorRecall: 'Vector Recall',
                context: 'Context',
                insert: 'Insert',
                noQuery: 'No query'
            },
            placeholders: {
                searchCurrentChapter: 'Search in current chapter',
                replacementText: 'Replacement text',
                editorContent: 'Write chapter content here...',
                recallQuery: 'Enter people, places, clues, or world rules'
            },
            actions: {
                prev: 'Prev',
                next: 'Next',
                replace: 'Replace',
                replaceAll: 'Replace All',
                searchRecall: 'Search Recall'
            },
            empty: {
                selectProjectFirst: 'Select a project first.',
                selectChapterToEdit: 'Select a chapter to start editing.',
                noRelatedContext: 'Search project context to recall related content.'
            },
            messages: {
                enterSearchText: 'Enter text to search.',
                noMatchesFound: 'No matches found in the current chapter.',
                noMatchesToReplace: 'No matches to replace.',
                replacedMatches: 'Replaced {count} matches.',
                recallSnippetInserted: 'Recall snippet inserted.',
                loadIndexStatusFailed: 'Failed to load index status.',
                selectProjectFirst: 'Select a project first.',
                indexRebuilt: 'Editor index rebuilt.',
                rebuildIndexFailed: 'Failed to rebuild the editor index.',
                loadChaptersFailed: 'Failed to load chapters.',
                loadChapterDetailsFailed: 'Failed to load chapter details.',
                selectChapterFirst: 'Select a chapter first.',
                contentSaved: 'Chapter content saved.',
                saveContentFailed: 'Failed to save chapter content.',
                enterRecallKeywords: 'Enter keywords for recall.',
                noRelatedContextFound: 'No related context found.',
                vectorRecallFailed: 'Vector recall failed.'
            }
        }
    }
};
