// aidi.tv（爱迪影视）自定义 JS 蜘蛛（苹果CMS v10 JSON 接口）
// 目的：接口本身有 pagecount，但 TVBox 用 type1 直连时容易把「超出总量的空页」也翻出来，
//      这里改成受控 JS 源：按分类返回正确的 pagecount，并对偶发 429 做一次重试。
import * as catvod from 'catvod';

const HOST = 'https://aidi.tv';
const API = HOST + '/api.php/provide/vod/';
const UA = 'okhttp/3.12.0';
const Spider = catvod.Spider;
const headers = { 'User-Agent': UA, 'Referer': HOST + '/' };
const options = () => ({ headers: headers, timeout: 20000 });

const CLASSES = [
  { type_id: '6', type_name: '动作片' },
  { type_id: '7', type_name: '喜剧片' },
  { type_id: '8', type_name: '爱情片' },
  { type_id: '9', type_name: '科幻片' },
  { type_id: '10', type_name: '恐怖片' },
  { type_id: '11', type_name: '剧情片' },
  { type_id: '12', type_name: '战争片' },
  { type_id: '23', type_name: '传记' },
  { type_id: '20', type_name: '韩国电影' },
  { type_id: '32', type_name: '动漫电影' },
  { type_id: '13', type_name: '国产剧' },
  { type_id: '14', type_name: '港台剧' },
  { type_id: '15', type_name: '韩剧' },
  { type_id: '16', type_name: '美剧' },
  { type_id: '21', type_name: '日剧' },
  { type_id: '25', type_name: '英剧' },
  { type_id: '36', type_name: '泰剧' },
  { type_id: '40', type_name: '其他剧' },
  { type_id: '31', type_name: '日韩动漫' },
  { type_id: '35', type_name: '欧美动漫' },
  { type_id: '4', type_name: '樱花动漫' },
  { type_id: '3', type_name: '综艺' },
  { type_id: '33', type_name: '韩国综艺' },
  { type_id: '38', type_name: '港台综艺' },
  { type_id: '39', type_name: '欧美综艺' },
  { type_id: '41', type_name: '日本综艺' },
  { type_id: '24', type_name: '纪录片' }
];

function unesc(s) {
  return String(s == null ? '' : s)
    .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(parseInt(d, 10)); })
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function plain(s) {
  return unesc(String(s == null ? '' : s).replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function mapVod(it) {
  return {
    vod_id: String(it.vod_id),
    vod_name: unesc(it.vod_name),
    vod_pic: it.vod_pic || it.vod_pic_slide || '',
    vod_remarks: unesc(it.vod_remarks || it.vod_note || ''),
    vod_year: String(it.vod_year || ''),
    vod_area: unesc(it.vod_area || ''),
    type_name: unesc(it.type_name || '')
  };
}

function parseBody(txt) {
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (e) { return null; }
}

// 取接口数据；遇到 429/空响应重试一次（间隔很短，接口一般 1 秒内恢复）
function apiJson(query, fetchRaw) {
  const url = API + '?' + query;
  let d = parseBody(fetchRaw(url));
  if (!d || !d.list) d = parseBody(fetchRaw(url));
  return d || { list: [] };
}

function calcPage(d, limit) {
  if (d && d.pagecount) return Number(d.pagecount);
  const total = Number(d && d.total) || 0;
  return total > 0 ? Math.ceil(total / (limit || 20)) : 1;
}

function buildDetail(it) {
  return {
    vod_id: String(it.vod_id),
    vod_name: unesc(it.vod_name),
    vod_pic: it.vod_pic || '',
    vod_content: plain(it.vod_content || it.vod_blurb || ''),
    vod_remarks: unesc(it.vod_remarks || ''),
    vod_year: String(it.vod_year || ''),
    vod_area: unesc(it.vod_area || ''),
    vod_actor: unesc(it.vod_actor || ''),
    vod_director: unesc(it.vod_director || ''),
    type_name: unesc(it.type_name || ''),
    vod_play_from: it.vod_play_from || '',
    vod_play_url: it.vod_play_url || ''
  };
}

function playResult(id) {
  return {
    parse: 0,
    url: id,
    header: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36', 'Referer': HOST + '/' }
  };
}

// 同步请求（legacy 接口用，req 由 JS 引擎注入）
function get(url) {
  const r = req(url, options());
  return (r && r.content) ? r.content : '';
}

const legacy = {
  init() {},
  home() { return JSON.stringify({ class: CLASSES, filters: {} }); },
  homeVod() {
    try {
      const d = apiJson('ac=detail&pg=1', get);
      return JSON.stringify({ list: (d.list || []).map(mapVod) });
    } catch (e) { return JSON.stringify({ list: [] }); }
  },
  category(tid, pg) {
    const page = Number(pg) || 1;
    try {
      const d = apiJson('ac=detail&t=' + tid + '&pg=' + page, get);
      return JSON.stringify({
        page: page,
        pagecount: calcPage(d, Number(d.limit) || 20),
        limit: Number(d.limit) || 20,
        total: Number(d.total) || 0,
        list: (d.list || []).map(mapVod)
      });
    } catch (e) {
      return JSON.stringify({ page: page, pagecount: page, limit: 20, total: 0, list: [] });
    }
  },
  detail(id) {
    try {
      const first = String(id).split(',')[0];
      const d = apiJson('ac=detail&ids=' + first, get);
      return JSON.stringify({ list: (d.list || []).map(buildDetail) });
    } catch (e) { return JSON.stringify({ list: [] }); }
  },
  search(key, quick, pg) {
    try {
      const d = apiJson('ac=detail&wd=' + encodeURIComponent(key) + '&pg=' + (Number(pg) || 1), get);
      return JSON.stringify({ list: (d.list || []).map(mapVod) });
    } catch (e) { return JSON.stringify({ list: [] }); }
  },
  play(flag, id) { return JSON.stringify(playResult(id)); }
};

let modern = null;
if (typeof Spider === 'function') {
  modern = class AidiTv extends Spider {
    async fetchRaw(url) {
      const r = await this.net.req(url, options());
      return r && r.content ? r.content : '';
    }
    async fetchJson(query) {
      const url = API + '?' + query;
      let d = parseBody(await this.fetchRaw(url));
      if (!d || !d.list) d = parseBody(await this.fetchRaw(url));
      return d || { list: [] };
    }
    homeContent(filter) { return { class: CLASSES, filters: {} }; }
    async homeVideoContent() {
      const d = await this.fetchJson('ac=detail&pg=1');
      return { list: (d.list || []).map(mapVod) };
    }
    async categoryContent(tid, pg) {
      const page = Number(pg) || 1;
      const d = await this.fetchJson('ac=detail&t=' + tid + '&pg=' + page);
      return {
        page: page,
        pagecount: calcPage(d, Number(d.limit) || 20),
        limit: Number(d.limit) || 20,
        total: Number(d.total) || 0,
        list: (d.list || []).map(mapVod)
      };
    }
    async detailContent(ids) {
      const first = String(Array.isArray(ids) ? ids[0] : ids).split(',')[0];
      const d = await this.fetchJson('ac=detail&ids=' + first);
      return { list: (d.list || []).map(buildDetail) };
    }
    async searchContent(key, quick, pg) {
      const d = await this.fetchJson('ac=detail&wd=' + encodeURIComponent(key) + '&pg=' + (Number(pg) || 1));
      return { list: (d.list || []).map(mapVod) };
    }
    async playerContent(flag, id) { return playResult(id); }
  };
}

export default modern || legacy;
