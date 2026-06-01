import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from '@/composables/useI18n';
import { createNotification, listNotifications, markNotificationRead } from '@/api/modules/notifications';
const checking = ref(false);
const requesting = ref(false);
const sending = ref(false);
const loadingHistory = ref(false);
const { t } = useI18n();
const lastAction = ref(t('notifications.messages.notRequested'));
const permission = ref('default');
const notifications = ref([]);
const supported = computed(() => typeof window !== 'undefined' && 'Notification' in window);
const permissionLabel = computed(() => {
    if (permission.value === 'granted')
        return t('notifications.permissionState.granted');
    if (permission.value === 'denied')
        return t('notifications.permissionState.denied');
    if (permission.value === 'unsupported')
        return t('notifications.permissionState.unsupported');
    return t('notifications.permissionState.default');
});
const permissionType = computed(() => {
    if (permission.value === 'granted')
        return 'success';
    if (permission.value === 'denied')
        return 'danger';
    if (permission.value === 'unsupported')
        return 'info';
    return 'warning';
});
watch(() => t('notifications.messages.notRequested'), (value, previous) => {
    if (lastAction.value === previous) {
        lastAction.value = value;
    }
});
function refreshPermission() {
    checking.value = true;
    try {
        permission.value = supported.value ? Notification.permission : 'unsupported';
    }
    finally {
        checking.value = false;
    }
}
async function loadNotifications() {
    loadingHistory.value = true;
    try {
        notifications.value = await listNotifications({ take: 20 });
    }
    catch (error) {
        ElMessage.error(error instanceof Error ? error.message : t('notifications.messages.loadFailed'));
    }
    finally {
        loadingHistory.value = false;
    }
}
async function requestPermission() {
    if (!supported.value) {
        lastAction.value = t('notifications.messages.unsupported');
        ElMessage.warning(lastAction.value);
        return;
    }
    requesting.value = true;
    try {
        const result = await Notification.requestPermission();
        permission.value = result;
        lastAction.value = t('notifications.messages.permissionFinished', { result });
        ElMessage.success(lastAction.value);
    }
    catch (error) {
        lastAction.value = error instanceof Error ? error.message : t('notifications.messages.permissionFailed');
        ElMessage.error(lastAction.value);
    }
    finally {
        requesting.value = false;
    }
}
async function sendTestNotification() {
    if (!supported.value) {
        lastAction.value = t('notifications.messages.browserUnavailable');
        ElMessage.warning(lastAction.value);
        return;
    }
    if (Notification.permission !== 'granted') {
        lastAction.value = t('notifications.messages.grantFirst');
        ElMessage.warning(lastAction.value);
        return;
    }
    sending.value = true;
    try {
        const saved = await createNotification({
            type: 'info',
            title: t('notifications.messages.testTitle'),
            body: t('notifications.messages.testBody'),
            routeLink: '/settings/notifications'
        });
        const notification = new Notification(t('notifications.messages.testTitle'), {
            body: t('notifications.messages.testBody'),
            tag: 'tm-web-stage-10-test',
            requireInteraction: false
        });
        notification.onclick = () => {
            window.focus();
            notification.close();
        };
        lastAction.value = t('notifications.messages.sentAt', { time: new Date().toLocaleTimeString() });
        notifications.value = [saved, ...notifications.value];
        ElMessage.success(lastAction.value);
    }
    catch (error) {
        lastAction.value = error instanceof Error ? error.message : t('notifications.messages.sendFailed');
        ElMessage.error(lastAction.value);
    }
    finally {
        sending.value = false;
    }
}
async function toggleRead(item) {
    try {
        const result = await markNotificationRead(item.id, { isRead: !item.isRead });
        notifications.value = notifications.value.map((row) => row.id === item.id
            ? { ...row, isRead: result.isRead, readAt: result.readAt, updatedAt: result.updatedAt }
            : row);
    }
    catch (error) {
        ElMessage.error(error instanceof Error ? error.message : t('notifications.messages.updateFailed'));
    }
}
onMounted(() => {
    refreshPermission();
    void loadNotifications();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['hero-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['history-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['history-body']} */ ;
/** @type {__VLS_StyleScopedClasses['history-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['span-2']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "notifications-view" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "hero tm-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "hero-copy" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "eyebrow" },
});
(__VLS_ctx.t('notifications.eyebrow'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
(__VLS_ctx.t('notifications.title'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
(__VLS_ctx.t('notifications.description'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-top" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "status-label" },
});
(__VLS_ctx.t('notifications.statusCard.title'));
const __VLS_0 = {}.ElTag;
/** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    type: (__VLS_ctx.permissionType),
    effect: "plain",
}));
const __VLS_2 = __VLS_1({
    type: (__VLS_ctx.permissionType),
    effect: "plain",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
(__VLS_ctx.permissionLabel);
var __VLS_3;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-line" },
});
(__VLS_ctx.t('notifications.statusCard.support', { value: __VLS_ctx.supported ? __VLS_ctx.t('notifications.statusCard.available') : __VLS_ctx.t('notifications.statusCard.unavailable') }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "status-line" },
});
(__VLS_ctx.t('notifications.statusCard.lastAction', { value: __VLS_ctx.lastAction }));
__VLS_asFunctionalElement(__VLS_intrinsicElements.section, __VLS_intrinsicElements.section)({
    ...{ class: "grid" },
});
const __VLS_4 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    shadow: "never",
    ...{ class: "panel" },
}));
const __VLS_6 = __VLS_5({
    shadow: "never",
    ...{ class: "panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_7.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_7.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
    (__VLS_ctx.t('notifications.permission.title'));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-stack" },
});
const __VLS_8 = {}.ElAlert;
/** @type {[typeof __VLS_components.ElAlert, typeof __VLS_components.elAlert, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    title: (__VLS_ctx.supported ? __VLS_ctx.t('notifications.permission.canRequest') : __VLS_ctx.t('notifications.permission.unsupported')),
    type: (__VLS_ctx.supported ? 'info' : 'warning'),
    closable: (false),
    showIcon: true,
}));
const __VLS_10 = __VLS_9({
    title: (__VLS_ctx.supported ? __VLS_ctx.t('notifications.permission.canRequest') : __VLS_ctx.t('notifications.permission.unsupported')),
    type: (__VLS_ctx.supported ? 'info' : 'warning'),
    closable: (false),
    showIcon: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "actions" },
});
const __VLS_12 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.checking),
}));
const __VLS_14 = __VLS_13({
    ...{ 'onClick': {} },
    loading: (__VLS_ctx.checking),
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
let __VLS_16;
let __VLS_17;
let __VLS_18;
const __VLS_19 = {
    onClick: (__VLS_ctx.refreshPermission)
};
__VLS_15.slots.default;
(__VLS_ctx.t('notifications.permission.refresh'));
var __VLS_15;
const __VLS_20 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.requesting),
}));
const __VLS_22 = __VLS_21({
    ...{ 'onClick': {} },
    type: "primary",
    loading: (__VLS_ctx.requesting),
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
let __VLS_24;
let __VLS_25;
let __VLS_26;
const __VLS_27 = {
    onClick: (__VLS_ctx.requestPermission)
};
__VLS_23.slots.default;
(__VLS_ctx.t('notifications.permission.request'));
var __VLS_23;
var __VLS_7;
const __VLS_28 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
    shadow: "never",
    ...{ class: "panel" },
}));
const __VLS_30 = __VLS_29({
    shadow: "never",
    ...{ class: "panel" },
}, ...__VLS_functionalComponentArgsRest(__VLS_29));
__VLS_31.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_31.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
    (__VLS_ctx.t('notifications.delivery.title'));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-stack" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "muted" },
});
(__VLS_ctx.t('notifications.delivery.hint'));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "actions" },
});
const __VLS_32 = {}.ElButton;
/** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
    ...{ 'onClick': {} },
    type: "success",
    disabled: (__VLS_ctx.permission !== 'granted'),
    loading: (__VLS_ctx.sending),
}));
const __VLS_34 = __VLS_33({
    ...{ 'onClick': {} },
    type: "success",
    disabled: (__VLS_ctx.permission !== 'granted'),
    loading: (__VLS_ctx.sending),
}, ...__VLS_functionalComponentArgsRest(__VLS_33));
let __VLS_36;
let __VLS_37;
let __VLS_38;
const __VLS_39 = {
    onClick: (__VLS_ctx.sendTestNotification)
};
__VLS_35.slots.default;
(__VLS_ctx.t('notifications.delivery.send'));
var __VLS_35;
var __VLS_31;
const __VLS_40 = {}.ElCard;
/** @type {[typeof __VLS_components.ElCard, typeof __VLS_components.elCard, typeof __VLS_components.ElCard, typeof __VLS_components.elCard, ]} */ ;
// @ts-ignore
const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
    shadow: "never",
    ...{ class: "panel span-2" },
}));
const __VLS_42 = __VLS_41({
    shadow: "never",
    ...{ class: "panel span-2" },
}, ...__VLS_functionalComponentArgsRest(__VLS_41));
__VLS_43.slots.default;
{
    const { header: __VLS_thisSlot } = __VLS_43.slots;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "panel-title" },
    });
    (__VLS_ctx.t('notifications.history.title'));
}
const __VLS_44 = {}.ElSkeleton;
/** @type {[typeof __VLS_components.ElSkeleton, typeof __VLS_components.elSkeleton, typeof __VLS_components.ElSkeleton, typeof __VLS_components.elSkeleton, ]} */ ;
// @ts-ignore
const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({
    rows: (4),
    animated: true,
    loading: (__VLS_ctx.loadingHistory),
}));
const __VLS_46 = __VLS_45({
    rows: (4),
    animated: true,
    loading: (__VLS_ctx.loadingHistory),
}, ...__VLS_functionalComponentArgsRest(__VLS_45));
__VLS_47.slots.default;
if (!__VLS_ctx.notifications.length) {
    const __VLS_48 = {}.ElEmpty;
    /** @type {[typeof __VLS_components.ElEmpty, typeof __VLS_components.elEmpty, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(__VLS_48, new __VLS_48({
        description: (__VLS_ctx.t('notifications.history.empty')),
    }));
    const __VLS_50 = __VLS_49({
        description: (__VLS_ctx.t('notifications.history.empty')),
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "history-list" },
    });
    for (const [item] of __VLS_getVForSourceType((__VLS_ctx.notifications))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (item.id),
            ...{ class: "history-item" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "history-top" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "history-title" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
        (item.title);
        const __VLS_52 = {}.ElTag;
        /** @type {[typeof __VLS_components.ElTag, typeof __VLS_components.elTag, typeof __VLS_components.ElTag, typeof __VLS_components.elTag, ]} */ ;
        // @ts-ignore
        const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({
            type: (item.isRead ? 'info' : 'success'),
            size: "small",
            effect: "plain",
        }));
        const __VLS_54 = __VLS_53({
            type: (item.isRead ? 'info' : 'success'),
            size: "small",
            effect: "plain",
        }, ...__VLS_functionalComponentArgsRest(__VLS_53));
        __VLS_55.slots.default;
        (item.isRead ? __VLS_ctx.t('notifications.history.read') : __VLS_ctx.t('notifications.history.unread'));
        var __VLS_55;
        const __VLS_56 = {}.ElButton;
        /** @type {[typeof __VLS_components.ElButton, typeof __VLS_components.elButton, typeof __VLS_components.ElButton, typeof __VLS_components.elButton, ]} */ ;
        // @ts-ignore
        const __VLS_57 = __VLS_asFunctionalComponent(__VLS_56, new __VLS_56({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
        }));
        const __VLS_58 = __VLS_57({
            ...{ 'onClick': {} },
            text: true,
            size: "small",
        }, ...__VLS_functionalComponentArgsRest(__VLS_57));
        let __VLS_60;
        let __VLS_61;
        let __VLS_62;
        const __VLS_63 = {
            onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.notifications.length))
                    return;
                __VLS_ctx.toggleRead(item);
            }
        };
        __VLS_59.slots.default;
        (item.isRead ? __VLS_ctx.t('notifications.history.markUnread') : __VLS_ctx.t('notifications.history.markRead'));
        var __VLS_59;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "history-body" },
        });
        (item.body || __VLS_ctx.t('notifications.history.noBody'));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "history-meta" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (item.type);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (item.routeLink || __VLS_ctx.t('notifications.history.noRoute'));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (item.createdAt);
    }
}
var __VLS_47;
var __VLS_43;
/** @type {__VLS_StyleScopedClasses['notifications-view']} */ ;
/** @type {__VLS_StyleScopedClasses['hero']} */ ;
/** @type {__VLS_StyleScopedClasses['tm-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['eyebrow']} */ ;
/** @type {__VLS_StyleScopedClasses['status-card']} */ ;
/** @type {__VLS_StyleScopedClasses['status-top']} */ ;
/** @type {__VLS_StyleScopedClasses['status-label']} */ ;
/** @type {__VLS_StyleScopedClasses['status-line']} */ ;
/** @type {__VLS_StyleScopedClasses['status-line']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['muted']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['span-2']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-title']} */ ;
/** @type {__VLS_StyleScopedClasses['history-list']} */ ;
/** @type {__VLS_StyleScopedClasses['history-item']} */ ;
/** @type {__VLS_StyleScopedClasses['history-top']} */ ;
/** @type {__VLS_StyleScopedClasses['history-title']} */ ;
/** @type {__VLS_StyleScopedClasses['history-body']} */ ;
/** @type {__VLS_StyleScopedClasses['history-meta']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            checking: checking,
            requesting: requesting,
            sending: sending,
            loadingHistory: loadingHistory,
            t: t,
            lastAction: lastAction,
            permission: permission,
            notifications: notifications,
            supported: supported,
            permissionLabel: permissionLabel,
            permissionType: permissionType,
            refreshPermission: refreshPermission,
            requestPermission: requestPermission,
            sendTestNotification: sendTestNotification,
            toggleRead: toggleRead,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
