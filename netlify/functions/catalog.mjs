// Netlify Functions:转发 12 份素材目录 JSON(源:官方发布站,带 sha256 指纹校验,复用 scripts/catalog-source.mjs)。
// 直接绑定 12 个 /<name>.json 路径(重写规则会丢查询参数,故用 config.path 而非 redirects)。
// 实例内存缓存 + 浏览器/CDN 缓存,避免每次页面加载都回源。
import { publishedSite, catalogIndex, readCatalog, catalogNames } from '../../scripts/catalog-source.mjs';

export const config = { path: ['/poses.json', '/depths.json', '/costumes.json', '/anime.json', '/portraits.json', '/expressions.json', '/hair.json', '/dynasties.json', '/scenes.json', '/lights.json', '/props.json', '/furniture.json'] };

let snapshot;
const discover = () => snapshot ??= catalogIndex(publishedSite).catch(error => { snapshot = undefined; throw error; });
const memo = new Map();

export default async function onRequest(request) {
  const name = new URL(request.url).pathname.replace(/^\//, '').replace(/\.json$/, '');
  if (!catalogNames.includes(name)) return j(400, '未知素材库：' + name);
  try {
    let text = memo.get(name);
    if (!text) {
      const index = await discover();
      text = (await readCatalog(index, name)).text;
      memo.set(name, text);
    }
    return new Response(text, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600' } });
  } catch (error) {
    return j(502, '素材目录加载失败：' + (error && error.message || error));
  }
}
const j = (s, m) => new Response(JSON.stringify({ error: m }), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
