import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { translate } from '@/i18n';
import { useLocaleStore } from '@/stores/locale';
import { THEME_PRESET_MAP, THEME_PRESETS } from '@/theme/presets';
import { applyTokensToDocument, buildThemeTokens, calculateSunTimes, extractDominantColorFromFile, getHolidayInfo, getUpcomingHolidays, HOLIDAY_OPTIONS, isDarkColor, minutesToTimeString, mixColors, normalizeHex, parseTimeString, shiftHue } from '@/theme/utils';
const STORAGE_KEY = 'tm.theme.v2';
function tTheme(locale, key, params) {
    return translate(key, locale, params);
}
function localizeHolidayLabel(locale, label) {
    const keyMap = {
        'New Year 2024': 'holiday.newYear2024',
        'Spring Festival 2024': 'holiday.springFestival2024',
        'Qingming 2024': 'holiday.qingming2024',
        'Labour Day 2024': 'holiday.labourDay2024',
        'Dragon Boat 2024': 'holiday.dragonBoat2024',
        'Mid-Autumn 2024': 'holiday.midAutumn2024',
        'National Day 2024': 'holiday.nationalDay2024',
        'New Year 2025': 'holiday.newYear2025',
        'Spring Festival 2025': 'holiday.springFestival2025',
        'Qingming 2025': 'holiday.qingming2025',
        'Labour Day 2025': 'holiday.labourDay2025',
        'Dragon Boat 2025': 'holiday.dragonBoat2025',
        'National Day 2025': 'holiday.nationalDay2025',
        'Mid-Autumn 2025': 'holiday.midAutumn2025',
        'New Year': 'holiday.newYear',
        'Valentine Day': 'holiday.valentines',
        'Labour Day': 'holiday.labourDay',
        'Children Day': 'holiday.childrenDay',
        'National Day': 'holiday.nationalDay',
        Halloween: 'holiday.halloween',
        'Christmas Eve': 'holiday.christmasEve',
        Christmas: 'holiday.christmas',
        'New Year Eve': 'holiday.newYearEve'
    };
    const key = keyMap[label];
    return key ? tTheme(locale, key) : label;
}
function createDefaultSchedule() {
    return {
        enabled: false,
        basis: 'fixed',
        dayThemeId: 'light',
        nightThemeId: 'dark',
        sunriseThemeId: 'sunset',
        sunsetThemeId: 'modern-blue',
        dayStart: '08:00',
        nightStart: '19:00',
        latitude: 31.2304,
        longitude: 121.4737
    };
}
function createDefaultHoliday() {
    return {
        enabled: false,
        themeMap: {
            'new-year': 'arctic',
            valentines: 'pink',
            'labour-day': 'warm-orange',
            'national-day': 'sunset',
            halloween: 'minimal-black',
            christmas: 'forest',
            'new-year-eve': 'modern-blue'
        }
    };
}
function loadState() {
    if (typeof localStorage === 'undefined')
        return null;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        return {
            mode: parsed.mode === 'system' || parsed.mode === 'schedule' ? parsed.mode : 'preset',
            selectedThemeId: THEME_PRESET_MAP[parsed.selectedThemeId] ? parsed.selectedThemeId : 'light',
            systemLightThemeId: THEME_PRESET_MAP[parsed.systemLightThemeId]
                ? parsed.systemLightThemeId
                : 'light',
            systemDarkThemeId: THEME_PRESET_MAP[parsed.systemDarkThemeId]
                ? parsed.systemDarkThemeId
                : 'dark',
            schedule: {
                ...createDefaultSchedule(),
                ...(parsed.schedule ?? {})
            },
            holiday: {
                ...createDefaultHoliday(),
                ...(parsed.holiday ?? {}),
                themeMap: {
                    ...createDefaultHoliday().themeMap,
                    ...(parsed.holiday?.themeMap ?? {})
                }
            },
            customTheme: parsed.customTheme ?? null
        };
    }
    catch {
        return null;
    }
}
function getSystemScheme() {
    if (typeof window === 'undefined' || !window.matchMedia)
        return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function buildGeneratedTheme(label, accent, dark, source) {
    const primary = normalizeHex(accent);
    const bg = dark ? mixColors('#020617', primary, 0.14) : mixColors('#ffffff', primary, 0.08);
    const bgElevated = dark ? mixColors('#0f172a', primary, 0.12) : mixColors('#ffffff', primary, 0.03);
    const border = dark ? mixColors('#334155', primary, 0.12) : mixColors('#e2e8f0', primary, 0.12);
    const fgPrimary = dark ? '#f8fafc' : '#0f172a';
    const fgSecondary = dark ? '#cbd5e1' : '#475569';
    const info = shiftHue(primary, dark ? -24 : 22, 0.02, dark ? 0.04 : -0.02);
    const success = shiftHue(primary, 85, 0.03, dark ? 0.03 : -0.02);
    const warning = shiftHue(primary, -70, 0.05, 0.06);
    const danger = shiftHue(primary, -140, 0.02, dark ? 0.04 : 0.02);
    return {
        id: source === 'image' ? 'image-sync' : 'ai-sync',
        label,
        accent: primary,
        dark,
        source,
        tokens: buildThemeTokens({
            bg,
            bgElevated,
            border,
            fgPrimary,
            fgSecondary,
            primary,
            primaryHover: mixColors(primary, dark ? '#ffffff' : '#000000', dark ? 0.12 : 0.08),
            primaryActive: mixColors(primary, dark ? '#ffffff' : '#000000', dark ? 0.22 : 0.18),
            success,
            warning,
            danger,
            info,
            dark
        })
    };
}
function toCustomThemePreset(theme) {
    const category = theme.dark ? 'dark' : 'light';
    const localeStore = useLocaleStore();
    return {
        id: theme.id,
        label: theme.label,
        description: theme.source === 'image'
            ? tTheme(localeStore.locale, 'themeStudio.customSource.image')
            : tTheme(localeStore.locale, 'themeStudio.customSource.ai'),
        category,
        dark: theme.dark,
        hero: `linear-gradient(135deg, ${theme.tokens.bgElevated} 0%, ${theme.tokens.selection} 100%)`,
        accent: theme.accent,
        tokens: theme.tokens
    };
}
export const useThemeStore = defineStore('theme', () => {
    const saved = loadState();
    const localeStore = useLocaleStore();
    const mode = ref(saved?.mode ?? 'preset');
    const selectedThemeId = ref(saved?.selectedThemeId ?? 'light');
    const systemLightThemeId = ref(saved?.systemLightThemeId ?? 'light');
    const systemDarkThemeId = ref(saved?.systemDarkThemeId ?? 'dark');
    const schedule = ref(saved?.schedule ?? createDefaultSchedule());
    const holiday = ref(saved?.holiday ?? createDefaultHoliday());
    const customTheme = ref(saved?.customTheme ?? null);
    const currentSource = ref('preset');
    const currentThemeId = ref(selectedThemeId.value);
    const systemScheme = ref(getSystemScheme());
    const activeHoliday = ref(null);
    const nextScheduledThemeAt = ref('');
    const lastAppliedAt = ref('');
    let scheduleTimer = null;
    let mediaQuery = null;
    const availableThemes = computed(() => THEME_PRESETS);
    const presetStats = computed(() => ({
        total: THEME_PRESETS.length,
        light: THEME_PRESETS.filter((item) => item.category === 'light').length,
        dark: THEME_PRESETS.filter((item) => item.category === 'dark').length,
        seasonal: THEME_PRESETS.filter((item) => item.category === 'seasonal').length,
        focus: THEME_PRESETS.filter((item) => item.category === 'focus').length
    }));
    const holidayCatalog = computed(() => HOLIDAY_OPTIONS.map((item) => ({
        ...item,
        label: localizeHolidayLabel(localeStore.locale, item.label),
        themeId: (holiday.value.themeMap[item.key] ?? null)
    })));
    const upcomingHolidays = computed(() => getUpcomingHolidays(new Date()).map((item) => ({
        ...item,
        label: localizeHolidayLabel(localeStore.locale, item.label)
    })));
    const effectiveResolution = computed(() => resolveTheme());
    const effectiveTheme = computed(() => effectiveResolution.value.theme);
    const themeLabel = computed(() => effectiveTheme.value.label);
    const isDark = computed(() => effectiveTheme.value.dark);
    const todaySunTimes = computed(() => {
        const { sunrise, sunset } = getScheduleWindow();
        return { sunrise, sunset };
    });
    const scheduleSummary = computed(() => ({
        enabled: mode.value === 'schedule' && schedule.value.enabled,
        basisLabel: schedule.value.basis === 'sun'
            ? tTheme(localeStore.locale, 'themeStudio.scheduleValue.sunriseSunset')
            : tTheme(localeStore.locale, 'themeStudio.scheduleValue.fixedTime'),
        dayStartsAt: schedule.value.basis === 'sun' ? todaySunTimes.value.sunrise : schedule.value.dayStart,
        nightStartsAt: schedule.value.basis === 'sun' ? todaySunTimes.value.sunset : schedule.value.nightStart
    }));
    function getScheduleWindow() {
        const now = new Date();
        const { sunrise, sunset } = calculateSunTimes(now, schedule.value.latitude, schedule.value.longitude);
        return {
            sunrise,
            sunset,
            dayStartMinutes: parseTimeString(schedule.value.basis === 'sun' ? sunrise : schedule.value.dayStart),
            nightStartMinutes: parseTimeString(schedule.value.basis === 'sun' ? sunset : schedule.value.nightStart)
        };
    }
    function resolveScheduleTheme() {
        const now = new Date();
        const minutes = now.getHours() * 60 + now.getMinutes();
        const windowState = getScheduleWindow();
        if (schedule.value.basis === 'sun') {
            const sunriseMinutes = windowState.dayStartMinutes;
            const sunsetMinutes = windowState.nightStartMinutes;
            if (minutes >= sunriseMinutes && minutes < sunriseMinutes + 90) {
                return THEME_PRESET_MAP[schedule.value.sunriseThemeId];
            }
            if (minutes >= sunsetMinutes && minutes < sunsetMinutes + 90) {
                return THEME_PRESET_MAP[schedule.value.sunsetThemeId];
            }
        }
        const isNight = windowState.dayStartMinutes < windowState.nightStartMinutes
            ? minutes >= windowState.nightStartMinutes || minutes < windowState.dayStartMinutes
            : minutes >= windowState.nightStartMinutes && minutes < windowState.dayStartMinutes;
        const resolved = isNight ? schedule.value.nightThemeId : schedule.value.dayThemeId;
        return THEME_PRESET_MAP[resolved];
    }
    function resolveHolidayTheme() {
        if (!holiday.value.enabled)
            return null;
        const info = getHolidayInfo(new Date());
        if (!info)
            return null;
        const holidayThemeId = holiday.value.themeMap[info.key];
        return holidayThemeId && THEME_PRESET_MAP[holidayThemeId]
            ? { label: info.label, theme: THEME_PRESET_MAP[holidayThemeId] }
            : { label: info.label, theme: null };
    }
    function resolveTheme() {
        if (customTheme.value && currentSource.value === 'custom') {
            return {
                themeId: customTheme.value.id,
                source: 'custom',
                holidayLabel: null,
                theme: toCustomThemePreset(customTheme.value)
            };
        }
        const holidayTheme = resolveHolidayTheme();
        if (holidayTheme?.theme) {
            return {
                themeId: holidayTheme.theme.id,
                source: 'holiday',
                holidayLabel: holidayTheme.label,
                theme: holidayTheme.theme
            };
        }
        if (mode.value === 'system') {
            const id = systemScheme.value === 'dark' ? systemDarkThemeId.value : systemLightThemeId.value;
            return {
                themeId: id,
                source: 'system',
                holidayLabel: holidayTheme?.label ?? null,
                theme: THEME_PRESET_MAP[id]
            };
        }
        if (mode.value === 'schedule' && schedule.value.enabled) {
            const scheduled = resolveScheduleTheme();
            return {
                themeId: scheduled.id,
                source: 'schedule',
                holidayLabel: holidayTheme?.label ?? null,
                theme: scheduled
            };
        }
        return {
            themeId: selectedThemeId.value,
            source: 'preset',
            holidayLabel: holidayTheme?.label ?? null,
            theme: THEME_PRESET_MAP[selectedThemeId.value]
        };
    }
    function applyCurrentTheme() {
        const resolution = resolveTheme();
        currentThemeId.value = resolution.themeId;
        currentSource.value = resolution.source;
        activeHoliday.value = resolution.holidayLabel;
        applyTokensToDocument(resolution.theme.tokens, resolution.theme.dark, resolution.theme.id);
        lastAppliedAt.value = new Date().toISOString();
        updateNextScheduleLabel();
    }
    function updateNextScheduleLabel() {
        if (mode.value !== 'schedule' || !schedule.value.enabled) {
            nextScheduledThemeAt.value = '';
            return;
        }
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const windowState = getScheduleWindow();
        const marks = [
            { label: tTheme(localeStore.locale, 'themeStudio.scheduleValue.dayStart'), at: windowState.dayStartMinutes },
            { label: tTheme(localeStore.locale, 'themeStudio.scheduleValue.nightStart'), at: windowState.nightStartMinutes }
        ];
        if (schedule.value.basis === 'sun') {
            marks.push({ label: tTheme(localeStore.locale, 'themeStudio.scheduleValue.sunriseAccent'), at: windowState.dayStartMinutes }, { label: tTheme(localeStore.locale, 'themeStudio.scheduleValue.sunsetAccent'), at: windowState.nightStartMinutes });
        }
        const next = marks
            .map((item) => ({
            ...item,
            delta: item.at >= currentMinutes ? item.at - currentMinutes : 1440 - currentMinutes + item.at
        }))
            .sort((a, b) => a.delta - b.delta)[0];
        nextScheduledThemeAt.value = next
            ? tTheme(localeStore.locale, 'themeStudio.scheduleValue.at', {
                label: next.label,
                time: minutesToTimeString(next.at)
            })
            : '';
    }
    function restartScheduleTimer() {
        if (scheduleTimer !== null) {
            window.clearInterval(scheduleTimer);
            scheduleTimer = null;
        }
        if (typeof window === 'undefined')
            return;
        scheduleTimer = window.setInterval(() => {
            applyCurrentTheme();
        }, 60_000);
    }
    function saveState() {
        if (typeof localStorage === 'undefined')
            return;
        const snapshot = {
            mode: mode.value,
            selectedThemeId: selectedThemeId.value,
            systemLightThemeId: systemLightThemeId.value,
            systemDarkThemeId: systemDarkThemeId.value,
            schedule: schedule.value,
            holiday: holiday.value,
            customTheme: customTheme.value
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
    function init() {
        if (typeof window !== 'undefined' && window.matchMedia) {
            mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            systemScheme.value = mediaQuery.matches ? 'dark' : 'light';
            mediaQuery.addEventListener('change', (event) => {
                systemScheme.value = event.matches ? 'dark' : 'light';
                if (mode.value === 'system') {
                    applyCurrentTheme();
                }
            });
        }
        restartScheduleTimer();
        applyCurrentTheme();
    }
    function setMode(value) {
        mode.value = value;
        if (value !== 'preset' && customTheme.value) {
            currentSource.value = value;
        }
        applyCurrentTheme();
    }
    function setTheme(themeId) {
        selectedThemeId.value = themeId;
        currentSource.value = 'preset';
        mode.value = 'preset';
        applyCurrentTheme();
    }
    function setSystemThemePair(lightThemeId, darkThemeId) {
        systemLightThemeId.value = lightThemeId;
        systemDarkThemeId.value = darkThemeId;
        applyCurrentTheme();
    }
    function updateSchedule(patch) {
        schedule.value = { ...schedule.value, ...patch };
        applyCurrentTheme();
    }
    function updateHoliday(patch) {
        holiday.value = {
            ...holiday.value,
            ...patch,
            themeMap: {
                ...holiday.value.themeMap,
                ...(patch.themeMap ?? {})
            }
        };
        applyCurrentTheme();
    }
    function clearCustomTheme() {
        customTheme.value = null;
        if (currentSource.value === 'custom') {
            currentSource.value = mode.value === 'preset' ? 'preset' : mode.value;
            applyCurrentTheme();
        }
    }
    async function generateThemeFromImage(file) {
        const accent = await extractDominantColorFromFile(file);
        const preview = buildGeneratedTheme(`Image Sync ${file.name}`, accent, isDarkColor(accent), 'image');
        customTheme.value = preview;
        currentSource.value = 'custom';
        applyCurrentTheme();
        return preview;
    }
    function generateAiTheme(seed) {
        const cleanSeed = seed.trim() || 'story';
        const code = [...cleanSeed].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 3), 0);
        const hue = code % 360;
        const accent = shiftHue('#3b82f6', hue - 215, 0.08, 0.02);
        const dark = code % 2 === 0;
        const preview = buildGeneratedTheme(`AI ${cleanSeed}`, accent, dark, 'ai');
        customTheme.value = preview;
        currentSource.value = 'custom';
        applyCurrentTheme();
        return preview;
    }
    watch([mode, selectedThemeId, systemLightThemeId, systemDarkThemeId, schedule, holiday, customTheme], () => {
        saveState();
    }, { deep: true });
    return {
        mode,
        availableThemes,
        presetStats,
        selectedThemeId,
        systemLightThemeId,
        systemDarkThemeId,
        schedule,
        scheduleSummary,
        holiday,
        holidayCatalog,
        upcomingHolidays,
        customTheme,
        currentSource,
        currentThemeId,
        activeHoliday,
        themeLabel,
        effectiveTheme,
        effectiveResolution,
        isDark,
        systemScheme,
        todaySunTimes,
        nextScheduledThemeAt,
        lastAppliedAt,
        init,
        setMode,
        setTheme,
        setSystemThemePair,
        updateSchedule,
        updateHoliday,
        clearCustomTheme,
        generateThemeFromImage,
        generateAiTheme,
        applyCurrentTheme
    };
});
