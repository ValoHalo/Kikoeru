"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultNVA = void 0;
exports.newDLSiteStatic = newDLSiteStatic;
exports.newDLSiteDynamic = newDLSiteDynamic;
exports.newDLSiteStaticExtended = newDLSiteStaticExtended;
exports.newDLSiteDynamicExtended = newDLSiteDynamicExtended;
exports.newScrapeWorkMetadataFromDLsite = newScrapeWorkMetadataFromDLsite;
exports.getCoverUrlsFromDLsite = getCoverUrlsFromDLsite;
exports.extractStaticWorkMetadata = extractStaticWorkMetadata;
const axios_1 = require("./axios");
const utils_1 = require("./utils");
const hvdb_1 = require("./hvdb");
const idConverter_1 = require("../filesystem/idConverter");
const config_1 = require("../config");
const globalKeyAndIv = (0, utils_1.getKeyAndIV)(config_1.config.metaCryptoKey);
const defaultNVA = { id: (0, utils_1.nameToUUID)('N/A'), name: 'N/A' };
exports.defaultNVA = defaultNVA;
const TITLE_PATTERN = / \[.+\] \| DLsite$/;
const RELEASE_PATTERN = /\d{4}-\d{2}-\d{2}/;
function getDefaultStaticUrlTemplates() {
    return [
        `https://www.dlsite.com/maniax/api/=/product.json?workno={code}&locale=${config_1.config.tagLanguage}`,
        `${config_1.config.kikoeruMetaServerUrl}/api/static/{code}?locale=${config_1.config.tagLanguage}`,
    ];
}
function getDefaultDynamicUrlTemplates() {
    return [
        `https://www.dlsite.com/maniax-touch/product/info/ajax?product_id={code}&locale=${config_1.config.tagLanguage}`,
        `${config_1.config.kikoeruMetaServerUrl}/api/dynamic/{code}?locale=${config_1.config.tagLanguage}`,
    ];
}
async function fetchWithMultiUrlRetry(code, urlTemplates, requestConfig, skipEmptyCheck) {
    if (urlTemplates.length === 0) {
        throw new Error(`[${code}] 未提供任何 URL 模板`);
    }
    const errors = [];
    for (const template of urlTemplates) {
        const url = template.replace('{code}', code);
        try {
            console.log(`[${code}] 请求 URL: ${url}`);
            const response = await (0, axios_1.retryGet)(url, {
                retry: {},
                ...(requestConfig || {}),
            });
            const raw = (0, utils_1.decryptDataIfNeed)(response.data, globalKeyAndIv);
            const data = (typeof raw === 'object' && !Array.isArray(raw) && 'data' in raw)
                ? raw.data
                : raw;
            if (!skipEmptyCheck) {
                if (data === null || data === undefined) {
                    throw new Error(`响应内容为空 (null/undefined)`);
                }
                if (Array.isArray(data) && data.length === 0) {
                    throw new Error(`响应内容为空数组 []`);
                }
                if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0) {
                    throw new Error(`响应内容为空对象 {}`);
                }
            }
            console.log(`[${code}] URL 请求成功: ${url}`);
            return data;
        }
        catch (error) {
            const err = error;
            const msg = err.response?.status
                ? `HTTP ${err.response.status}`
                : (err.message || String(error));
            console.log(`[${code}] URL 请求失败 (${url}): ${msg}`);
            errors.push({ template, message: msg });
        }
    }
    throw new Error(`[${code}] 所有 ${urlTemplates.length} 个 URL 模板请求均失败:\n` +
        errors.map((e, i) => `  ${i + 1} → ${e.message}`).join('\n'));
}
async function newDLSiteStatic(code, extraUrlTemplates, requestConfig) {
    const templates = [
        ...getDefaultStaticUrlTemplates(),
        ...(extraUrlTemplates || []),
    ];
    const arr = await fetchWithMultiUrlRetry(code, templates, requestConfig);
    return arr[0];
}
async function newDLSiteDynamic(code, extraUrlTemplates, requestConfig) {
    const templates = [
        ...getDefaultDynamicUrlTemplates(),
        ...(extraUrlTemplates || []),
    ];
    const dict = await fetchWithMultiUrlRetry(code, templates, requestConfig, true);
    return dict[code];
}
function extractStaticWorkMetadata(id, rjcode, data) {
    const work = {
        id,
        title: (data.product_name || '').replace(TITLE_PATTERN, ''),
        tags: (data.genres || []).map((v) => ({ id: v.id, name: v.name })),
        vas: [],
        circle: {
            id: (0, idConverter_1.circleCodeToId)(data.maker_id),
            name: data.maker_name || '',
        },
        nsfw: data.age_category == null ? null : data.age_category === 3,
        release: (RELEASE_PATTERN.exec(data.regist_date || data.update_date || '1970-01-01') || [''])[0],
        series: undefined,
        translation_info: data.translation_info,
    };
    if (data.creaters && !Array.isArray(data.creaters) && data.creaters.voice_by) {
        work.vas = data.creaters.voice_by.map((v) => ({
            id: (0, utils_1.nameToUUID)(v.name),
            name: v.name,
        }));
    }
    return work;
}
async function getTranslationInfo(id, extraStaticUrlTemplates) {
    const rjcode = (0, idConverter_1.idNumberToCode)(id);
    const result = { original_work_id: id, translation_lang: null };
    try {
        const info = await newDLSiteStatic(rjcode, extraStaticUrlTemplates);
        if (!info)
            return result;
        if (info.translation_info?.is_original) {
            return result;
        }
        const originalWorkno = info.translation_info?.original_workno;
        if (originalWorkno) {
            result.original_work_id = (0, idConverter_1.codeToIdNumber)(originalWorkno);
            result.translation_lang = info.translation_info.lang ?? null;
        }
    }
    catch (err) {
        console.error(`[${rjcode}] 获取翻译信息失败:`, err);
    }
    return result;
}
async function tryParentStaticFallback(id) {
    const rjcode = (0, idConverter_1.idNumberToCode)(id);
    const parentId = id - 1;
    const parentRjcode = (0, idConverter_1.idNumberToCode)(parentId);
    console.log(`[${rjcode}] 尝试通过 parent 作品 ${parentRjcode} (id=${parentId}) 获取 static 数据...`);
    try {
        const data = await newDLSiteStatic(parentRjcode);
        const childWorknos = data.translation_info?.child_worknos ?? [];
        if (!childWorknos.includes(rjcode)) {
            console.log(`[${rjcode}] parent ${parentRjcode} 的 child_worknos 不包含 ${rjcode}，放弃回退`);
            return null;
        }
        console.log(`[${rjcode}] ✅ 确认是 ${parentRjcode} 的 child 作品，使用 parent static 数据`);
        return data;
    }
    catch (err) {
        console.log(`[${rjcode}] parent ${parentRjcode} static 数据获取也失败:`, err);
        return null;
    }
}
async function newDLSiteStaticExtended(id, extraUrlTemplates) {
    const rjcode = (0, idConverter_1.idNumberToCode)(id);
    try {
        return await newDLSiteStatic(rjcode, extraUrlTemplates);
    }
    catch (directErr) {
        console.log(`[${rjcode}] Static 元数据获取失败，尝试 parent 作品 (id-1) 回退...`);
        const parentData = await tryParentStaticFallback(id);
        if (parentData)
            return parentData;
        throw directErr;
    }
}
async function newDLSiteDynamicExtended(id, extraDynamicUrlTemplates) {
    const rjcode = (0, idConverter_1.idNumberToCode)(id);
    let data = await newDLSiteDynamic(rjcode, extraDynamicUrlTemplates).catch(() => undefined);
    if (data === undefined) {
        console.log(`[${rjcode}] 无法获取到动态元数据，尝试通过 static Extended 回退`);
        try {
            const staticData = await newDLSiteStaticExtended(id);
            const ti = staticData.translation_info;
            const candidates = [
                staticData.workno,
                ti?.original_workno,
                ti?.parent_workno,
                ...(ti?.child_worknos ?? []),
            ].filter((c) => !!c && c !== rjcode);
            for (const candidate of candidates) {
                try {
                    console.log(`[${rjcode}] 尝试用 workno ${candidate} 查询 dynamic`);
                    data = await newDLSiteDynamic(candidate, extraDynamicUrlTemplates);
                    if (data) {
                        console.log(`[${rjcode}] ✅ 通过 workno ${candidate} 获取 dynamic 成功`);
                        break;
                    }
                }
                catch { }
            }
        }
        catch (err) {
            console.error(`[${rjcode}] static Extended 回退失败:`, err);
        }
    }
    if (data && !data.rate_average_2dp && data.translation_info?.parent_workno) {
        const parentWorkno = data.translation_info.parent_workno;
        try {
            console.log(`[${rjcode}] 翻译作品缺少评分，从 parent ${parentWorkno} 获取`);
            const parentData = await newDLSiteDynamic(parentWorkno, extraDynamicUrlTemplates);
            data.rate_average_2dp = parentData?.rate_average_2dp || 0.0;
        }
        catch (err) {
            console.error(`[${rjcode}] 从 parent 获取 rate_average_2dp 失败:`, err);
            data.rate_average_2dp = 0.0;
        }
    }
    if (!data) {
        console.log(`[${rjcode}] 无法获取动态元数据，返回空数据`);
        return {};
    }
    console.log(`[${rjcode}] Dynamic 元数据提取完成`);
    return data;
}
async function newScrapeWorkMetadataFromDLsite(id) {
    const rjcode = (0, idConverter_1.idNumberToCode)(id);
    const rawDynamic = await newDLSiteDynamicExtended(id);
    const translationInfo = await getTranslationInfo(id);
    const dynamicMeta = rawDynamic
        ? {
            dl_count: rawDynamic.dl_count ? String(rawDynamic.dl_count) : '0',
            rate_average_2dp: rawDynamic.rate_average_2dp ?? 0.0,
            rate_count: rawDynamic.rate_count ?? 0,
            rate_count_detail: rawDynamic.rate_count_detail ?? [],
            review_count: rawDynamic.review_count ?? 0,
            price: rawDynamic.price ?? 0,
            rank: rawDynamic.rank?.length ? rawDynamic.rank : undefined,
            translation_lang: translationInfo.translation_lang,
            original_work_id: translationInfo.original_work_id,
        }
        : {
            dl_count: '0',
            rate_average_2dp: 0.0,
            rate_count: 0,
            rate_count_detail: [],
            review_count: 0,
            price: 0,
            rank: undefined,
            translation_lang: null,
            original_work_id: id,
        };
    const staticData = await newDLSiteStaticExtended(id);
    const staticMeta = extractStaticWorkMetadata(id, rjcode, staticData);
    if (staticMeta.vas.length === 0) {
        if ((0, idConverter_1.getIDTypeString)(rjcode) === 'RJ') {
            try {
                const hvdbMetadata = await (0, hvdb_1.scrapeWorkMetadataFromHVDB)(id);
                staticMeta.vas = hvdbMetadata.vas;
            }
            catch (e) {
                console.log(`[${rjcode}] HVDB 声优抓取失败，假定无 VA，error:`, e);
            }
        }
        if (staticMeta.vas.length === 0) {
            staticMeta.vas.push(defaultNVA);
        }
    }
    console.log(`[${rjcode}] Static 元数据提取完成`);
    if (staticMeta.id !== dynamicMeta.original_work_id && dynamicMeta.original_work_id) {
        console.log(`[${rjcode}] 作品为翻译版 (original=${(0, idConverter_1.idNumberToCode)(dynamicMeta.original_work_id)})，用原始作品社团信息替换`);
        try {
            const originalStaticResp = await newDLSiteStaticExtended(dynamicMeta.original_work_id);
            const originalStaticData = extractStaticWorkMetadata(dynamicMeta.original_work_id, (0, idConverter_1.idNumberToCode)(dynamicMeta.original_work_id), originalStaticResp);
            staticMeta.circle = originalStaticData.circle;
        }
        catch (err) {
            console.error(`[${rjcode}] 获取原始作品社团信息失败:`, err);
        }
    }
    const work = Object.assign({}, staticMeta, dynamicMeta);
    console.log(`[${rjcode}] 完整元数据抓取完成`);
    return work;
}
function extractCoverUrls(rawItem) {
    const imageMain = rawItem.image_main;
    const imageThum = rawItem.image_thum;
    const result = {};
    if (imageMain?.url)
        result.main = `https:${imageMain.url}`;
    if (imageThum?.url)
        result.sam = `https:${imageThum.url}`;
    if (imageMain?.resize_url)
        result['240x240'] = `https://img.dlsite.jp/${imageMain.resize_url}_240x240.jpg`;
    return Object.keys(result).length > 0 ? result : undefined;
}
async function getCoverUrlsFromDLsite(id) {
    const rjcode = (0, idConverter_1.idNumberToCode)(id);
    try {
        const staticData = await newDLSiteStaticExtended(id);
        const urls = extractCoverUrls(staticData);
        if (urls)
            console.log(`[${rjcode}] 封面 URL 提取完成:`, urls);
        return urls ?? null;
    }
    catch (err) {
        console.log(`[${rjcode}] 获取封面 URL 失败:`, err);
        return null;
    }
}
