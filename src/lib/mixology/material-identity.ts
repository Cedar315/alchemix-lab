// Search terms can be fuzzy; executable ingredient identities cannot.
export function isMaterialName(value: string): boolean {
    return value.trim().length > 0 && value.length <= 100
        && !/[，。；！？?!\n]|什么|怎么|为何|口感|味道|能否|可以|没有|换成|替换|换|我有|我加|我倒|我用|加了|倒了|用了|多少|毫升|\d+\s*ml/i.test(value);
}

const key = (value: string) => value.toLowerCase().replace(/[\s·]/g, '');
const aliases: Record<string, string> = { 白朗姆: '朗姆', 白朗姆酒: '朗姆', 朗姆酒: '朗姆', 苏打: '苏打水' };
type Identity = { name: string; englishName?: string; aliases?: string[]; convenienceData?: { nameZh: string; nameEn: string; aliases: string[] }; juiceData?: { nameZh: string; nameEn: string; aliases: string[] } };

export function findReferenceIngredient<T extends Identity>(name: string, items: T[]): T | undefined {
    if (!isMaterialName(name)) return undefined;
    const query = key(aliases[name] ?? name);
    const names = (item: T) => [item.name, item.name.split(/\s+[a-z]/i)[0], item.englishName,
        ...(item.aliases ?? []), item.convenienceData?.nameZh, item.convenienceData?.nameEn,
        ...(item.convenienceData?.aliases ?? []), item.juiceData?.nameZh, item.juiceData?.nameEn,
        ...(item.juiceData?.aliases ?? [])].filter((v): v is string => Boolean(v));
    // Prefer the explicit primary name; do not use flavor tags, components or substring overlap.
    const primary = items.filter(item => key(item.name) === query || key(item.name.split(/\s+[a-z]/i)[0]) === query);
    if (primary.length === 1) return primary[0];
    if (primary.length > 1) return undefined;
    const matches = items.filter(item => names(item).some(value => key(value) === query));
    return matches.length === 1 ? matches[0] : undefined;
}
