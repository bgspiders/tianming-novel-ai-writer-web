import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ChatLineRound, Delete, Plus, Promotion, Refresh } from '@element-plus/icons-vue';
import { useI18n } from '@/composables/useI18n';
import { useWorkContextStore } from '@/stores/workContext';
import { chatHub } from '@/signalr/chat';
import { createChatSession, deleteChatSession, executeChatPlan, listChatMessages, listChatSessions, sendChatMessage, updateChatSession } from '@/api/modules/chatAssistant';
import { listKeys, listModels, listProviders } from '@/api/modules/ai';
const workContext = useWorkContextStore();
const { t } = useI18n();
const sessions = ref([]);
const messages = ref([]);
const selectedSessionId = ref('');
const providers = ref([]);
const models = ref([]);
const keys = ref([]);
const selectedProviderId = ref('');
const selectedModel = ref('');
const selectedKeyId = ref('');
const endpoint = ref('');
const tempKey = ref('');
const useSavedKey = ref(true);
const mode = ref('agent');
const input = ref('');
const streamingRaw = ref('');
const streamingText = ref('');
const streamingThinking = ref('');
const errorMessage = ref('');
const status = ref('idle');
const loading = ref(false);
const sending = ref(false);
const savingSession = ref(false);
const executingMessageId = ref('');
const currentRunId = ref('');
const titleDraft = ref('');
const runEvents = ref([]);
const selectedSession = computed(() => sessions.value.find((item) => item.id === selectedSessionId.value) ?? null);
const enabledModels = computed(() => models.value.filter((item) => item.isEnabled));
const enabledKeys = computed(() => keys.value.filter((item) => item.isEnabled));
const liveToolCalls = computed(() => runEvents.value.flatMap((event, eventIndex) => toolCallsFromRunEvent(event, eventIndex)));
const liveTraceSummary = computed(() => {
    for (let index = runEvents.value.length - 1; index >= 0; index -= 1) {
        const summary = traceSummaryFromRunEvent(runEvents.value[index]);
        if (summary)
            return summary;
    }
    return summarizeToolCalls(liveToolCalls.value);
});
const hasLiveExecutionEvents = computed(() => runEvents.value.some((event) => isToolRunEvent(event)));
const visibleMessages = computed(() => {
    const rows = [...messages.value];
    if (streamingText.value) {
        rows.push({
            id: 'streaming',
            chatSessionId: selectedSessionId.value,
            role: 'assistant',
            content: streamingText.value,
            summary: streamingText.value,
            thinkingContent: streamingThinking.value || null,
            analysisBlocksJson: null,
            toolPayload: null,
            inputTokens: null,
            outputTokens: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
    return rows;
});
function modeLabel(value) {
    if (value === 'plan')
        return t('aiAssistant.mode.plan');
    if (value === 'edit')
        return t('aiAssistant.mode.edit');
    return t('aiAssistant.mode.agent');
}
function formatTime(value) {
    return value ? new Date(value).toLocaleString() : '-';
}
function formatEventTime(value) {
    return value ? new Date(value).toLocaleTimeString() : '';
}
function parseToolPayload(value) {
    if (!value)
        return null;
    try {
        return JSON.parse(value);
    }
    catch {
        return null;
    }
}
function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function fieldValue(record, camel, pascal) {
    return record[camel] ?? record[pascal];
}
function asNullableString(value) {
    if (value == null)
        return null;
    return typeof value === 'string' ? value : String(value);
}
function asNullableNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function asNullableStringList(value) {
    return Array.isArray(value)
        ? value.map((item) => asNullableString(item)).filter((item) => !!item)
        : null;
}
function statusFromRunEventType(type) {
    if (type === 'tool.started')
        return 'running';
    if (type === 'tool.completed')
        return 'completed';
    if (type === 'tool.failed')
        return 'failed';
    if (type === 'tool.cancelled')
        return 'cancelled';
    return null;
}
function isToolRunEvent(event) {
    return statusFromRunEventType(event.type) !== null;
}
function normalizeToolCall(value, key, fallbackTitle, fallbackStatus) {
    if (!isRecord(value))
        return null;
    const hasToolFields = [
        ['stepIndex', 'StepIndex'],
        ['pluginName', 'PluginName'],
        ['functionName', 'FunctionName'],
        ['title', 'Title'],
        ['description', 'Description'],
        ['arguments', 'Arguments'],
        ['result', 'Result'],
        ['status', 'Status'],
        ['errorMessage', 'ErrorMessage'],
        ['durationSeconds', 'DurationSeconds'],
        ['durationMs', 'DurationMs']
    ].some(([camel, pascal]) => camel in value || pascal in value);
    if (!hasToolFields)
        return null;
    return {
        stepIndex: asNullableNumber(fieldValue(value, 'stepIndex', 'StepIndex')),
        pluginName: asNullableString(fieldValue(value, 'pluginName', 'PluginName')),
        functionName: asNullableString(fieldValue(value, 'functionName', 'FunctionName')),
        title: asNullableString(fieldValue(value, 'title', 'Title')),
        description: asNullableString(fieldValue(value, 'description', 'Description')),
        arguments: fieldValue(value, 'arguments', 'Arguments'),
        result: fieldValue(value, 'result', 'Result'),
        status: asNullableString(fieldValue(value, 'status', 'Status')) ?? fallbackStatus ?? null,
        startTime: asNullableString(fieldValue(value, 'startTime', 'StartTime')),
        endTime: asNullableString(fieldValue(value, 'endTime', 'EndTime')),
        durationSeconds: asNullableNumber(fieldValue(value, 'durationSeconds', 'DurationSeconds')),
        durationMs: asNullableNumber(fieldValue(value, 'durationMs', 'DurationMs')),
        errorMessage: asNullableString(fieldValue(value, 'errorMessage', 'ErrorMessage')),
        key,
        fallbackTitle
    };
}
function payloadToolCalls(message) {
    const payload = parseToolPayload(message.toolPayload);
    const calls = [...(payload?.executionTrace ?? []), ...(payload?.toolCalls ?? [])];
    return calls
        .map((call, index) => normalizeToolCall(call, `${message.id}-tool-${index}`))
        .filter((call) => !!call);
}
function payloadTraceSummary(message) {
    return parseToolPayload(message.toolPayload)?.executionTraceSummary ?? null;
}
function toolCallsFromRunEvent(event, eventIndex) {
    const data = event.data;
    const fallbackStatus = statusFromRunEventType(event.type);
    if (!isRecord(data))
        return [];
    const values = [];
    for (const field of ['executionTrace', 'ExecutionTrace', 'toolCalls', 'ToolCalls']) {
        const value = data[field];
        if (Array.isArray(value))
            values.push(...value);
    }
    for (const field of ['toolCall', 'ToolCall', 'call', 'Call', 'record', 'Record']) {
        if (isRecord(data[field]))
            values.push(data[field]);
    }
    if (values.length === 0)
        values.push(data);
    return values
        .map((value, index) => normalizeToolCall(value, `run-${eventIndex}-tool-${index}`, event.message, fallbackStatus))
        .filter((call) => !!call);
}
function isPlanBusinessStep(call) {
    return call.pluginName?.toLowerCase() === 'plan' && call.functionName?.toLowerCase() === 'preparestep';
}
function normalizeTraceSummary(value) {
    if (!isRecord(value))
        return null;
    const totalSteps = asNullableNumber(fieldValue(value, 'totalSteps', 'TotalSteps'));
    const completedSteps = asNullableNumber(fieldValue(value, 'completedSteps', 'CompletedSteps'));
    const failedSteps = asNullableNumber(fieldValue(value, 'failedSteps', 'FailedSteps'));
    const totalDurationSeconds = asNullableNumber(fieldValue(value, 'totalDurationSeconds', 'TotalDurationSeconds'));
    const summaryText = asNullableString(fieldValue(value, 'summaryText', 'SummaryText'));
    const failedStepSummaries = asNullableStringList(fieldValue(value, 'failedStepSummaries', 'FailedStepSummaries'));
    if (totalSteps == null &&
        completedSteps == null &&
        failedSteps == null &&
        totalDurationSeconds == null &&
        !summaryText &&
        !failedStepSummaries?.length) {
        return null;
    }
    return {
        totalSteps,
        completedSteps,
        failedSteps,
        totalDurationSeconds,
        failedStepSummaries,
        summaryText
    };
}
function traceSummaryFromRunEvent(event) {
    const data = event.data;
    if (!isRecord(data))
        return null;
    return normalizeTraceSummary(data.executionTraceSummary ?? data.ExecutionTraceSummary ?? data.summary ?? data.Summary ?? data);
}
function summarizeToolCalls(calls) {
    if (calls.length === 0)
        return null;
    const businessCalls = calls.filter(isPlanBusinessStep);
    const summaryCalls = businessCalls.length > 0 ? businessCalls : calls;
    const completedSteps = summaryCalls.filter((call) => call.status === 'completed').length;
    const failedSteps = summaryCalls.filter((call) => call.status === 'failed').length;
    const failedStepSummaries = summaryCalls
        .filter((call) => call.status === 'failed')
        .map((call) => call.errorMessage || call.title || toolCallName(call));
    const totalDurationSeconds = summaryCalls.reduce((total, call) => {
        if (typeof call.durationSeconds === 'number')
            return total + call.durationSeconds;
        if (typeof call.durationMs === 'number')
            return total + call.durationMs / 1000;
        return total;
    }, 0);
    return {
        totalSteps: summaryCalls.length,
        completedSteps,
        failedSteps,
        totalDurationSeconds: totalDurationSeconds > 0 ? totalDurationSeconds : null,
        failedStepSummaries: failedStepSummaries.length > 0 ? failedStepSummaries : null
    };
}
function planSteps(message) {
    const payload = parseToolPayload(message.toolPayload);
    return payload?.type === 'plan' ? payload.steps ?? [] : [];
}
function thinkingBlocks(message) {
    if (message.analysisBlocksJson) {
        try {
            return JSON.parse(message.analysisBlocksJson);
        }
        catch {
            return [];
        }
    }
    return parseToolPayload(message.toolPayload)?.thinkingBlocks ?? [];
}
function payloadMeta(message) {
    return parseToolPayload(message.toolPayload);
}
function canExecutePlan(message) {
    const payload = payloadMeta(message);
    return message.role === 'assistant' && payload?.type === 'plan' && payload.requiresExecutionEngine === true;
}
function toolCallStatusLabel(status) {
    if (status === 'pending')
        return t('aiAssistant.status.pending');
    if (status === 'running')
        return t('aiAssistant.status.running');
    if (status === 'completed')
        return t('aiAssistant.status.completed');
    if (status === 'failed')
        return t('aiAssistant.status.failed');
    if (status === 'cancelled')
        return t('aiAssistant.status.cancelled');
    return status || t('aiAssistant.status.unknown');
}
function toolCallStatusTag(status) {
    if (status === 'completed')
        return 'success';
    if (status === 'failed')
        return 'danger';
    if (status === 'running')
        return 'warning';
    if (status === 'cancelled')
        return 'info';
    return '';
}
function toolCallName(call) {
    const plugin = call.pluginName?.trim();
    const fn = call.functionName?.trim();
    if (plugin && fn)
        return `${plugin}.${fn}`;
    return plugin || fn || call.title || t('aiAssistant.labels.toolCall');
}
function formatToolValue(value) {
    if (value == null || value === '')
        return '';
    if (typeof value === 'string')
        return value;
    try {
        return JSON.stringify(value, null, 2);
    }
    catch {
        return String(value);
    }
}
function formatToolDuration(call) {
    if (typeof call.durationSeconds === 'number') {
        return `${call.durationSeconds.toFixed(call.durationSeconds >= 10 ? 1 : 2)}s`;
    }
    if (typeof call.durationMs === 'number') {
        return `${Math.round(call.durationMs)}ms`;
    }
    if (call.startTime && call.endTime) {
        const elapsed = new Date(call.endTime).getTime() - new Date(call.startTime).getTime();
        if (Number.isFinite(elapsed) && elapsed >= 0)
            return `${elapsed}ms`;
    }
    return '';
}
function formatTraceSummary(summary) {
    if (!summary)
        return '';
    if (summary.summaryText)
        return summary.summaryText;
    const parts = [];
    if (typeof summary.totalSteps === 'number')
        parts.push(t('aiAssistant.labels.steps', { count: summary.totalSteps }));
    if (typeof summary.completedSteps === 'number')
        parts.push(t('aiAssistant.labels.completedSteps', { count: summary.completedSteps }));
    if (typeof summary.failedSteps === 'number' && summary.failedSteps > 0)
        parts.push(t('aiAssistant.labels.failedSteps', { count: summary.failedSteps }));
    if (typeof summary.totalDurationSeconds === 'number' && summary.totalDurationSeconds > 0) {
        parts.push(`${summary.totalDurationSeconds.toFixed(1)}s`);
    }
    return parts.join(' / ');
}
function shouldShowRawContent(message) {
    return !payloadMeta(message)?.hideRawContentInBubble;
}
function normalizationLabel(value) {
    if (value === 'singleChapterMerged')
        return t('aiAssistant.normalization.singleChapterMerged');
    if (value === 'chapterRangeSplit')
        return t('aiAssistant.normalization.chapterRangeSplit');
    if (value === 'multiChapterPreserved')
        return t('aiAssistant.normalization.multiChapterPreserved');
    return value || '';
}
function directiveLabel(kind) {
    if (kind === 'continue')
        return t('aiAssistant.directive.continue');
    if (kind === 'rewrite')
        return t('aiAssistant.directive.rewrite');
    return kind || t('aiAssistant.directive.default');
}
function targetPanelLabel(value) {
    if (value === 'ExecutionPlan')
        return t('aiAssistant.targetPanel.ExecutionPlan');
    if (value === 'ExecutionPanel')
        return t('aiAssistant.targetPanel.ExecutionPanel');
    return value || '';
}
function splitStreaming(raw) {
    const pairs = [
        ['<thinking>', '</thinking>'],
        ['<think>', '</think>'],
        ['[thinking]', '[/thinking]']
    ];
    for (const [open, close] of pairs) {
        const start = raw.toLowerCase().indexOf(open.toLowerCase());
        const end = raw.toLowerCase().indexOf(close.toLowerCase());
        if (start >= 0 && end > start) {
            return {
                content: (raw.slice(0, start) + raw.slice(end + close.length)).trim(),
                thinking: raw.slice(start + open.length, end).trim()
            };
        }
    }
    return { content: raw, thinking: '' };
}
async function refreshMessages() {
    if (!selectedSessionId.value) {
        messages.value = [];
        return;
    }
    messages.value = await listChatMessages(selectedSessionId.value);
}
async function refreshSessions() {
    loading.value = true;
    try {
        sessions.value = await listChatSessions(workContext.selectedProjectId || null);
        if (!sessions.value.some((item) => item.id === selectedSessionId.value)) {
            selectedSessionId.value = sessions.value[0]?.id ?? '';
        }
        await refreshMessages();
    }
    catch (err) {
        ElMessage.error(err.message || t('aiAssistant.messages.loadSessionsFailed'));
    }
    finally {
        loading.value = false;
    }
}
async function createSession(nextMode = mode.value) {
    try {
        const session = await createChatSession({
            projectId: workContext.selectedProjectId || null,
            mode: nextMode,
            providerId: selectedProviderId.value || null,
            modelCode: selectedModel.value || null
        });
        sessions.value = [session, ...sessions.value];
        selectedSessionId.value = session.id;
        mode.value = session.mode;
        messages.value = [];
    }
    catch (err) {
        ElMessage.error(err.message || t('aiAssistant.messages.createSessionFailed'));
    }
}
async function saveSessionSettings() {
    if (!selectedSessionId.value)
        return;
    savingSession.value = true;
    try {
        const updated = await updateChatSession(selectedSessionId.value, {
            title: titleDraft.value.trim() || selectedSession.value?.title || null,
            mode: mode.value,
            providerId: selectedProviderId.value || null,
            modelCode: selectedModel.value || null
        });
        sessions.value = sessions.value.map((item) => (item.id === updated.id ? updated : item));
        ElMessage.success(t('aiAssistant.messages.saveSessionSuccess'));
    }
    catch (err) {
        ElMessage.error(err.message || t('aiAssistant.messages.saveSessionFailed'));
    }
    finally {
        savingSession.value = false;
    }
}
async function removeSession(session) {
    try {
        await ElMessageBox.confirm(t('aiAssistant.messages.deleteConfirm', { title: session.title }), t('layout.dialogs.confirm'), { type: 'warning' });
    }
    catch {
        return;
    }
    try {
        await deleteChatSession(session.id);
        sessions.value = sessions.value.filter((item) => item.id !== session.id);
        if (selectedSessionId.value === session.id) {
            selectedSessionId.value = sessions.value[0]?.id ?? '';
            await refreshMessages();
        }
    }
    catch (err) {
        ElMessage.error(err.message || t('aiAssistant.messages.deleteFailed'));
    }
}
async function refreshAiConfig() {
    providers.value = (await listProviders()).filter((item) => item.isEnabled);
    if (!providers.value.some((item) => item.id === selectedProviderId.value)) {
        selectedProviderId.value = providers.value[0]?.id ?? '';
    }
    await refreshProviderAssets();
}
async function refreshProviderAssets() {
    if (!selectedProviderId.value) {
        models.value = [];
        keys.value = [];
        return;
    }
    const [nextModels, nextKeys] = await Promise.all([
        listModels(selectedProviderId.value),
        listKeys(selectedProviderId.value)
    ]);
    models.value = nextModels;
    keys.value = nextKeys;
    const provider = providers.value.find((item) => item.id === selectedProviderId.value);
    if (provider?.defaultEndpoint) {
        endpoint.value = provider.defaultEndpoint;
    }
    if (!enabledModels.value.some((item) => item.code === selectedModel.value)) {
        selectedModel.value = enabledModels.value[0]?.code ?? '';
    }
    if (!enabledKeys.value.some((item) => item.id === selectedKeyId.value)) {
        selectedKeyId.value = '';
    }
}
function onToken(token) {
    streamingRaw.value += token;
    const next = splitStreaming(streamingRaw.value);
    streamingText.value = next.content;
    streamingThinking.value = next.thinking;
}
function onStatus(next) {
    status.value = next;
}
function onCompleted(reason) {
    status.value = `completed (${reason})`;
}
function onError(message) {
    status.value = 'error';
    errorMessage.value = message;
    ElMessage.error(message);
}
function onRunEvent(event) {
    runEvents.value = [...runEvents.value, event].slice(-12);
}
async function send() {
    if (!selectedSessionId.value) {
        await createSession(mode.value);
    }
    if (!selectedSessionId.value)
        return;
    if (!input.value.trim()) {
        ElMessage.warning(t('aiAssistant.messages.enterMessage'));
        return;
    }
    if (!endpoint.value || !selectedModel.value) {
        ElMessage.warning(t('aiAssistant.messages.endpointModelRequired'));
        return;
    }
    if (useSavedKey.value && !selectedProviderId.value) {
        ElMessage.warning(t('aiAssistant.messages.selectProviderFirst'));
        return;
    }
    if (!useSavedKey.value && !tempKey.value.trim()) {
        ElMessage.warning(t('aiAssistant.messages.tempKeyRequired'));
        return;
    }
    const text = input.value.trim();
    input.value = '';
    streamingText.value = '';
    streamingThinking.value = '';
    streamingRaw.value = '';
    runEvents.value = [];
    errorMessage.value = '';
    sending.value = true;
    const runId = crypto.randomUUID();
    currentRunId.value = runId;
    try {
        await chatHub.joinRun(runId);
        const result = await sendChatMessage(selectedSessionId.value, {
            runId,
            content: text,
            endpoint: endpoint.value,
            model: selectedModel.value,
            providerId: useSavedKey.value ? selectedProviderId.value : null,
            apiKeyId: useSavedKey.value ? (selectedKeyId.value || null) : null,
            apiKey: useSavedKey.value ? null : tempKey.value.trim()
        });
        status.value = `completed (${result.finishReason})`;
        await refreshMessages();
        await refreshSessions();
    }
    catch (err) {
        status.value = 'error';
        errorMessage.value = err.message || t('aiAssistant.messages.sendFailed');
        ElMessage.error(errorMessage.value);
    }
    finally {
        sending.value = false;
        await chatHub.leaveRun(runId);
        currentRunId.value = '';
    }
}
async function executePlan(message) {
    if (!selectedSessionId.value)
        return;
    if (executingMessageId.value) {
        ElMessage.warning(t('aiAssistant.messages.executingAnother'));
        return;
    }
    const runId = crypto.randomUUID();
    currentRunId.value = runId;
    executingMessageId.value = message.id;
    streamingText.value = '';
    streamingThinking.value = '';
    streamingRaw.value = '';
    runEvents.value = [];
    errorMessage.value = '';
    status.value = 'executing';
    try {
        await chatHub.joinRun(runId);
        const result = await executeChatPlan(selectedSessionId.value, message.id, { runId });
        messages.value = messages.value.map((item) => (item.id === result.message.id ? result.message : item));
        await refreshMessages();
        await refreshSessions();
        status.value = `completed (${result.finishReason})`;
        ElMessage.success(result.finishReason === 'failed'
            ? t('aiAssistant.messages.executeFinishedWithFailures')
            : t('aiAssistant.messages.executeCompleted'));
    }
    catch (err) {
        status.value = 'error';
        errorMessage.value = err.message || t('aiAssistant.messages.executeFailed');
        ElMessage.error(errorMessage.value);
    }
    finally {
        executingMessageId.value = '';
        await chatHub.leaveRun(runId);
        currentRunId.value = '';
    }
}
watch(selectedSessionId, async () => {
    streamingText.value = '';
    streamingThinking.value = '';
    streamingRaw.value = '';
    runEvents.value = [];
    await refreshMessages();
    if (selectedSession.value) {
        mode.value = selectedSession.value.mode;
        titleDraft.value = selectedSession.value.title;
        if (selectedSession.value.providerId)
            selectedProviderId.value = selectedSession.value.providerId;
        if (selectedSession.value.modelCode)
            selectedModel.value = selectedSession.value.modelCode;
    }
});
watch(() => workContext.selectedProjectId, refreshSessions);
watch(selectedProviderId, refreshProviderAssets);
onMounted(async () => {
    chatHub.onToken(onToken);
    chatHub.onStatus(onStatus);
    chatHub.onCompleted(onCompleted);
    chatHub.onError(onError);
    chatHub.onRunEvent(onRunEvent);
    await workContext.init();
    await refreshAiConfig();
    await refreshSessions();
});
onBeforeUnmount(async () => {
    chatHub.offToken(onToken);
    chatHub.offStatus(onStatus);
    chatHub.offCompleted(onCompleted);
    chatHub.offError(onError);
    chatHub.offRunEvent(onRunEvent);
    if (currentRunId.value)
        await chatHub.leaveRun(currentRunId.value);
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['session-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['session-item']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['run-event']} */ ;
/** @type {__VLS_StyleScopedClasses['execution-head']} */ ;
/** @type {__VLS_StyleScopedClasses['execution-head']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-main']} */ ;
/** @type {__VLS_StyleScopedClasses['execution-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-main']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-title']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-detail']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-detail']} */ ;
/** @type {__VLS_StyleScopedClasses['message']} */ ;
/** @type {__VLS_StyleScopedClasses['thinking-block']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-step']} */ ;
/** @type {__VLS_StyleScopedClasses['composer']} */ ;
/** @type {__VLS_StyleScopedClasses['composer']} */ ;
/** @type {__VLS_StyleScopedClasses['assistant-page']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "assistant-page" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.aside, __VLS_intrinsicElements.aside)({
    ...{ class: "session-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-head" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
(__VLS_ctx.t('aiAssistant.title'));
const __VLS_0 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Plus),
    size: "small",
    type: "primary",
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Plus),
    size: "small",
    type: "primary",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_4;
let __VLS_5;
let __VLS_6;
const __VLS_7 = {
    onClick: (...[$event]) => {
        __VLS_ctx.createSession();
    }
};
__VLS_3.slots.default;
(__VLS_ctx.t('aiAssistant.actions.newSession'));
var __VLS_3;
const __VLS_8 = {}.ElSegmented;
/** @type {[typeof __VLS_components.ElSegmented, typeof __VLS_components.elSegmented, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    modelValue: (__VLS_ctx.mode),
    options: ([
        { label: __VLS_ctx.t('aiAssistant.mode.agent'), value: 'agent' },
        { label: __VLS_ctx.t('aiAssistant.mode.plan'), value: 'plan' },
        { label: __VLS_ctx.t('aiAssistant.mode.edit'), value: 'edit' }
    ]),
    block: true,
}));
const __VLS_10 = __VLS_9({
    modelValue: (__VLS_ctx.mode),
    options: ([
        { label: __VLS_ctx.t('aiAssistant.mode.agent'), value: 'agent' },
        { label: __VLS_ctx.t('aiAssistant.mode.plan'), value: 'plan' },
        { label: __VLS_ctx.t('aiAssistant.mode.edit'), value: 'edit' }
    ]),
    block: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "session-list" },
});
__VLS_asFunctionalDirective(__VLS_directives.vLoading)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.loading) }, null, null);
for (const [session] of __VLS_getVForSourceType((__VLS_ctx.sessions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selectedSessionId = session.id;
            } },
        key: (session.id),
        ...{ class: "session-item" },
        ...{ class: ({ active: session.id === __VLS_ctx.selectedSessionId }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "session-title" },
    });
    (session.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "session-meta" },
    });
    (__VLS_ctx.modeLabel(session.mode));
    (__VLS_ctx.formatTime(session.lastMessageAt));
    const __VLS_12 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        ...{ 'onClick': {} },
        text: true,
        type: "danger",
        icon: (__VLS_ctx.Delete),
    }));
    const __VLS_14 = __VLS_13({
        ...{ 'onClick': {} },
        text: true,
        type: "danger",
        icon: (__VLS_ctx.Delete),
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    let __VLS_16;
    let __VLS_17;
    let __VLS_18;
    const __VLS_19 = {
        onClick: (...[$event]) => {
            __VLS_ctx.removeSession(session);
        }
    };
    var __VLS_15;
}
if (__VLS_ctx.sessions.length === 0) {
    const __VLS_20 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        description: (__VLS_ctx.t('aiAssistant.empty.sessions')),
    }));
    const __VLS_22 = __VLS_21({
        description: (__VLS_ctx.t('aiAssistant.empty.sessions')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "chat-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "toolbar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
(__VLS_ctx.selectedSession?.title ?? __VLS_ctx.t('aiAssistant.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.modeLabel(__VLS_ctx.mode));
(__VLS_ctx.status);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "config" },
});
const __VLS_24 = {}.ElSwitch;
/** @type {[typeof __VLS_components.ElSwitch, typeof __VLS_components.elSwitch, ]} */ ;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
    modelValue: (__VLS_ctx.useSavedKey),
    activeText: (__VLS_ctx.t('aiAssistant.switch.savedKey')),
    inactiveText: (__VLS_ctx.t('aiAssistant.switch.temporaryKey')),
}));
const __VLS_26 = __VLS_25({
    modelValue: (__VLS_ctx.useSavedKey),
    activeText: (__VLS_ctx.t('aiAssistant.switch.savedKey')),
    inactiveText: (__VLS_ctx.t('aiAssistant.switch.temporaryKey')),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
const __VLS_28 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    modelValue: (__VLS_ctx.selectedProviderId),
    placeholder: (__VLS_ctx.t('aiAssistant.placeholders.provider')),
    filterable: true,
    ...{ style: {} },
}));
const __VLS_30 = __VLS_29({
    modelValue: (__VLS_ctx.selectedProviderId),
    placeholder: (__VLS_ctx.t('aiAssistant.placeholders.provider')),
    filterable: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
for (const [provider] of __VLS_getVForSourceType((__VLS_ctx.providers))) {
    const __VLS_32 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
        key: (provider.id),
        label: (provider.name),
        value: (provider.id),
    }));
    const __VLS_34 = __VLS_33({
        key: (provider.id),
        label: (provider.name),
        value: (provider.id),
    }, ...__VLS_functionalComponentArgsRest(__VLS_33));
}
var __VLS_31;
if (__VLS_ctx.useSavedKey) {
    const __VLS_36 = {}.ElSelect;
    /** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
        modelValue: (__VLS_ctx.selectedKeyId),
        placeholder: (__VLS_ctx.t('aiAssistant.placeholders.key')),
        clearable: true,
        filterable: true,
        ...{ style: {} },
    }));
    const __VLS_38 = __VLS_37({
        modelValue: (__VLS_ctx.selectedKeyId),
        placeholder: (__VLS_ctx.t('aiAssistant.placeholders.key')),
        clearable: true,
        filterable: true,
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    __VLS_39.slots.default;
    for (const [key] of __VLS_getVForSourceType((__VLS_ctx.enabledKeys))) {
        const __VLS_40 = {}.ElOption;
        /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
        // @ts-ignore
        const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
            key: (key.id),
            label: (`${key.name}${key.maskedTail ? ` / ${key.maskedTail}` : ''}`),
            value: (key.id),
        }));
        const __VLS_42 = __VLS_41({
            key: (key.id),
            label: (`${key.name}${key.maskedTail ? ` / ${key.maskedTail}` : ''}`),
            value: (key.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_41));
    }
    var __VLS_39;
}
else {
    const __VLS_44 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
        modelValue: (__VLS_ctx.tempKey),
        type: "password",
        showPassword: true,
        placeholder: (__VLS_ctx.t('aiAssistant.placeholders.apiKey')),
        ...{ style: {} },
    }));
    const __VLS_46 = __VLS_45({
        modelValue: (__VLS_ctx.tempKey),
        type: "password",
        showPassword: true,
        placeholder: (__VLS_ctx.t('aiAssistant.placeholders.apiKey')),
        ...{ style: {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_45));
}
const __VLS_48 = {}.ElSelect;
/** @type {[typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, typeof __VLS_components.ElSelect, typeof __VLS_components.elSelect, ]} */ ;
// @ts-ignore
const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
    modelValue: (__VLS_ctx.selectedModel),
    placeholder: (__VLS_ctx.t('aiAssistant.placeholders.model')),
    filterable: true,
    allowCreate: true,
    ...{ style: {} },
}));
const __VLS_50 = __VLS_49({
    modelValue: (__VLS_ctx.selectedModel),
    placeholder: (__VLS_ctx.t('aiAssistant.placeholders.model')),
    filterable: true,
    allowCreate: true,
    ...{ style: {} },
}, ...__VLS_functionalComponentArgsRest(__VLS_49));
__VLS_51.slots.default;
for (const [model] of __VLS_getVForSourceType((__VLS_ctx.enabledModels))) {
    const __VLS_52 = {}.ElOption;
    /** @type {[typeof __VLS_components.ElOption, typeof __VLS_components.elOption, ]} */ ;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
        key: (model.id),
        label: (model.code),
        value: (model.code),
    }));
    const __VLS_54 = __VLS_53({
        key: (model.id),
        label: (model.code),
        value: (model.code),
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
}
var __VLS_51;
const __VLS_56 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
}));
const __VLS_58 = __VLS_57({
    ...{ 'onClick': {} },
    icon: (__VLS_ctx.Refresh),
}, ...__VLS_functionalComponentArgsRest(__VLS_57));
let __VLS_60;
let __VLS_61;
let __VLS_62;
const __VLS_63 = {
    onClick: (__VLS_ctx.refreshAiConfig)
};
var __VLS_59;
if (__VLS_ctx.selectedSession) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "session-settings" },
    });
    const __VLS_64 = {}.ElInput;
    /** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
    // @ts-ignore
    const __VLS_65 = __VLS_asFunctionalComponent(__VLS_64, new __VLS_64({
        modelValue: (__VLS_ctx.titleDraft),
        placeholder: (__VLS_ctx.t('aiAssistant.placeholders.sessionTitle')),
    }));
    const __VLS_66 = __VLS_65({
        modelValue: (__VLS_ctx.titleDraft),
        placeholder: (__VLS_ctx.t('aiAssistant.placeholders.sessionTitle')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_65));
    const __VLS_68 = {}.ElButton;
    /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent(__VLS_68, new __VLS_68({
        ...{ 'onClick': {} },
        loading: (__VLS_ctx.savingSession),
    }));
    const __VLS_70 = __VLS_69({
        ...{ 'onClick': {} },
        loading: (__VLS_ctx.savingSession),
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    let __VLS_72;
    let __VLS_73;
    let __VLS_74;
    const __VLS_75 = {
        onClick: (__VLS_ctx.saveSessionSettings)
    };
    __VLS_71.slots.default;
    (__VLS_ctx.t('aiAssistant.actions.saveSettings'));
    var __VLS_71;
}
const __VLS_76 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent(__VLS_76, new __VLS_76({
    modelValue: (__VLS_ctx.endpoint),
    placeholder: (__VLS_ctx.t('aiAssistant.placeholders.endpoint')),
}));
const __VLS_78 = __VLS_77({
    modelValue: (__VLS_ctx.endpoint),
    placeholder: (__VLS_ctx.t('aiAssistant.placeholders.endpoint')),
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
if (__VLS_ctx.errorMessage) {
    const __VLS_80 = {}.ElAlert;
    /** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
    // @ts-ignore
    const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({
        ...{ 'onClose': {} },
        title: (__VLS_ctx.errorMessage),
        type: "error",
        showIcon: true,
        closable: (true),
    }));
    const __VLS_82 = __VLS_81({
        ...{ 'onClose': {} },
        title: (__VLS_ctx.errorMessage),
        type: "error",
        showIcon: true,
        closable: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_81));
    let __VLS_84;
    let __VLS_85;
    let __VLS_86;
    const __VLS_87 = {
        onClose: (...[$event]) => {
            if (!(__VLS_ctx.errorMessage))
                return;
            __VLS_ctx.errorMessage = '';
        }
    };
    var __VLS_83;
}
if (__VLS_ctx.runEvents.length > 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "run-events" },
    });
    for (const [event] of __VLS_getVForSourceType((__VLS_ctx.runEvents))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (`${event.at}-${event.type}`),
            ...{ class: "run-event" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "event-time" },
        });
        (__VLS_ctx.formatEventTime(event.at));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (event.message);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (event.type);
    }
}
if (__VLS_ctx.liveToolCalls.length > 0 || __VLS_ctx.hasLiveExecutionEvents) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
        ...{ class: "execution-panel" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "execution-head" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (__VLS_ctx.t('aiAssistant.labels.executionTrace'));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (__VLS_ctx.liveToolCalls.length > 0 ? __VLS_ctx.t('aiAssistant.labels.rows', { count: __VLS_ctx.liveToolCalls.length }) : __VLS_ctx.t('aiAssistant.labels.waitingToolDetails'));
    if (__VLS_ctx.liveTraceSummary) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "execution-summary" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.formatTraceSummary(__VLS_ctx.liveTraceSummary));
        if (__VLS_ctx.liveTraceSummary.failedStepSummaries?.length) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (__VLS_ctx.liveTraceSummary.failedStepSummaries.join(' / '));
        }
    }
    if (__VLS_ctx.liveToolCalls.length === 0) {
        const __VLS_88 = {}.ElEmpty;
        /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
        // @ts-ignore
        const __VLS_89 = __VLS_asFunctionalComponent(__VLS_88, new __VLS_88({
            description: (__VLS_ctx.t('aiAssistant.empty.toolDetails')),
        }));
        const __VLS_90 = __VLS_89({
            description: (__VLS_ctx.t('aiAssistant.empty.toolDetails')),
        }, ...__VLS_functionalComponentArgsRest(__VLS_89));
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "tool-call-list" },
        });
        for (const [call] of __VLS_getVForSourceType((__VLS_ctx.liveToolCalls))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (call.key),
                ...{ class: "tool-call" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "tool-call-main" },
            });
            const __VLS_92 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({
                size: "small",
                type: (__VLS_ctx.toolCallStatusTag(call.status)),
            }));
            const __VLS_94 = __VLS_93({
                size: "small",
                type: (__VLS_ctx.toolCallStatusTag(call.status)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_93));
            __VLS_95.slots.default;
            (__VLS_ctx.toolCallStatusLabel(call.status));
            var __VLS_95;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (__VLS_ctx.toolCallName(call));
            if (call.stepIndex != null) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (call.stepIndex);
            }
            if (__VLS_ctx.formatToolDuration(call)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (__VLS_ctx.formatToolDuration(call));
            }
            if (call.title && call.title !== __VLS_ctx.toolCallName(call)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                    ...{ class: "tool-call-title" },
                });
                (call.title);
            }
            else if (call.fallbackTitle) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                    ...{ class: "tool-call-title" },
                });
                (call.fallbackTitle);
            }
            if (call.description) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                    ...{ class: "tool-call-title" },
                });
                (call.description);
            }
            if (__VLS_ctx.formatToolValue(call.arguments) || __VLS_ctx.formatToolValue(call.result) || call.errorMessage) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "tool-call-detail" },
                });
                if (__VLS_ctx.formatToolValue(call.arguments)) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.t('aiAssistant.labels.arguments'));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
                    (__VLS_ctx.formatToolValue(call.arguments));
                }
                if (__VLS_ctx.formatToolValue(call.result)) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.t('aiAssistant.labels.result'));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
                    (__VLS_ctx.formatToolValue(call.result));
                }
                if (call.errorMessage) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "tool-call-error" },
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.t('aiAssistant.labels.error'));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
                    (call.errorMessage);
                }
            }
        }
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "messages" },
});
if (__VLS_ctx.visibleMessages.length === 0) {
    const __VLS_96 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_97 = __VLS_asFunctionalComponent(__VLS_96, new __VLS_96({
        description: (__VLS_ctx.t('aiAssistant.empty.messages')),
    }));
    const __VLS_98 = __VLS_97({
        description: (__VLS_ctx.t('aiAssistant.empty.messages')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_97));
}
for (const [message] of __VLS_getVForSourceType((__VLS_ctx.visibleMessages))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.article, __VLS_intrinsicElements.article)({
        key: (message.id),
        ...{ class: "message" },
        ...{ class: (message.role) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "role" },
    });
    const __VLS_100 = {}.ElIcon;
    /** @type {[typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, typeof __VLS_components.ElIcon, typeof __VLS_components.elIcon, ]} */ ;
    // @ts-ignore
    const __VLS_101 = __VLS_asFunctionalComponent(__VLS_100, new __VLS_100({}));
    const __VLS_102 = __VLS_101({}, ...__VLS_functionalComponentArgsRest(__VLS_101));
    __VLS_103.slots.default;
    const __VLS_104 = {}.ChatLineRound;
    /** @type {[typeof __VLS_components.ChatLineRound, ]} */ ;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({}));
    const __VLS_106 = __VLS_105({}, ...__VLS_functionalComponentArgsRest(__VLS_105));
    var __VLS_103;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (message.role);
    if (message.summary && message.summary !== message.content) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "message-summary" },
        });
        (message.summary);
    }
    if (message.thinkingContent) {
        const __VLS_108 = {}.ElCollapse;
        /** @type {[typeof __VLS_components.ElCollapse, typeof __VLS_components.elCollapse, typeof __VLS_components.ElCollapse, typeof __VLS_components.elCollapse, ]} */ ;
        // @ts-ignore
        const __VLS_109 = __VLS_asFunctionalComponent(__VLS_108, new __VLS_108({}));
        const __VLS_110 = __VLS_109({}, ...__VLS_functionalComponentArgsRest(__VLS_109));
        __VLS_111.slots.default;
        const __VLS_112 = {}.ElCollapseItem;
        /** @type {[typeof __VLS_components.ElCollapseItem, typeof __VLS_components.elCollapseItem, typeof __VLS_components.ElCollapseItem, typeof __VLS_components.elCollapseItem, ]} */ ;
        // @ts-ignore
        const __VLS_113 = __VLS_asFunctionalComponent(__VLS_112, new __VLS_112({
            title: (__VLS_ctx.t('aiAssistant.thinking')),
            name: (message.id),
        }));
        const __VLS_114 = __VLS_113({
            title: (__VLS_ctx.t('aiAssistant.thinking')),
            name: (message.id),
        }, ...__VLS_functionalComponentArgsRest(__VLS_113));
        __VLS_115.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
        (message.thinkingContent);
        var __VLS_115;
        var __VLS_111;
    }
    if (__VLS_ctx.thinkingBlocks(message).length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "thinking-blocks" },
        });
        for (const [block] of __VLS_getVForSourceType((__VLS_ctx.thinkingBlocks(message)))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (block.index),
                ...{ class: "thinking-block" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (block.title);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
            (block.detail);
        }
    }
    if (__VLS_ctx.payloadMeta(message)?.directive || __VLS_ctx.payloadMeta(message)?.normalization || __VLS_ctx.payloadMeta(message)?.chapterRange) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "payload-tags" },
        });
        if (__VLS_ctx.payloadMeta(message)?.targetPanel) {
            const __VLS_116 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_117 = __VLS_asFunctionalComponent(__VLS_116, new __VLS_116({
                size: "small",
                type: "info",
            }));
            const __VLS_118 = __VLS_117({
                size: "small",
                type: "info",
            }, ...__VLS_functionalComponentArgsRest(__VLS_117));
            __VLS_119.slots.default;
            (__VLS_ctx.targetPanelLabel(__VLS_ctx.payloadMeta(message)?.targetPanel));
            var __VLS_119;
        }
        if (__VLS_ctx.payloadMeta(message)?.requiresExecutionEngine) {
            const __VLS_120 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_121 = __VLS_asFunctionalComponent(__VLS_120, new __VLS_120({
                size: "small",
                type: "danger",
            }));
            const __VLS_122 = __VLS_121({
                size: "small",
                type: "danger",
            }, ...__VLS_functionalComponentArgsRest(__VLS_121));
            __VLS_123.slots.default;
            (__VLS_ctx.t('aiAssistant.labels.executionRequired'));
            var __VLS_123;
        }
        if (__VLS_ctx.payloadMeta(message)?.normalization) {
            const __VLS_124 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_125 = __VLS_asFunctionalComponent(__VLS_124, new __VLS_124({
                size: "small",
                type: "success",
            }));
            const __VLS_126 = __VLS_125({
                size: "small",
                type: "success",
            }, ...__VLS_functionalComponentArgsRest(__VLS_125));
            __VLS_127.slots.default;
            (__VLS_ctx.normalizationLabel(__VLS_ctx.payloadMeta(message)?.normalization));
            var __VLS_127;
        }
        if (__VLS_ctx.payloadMeta(message)?.chapterRange) {
            const __VLS_128 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_129 = __VLS_asFunctionalComponent(__VLS_128, new __VLS_128({
                size: "small",
                type: "warning",
            }));
            const __VLS_130 = __VLS_129({
                size: "small",
                type: "warning",
            }, ...__VLS_functionalComponentArgsRest(__VLS_129));
            __VLS_131.slots.default;
            (__VLS_ctx.t('aiAssistant.labels.chapters', { start: __VLS_ctx.payloadMeta(message)?.chapterRange?.start, end: __VLS_ctx.payloadMeta(message)?.chapterRange?.end }));
            var __VLS_131;
        }
        if (__VLS_ctx.payloadMeta(message)?.directive) {
            const __VLS_132 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_133 = __VLS_asFunctionalComponent(__VLS_132, new __VLS_132({
                size: "small",
            }));
            const __VLS_134 = __VLS_133({
                size: "small",
            }, ...__VLS_functionalComponentArgsRest(__VLS_133));
            __VLS_135.slots.default;
            (__VLS_ctx.directiveLabel(__VLS_ctx.payloadMeta(message)?.directive?.kind));
            (__VLS_ctx.payloadMeta(message)?.directive?.chapterId);
            var __VLS_135;
        }
    }
    if (__VLS_ctx.planSteps(message).length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "plan-steps" },
        });
        if (__VLS_ctx.canExecutePlan(message)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "plan-actions" },
            });
            const __VLS_136 = {}.ElButton;
            /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
            // @ts-ignore
            const __VLS_137 = __VLS_asFunctionalComponent(__VLS_136, new __VLS_136({
                ...{ 'onClick': {} },
                type: "primary",
                size: "small",
                loading: (__VLS_ctx.executingMessageId === message.id),
                disabled: (__VLS_ctx.sending || (!!__VLS_ctx.executingMessageId && __VLS_ctx.executingMessageId !== message.id)),
            }));
            const __VLS_138 = __VLS_137({
                ...{ 'onClick': {} },
                type: "primary",
                size: "small",
                loading: (__VLS_ctx.executingMessageId === message.id),
                disabled: (__VLS_ctx.sending || (!!__VLS_ctx.executingMessageId && __VLS_ctx.executingMessageId !== message.id)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_137));
            let __VLS_140;
            let __VLS_141;
            let __VLS_142;
            const __VLS_143 = {
                onClick: (...[$event]) => {
                    if (!(__VLS_ctx.planSteps(message).length > 0))
                        return;
                    if (!(__VLS_ctx.canExecutePlan(message)))
                        return;
                    __VLS_ctx.executePlan(message);
                }
            };
            __VLS_139.slots.default;
            (__VLS_ctx.t('aiAssistant.actions.executePlan'));
            var __VLS_139;
        }
        for (const [step] of __VLS_getVForSourceType((__VLS_ctx.planSteps(message)))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (step.index),
                ...{ class: "plan-step" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "step-index" },
            });
            (step.index);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "step-title" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (step.title);
            if (step.chapterNumber) {
                const __VLS_144 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_145 = __VLS_asFunctionalComponent(__VLS_144, new __VLS_144({
                    size: "small",
                    type: "info",
                }));
                const __VLS_146 = __VLS_145({
                    size: "small",
                    type: "info",
                }, ...__VLS_functionalComponentArgsRest(__VLS_145));
                __VLS_147.slots.default;
                (__VLS_ctx.t('aiAssistant.labels.chapter', { value: step.chapterNumber }));
                var __VLS_147;
            }
            if (step.continueFromChapterId) {
                const __VLS_148 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_149 = __VLS_asFunctionalComponent(__VLS_148, new __VLS_148({
                    size: "small",
                }));
                const __VLS_150 = __VLS_149({
                    size: "small",
                }, ...__VLS_functionalComponentArgsRest(__VLS_149));
                __VLS_151.slots.default;
                (__VLS_ctx.t('aiAssistant.labels.continue', { value: step.continueFromChapterId }));
                var __VLS_151;
            }
            if (step.rewriteTargetChapterId) {
                const __VLS_152 = {}.ElTag;
                /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
                // @ts-ignore
                const __VLS_153 = __VLS_asFunctionalComponent(__VLS_152, new __VLS_152({
                    size: "small",
                    type: "warning",
                }));
                const __VLS_154 = __VLS_153({
                    size: "small",
                    type: "warning",
                }, ...__VLS_functionalComponentArgsRest(__VLS_153));
                __VLS_155.slots.default;
                (__VLS_ctx.t('aiAssistant.labels.rewrite', { value: step.rewriteTargetChapterId }));
                var __VLS_155;
            }
            if (step.detail) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
                (step.detail);
            }
        }
    }
    if (__VLS_ctx.payloadToolCalls(message).length > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "execution-panel message-execution" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "execution-head" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (__VLS_ctx.t('aiAssistant.labels.executionTraceWithTools'));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (__VLS_ctx.t('aiAssistant.labels.rows', { count: __VLS_ctx.payloadToolCalls(message).length }));
        if (__VLS_ctx.payloadTraceSummary(message)) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "execution-summary" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
            (__VLS_ctx.formatTraceSummary(__VLS_ctx.payloadTraceSummary(message)));
            if (__VLS_ctx.payloadTraceSummary(message)?.failedStepSummaries?.length) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (__VLS_ctx.payloadTraceSummary(message)?.failedStepSummaries?.join(' / '));
            }
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "tool-call-list" },
        });
        for (const [call] of __VLS_getVForSourceType((__VLS_ctx.payloadToolCalls(message)))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (call.key),
                ...{ class: "tool-call" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "tool-call-main" },
            });
            const __VLS_156 = {}.ElTag;
            /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
            // @ts-ignore
            const __VLS_157 = __VLS_asFunctionalComponent(__VLS_156, new __VLS_156({
                size: "small",
                type: (__VLS_ctx.toolCallStatusTag(call.status)),
            }));
            const __VLS_158 = __VLS_157({
                size: "small",
                type: (__VLS_ctx.toolCallStatusTag(call.status)),
            }, ...__VLS_functionalComponentArgsRest(__VLS_157));
            __VLS_159.slots.default;
            (__VLS_ctx.toolCallStatusLabel(call.status));
            var __VLS_159;
            __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
            (__VLS_ctx.toolCallName(call));
            if (call.stepIndex != null) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (call.stepIndex);
            }
            if (__VLS_ctx.formatToolDuration(call)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                (__VLS_ctx.formatToolDuration(call));
            }
            if (call.title && call.title !== __VLS_ctx.toolCallName(call)) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                    ...{ class: "tool-call-title" },
                });
                (call.title);
            }
            if (call.description) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
                    ...{ class: "tool-call-title" },
                });
                (call.description);
            }
            if (__VLS_ctx.formatToolValue(call.arguments) || __VLS_ctx.formatToolValue(call.result) || call.errorMessage) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "tool-call-detail" },
                });
                if (__VLS_ctx.formatToolValue(call.arguments)) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.t('aiAssistant.labels.arguments'));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
                    (__VLS_ctx.formatToolValue(call.arguments));
                }
                if (__VLS_ctx.formatToolValue(call.result)) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.t('aiAssistant.labels.result'));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
                    (__VLS_ctx.formatToolValue(call.result));
                }
                if (call.errorMessage) {
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                        ...{ class: "tool-call-error" },
                    });
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
                    (__VLS_ctx.t('aiAssistant.labels.error'));
                    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
                    (call.errorMessage);
                }
            }
        }
    }
    if (__VLS_ctx.shouldShowRawContent(message)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
        (message.content);
    }
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.footer, __VLS_intrinsicElements.footer)({
    ...{ class: "composer" },
});
const __VLS_160 = {}.ElInput;
/** @type {[typeof __VLS_components.ElInput, typeof __VLS_components.elInput, ]} */ ;
// @ts-ignore
const __VLS_161 = __VLS_asFunctionalComponent(__VLS_160, new __VLS_160({
    ...{ 'onKeydown': {} },
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.input),
    type: "textarea",
    rows: (4),
    resize: "none",
    placeholder: (__VLS_ctx.t('aiAssistant.placeholders.composer')),
}));
const __VLS_162 = __VLS_161({
    ...{ 'onKeydown': {} },
    ...{ 'onKeydown': {} },
    modelValue: (__VLS_ctx.input),
    type: "textarea",
    rows: (4),
    resize: "none",
    placeholder: (__VLS_ctx.t('aiAssistant.placeholders.composer')),
}, ...__VLS_functionalComponentArgsRest(__VLS_161));
let __VLS_164;
let __VLS_165;
let __VLS_166;
const __VLS_167 = {
    onKeydown: (__VLS_ctx.send)
};
const __VLS_168 = {
    onKeydown: (__VLS_ctx.send)
};
var __VLS_163;
const __VLS_169 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_170 = __VLS_asFunctionalComponent(__VLS_169, new __VLS_169({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.Promotion),
    loading: (__VLS_ctx.sending),
}));
const __VLS_171 = __VLS_170({
    ...{ 'onClick': {} },
    type: "primary",
    icon: (__VLS_ctx.Promotion),
    loading: (__VLS_ctx.sending),
}, ...__VLS_functionalComponentArgsRest(__VLS_170));
let __VLS_173;
let __VLS_174;
let __VLS_175;
const __VLS_176 = {
    onClick: (__VLS_ctx.send)
};
__VLS_172.slots.default;
(__VLS_ctx.t('aiAssistant.actions.send'));
var __VLS_172;
/** @type {__VLS_StyleScopedClasses['assistant-page']} */ ;
/** @type {__VLS_StyleScopedClasses['session-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-head']} */ ;
/** @type {__VLS_StyleScopedClasses['session-list']} */ ;
/** @type {__VLS_StyleScopedClasses['session-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['session-title']} */ ;
/** @type {__VLS_StyleScopedClasses['session-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['chat-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['config']} */ ;
/** @type {__VLS_StyleScopedClasses['session-settings']} */ ;
/** @type {__VLS_StyleScopedClasses['run-events']} */ ;
/** @type {__VLS_StyleScopedClasses['run-event']} */ ;
/** @type {__VLS_StyleScopedClasses['event-time']} */ ;
/** @type {__VLS_StyleScopedClasses['execution-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['execution-head']} */ ;
/** @type {__VLS_StyleScopedClasses['execution-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-list']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-main']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-title']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-title']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-title']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-detail']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-error']} */ ;
/** @type {__VLS_StyleScopedClasses['messages']} */ ;
/** @type {__VLS_StyleScopedClasses['message']} */ ;
/** @type {__VLS_StyleScopedClasses['role']} */ ;
/** @type {__VLS_StyleScopedClasses['message-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['thinking-blocks']} */ ;
/** @type {__VLS_StyleScopedClasses['thinking-block']} */ ;
/** @type {__VLS_StyleScopedClasses['payload-tags']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-steps']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-actions']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-step']} */ ;
/** @type {__VLS_StyleScopedClasses['step-index']} */ ;
/** @type {__VLS_StyleScopedClasses['step-title']} */ ;
/** @type {__VLS_StyleScopedClasses['execution-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['message-execution']} */ ;
/** @type {__VLS_StyleScopedClasses['execution-head']} */ ;
/** @type {__VLS_StyleScopedClasses['execution-summary']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-list']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-main']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-title']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-title']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-detail']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-call-error']} */ ;
/** @type {__VLS_StyleScopedClasses['composer']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            ChatLineRound: ChatLineRound,
            Delete: Delete,
            Plus: Plus,
            Promotion: Promotion,
            Refresh: Refresh,
            t: t,
            sessions: sessions,
            selectedSessionId: selectedSessionId,
            providers: providers,
            selectedProviderId: selectedProviderId,
            selectedModel: selectedModel,
            selectedKeyId: selectedKeyId,
            endpoint: endpoint,
            tempKey: tempKey,
            useSavedKey: useSavedKey,
            mode: mode,
            input: input,
            errorMessage: errorMessage,
            status: status,
            loading: loading,
            sending: sending,
            savingSession: savingSession,
            executingMessageId: executingMessageId,
            titleDraft: titleDraft,
            runEvents: runEvents,
            selectedSession: selectedSession,
            enabledModels: enabledModels,
            enabledKeys: enabledKeys,
            liveToolCalls: liveToolCalls,
            liveTraceSummary: liveTraceSummary,
            hasLiveExecutionEvents: hasLiveExecutionEvents,
            visibleMessages: visibleMessages,
            modeLabel: modeLabel,
            formatTime: formatTime,
            formatEventTime: formatEventTime,
            payloadToolCalls: payloadToolCalls,
            payloadTraceSummary: payloadTraceSummary,
            planSteps: planSteps,
            thinkingBlocks: thinkingBlocks,
            payloadMeta: payloadMeta,
            canExecutePlan: canExecutePlan,
            toolCallStatusLabel: toolCallStatusLabel,
            toolCallStatusTag: toolCallStatusTag,
            toolCallName: toolCallName,
            formatToolValue: formatToolValue,
            formatToolDuration: formatToolDuration,
            formatTraceSummary: formatTraceSummary,
            shouldShowRawContent: shouldShowRawContent,
            normalizationLabel: normalizationLabel,
            directiveLabel: directiveLabel,
            targetPanelLabel: targetPanelLabel,
            createSession: createSession,
            saveSessionSettings: saveSessionSettings,
            removeSession: removeSession,
            refreshAiConfig: refreshAiConfig,
            send: send,
            executePlan: executePlan,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
