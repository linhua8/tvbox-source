// 可可影视 keke1.app 自定义 JS 蜘蛛（双端兼容版）
// 站点：https://www.keke1.app  自建站（非苹果CMS）
// 分类：/channel/{id}.html，分页 /channel/{id}-{page}.html
// 详情：/detail/{id}.html（.episode-list 每块一条线路，线路名在 .source-item-label）
// 播放：/play/{vodId}-{sid}-{nid}.html，页面内嵌明文 playSource.src（无需签名）
// 搜索：/search?k=词&t=首页动态token（每次搜索前先取首页，从搜索链接里抓 t）
// 反爬：需固定 Cookie cdndefend_js_cookie（cdndefend PoW 挑战的固定解）
// - FongMi / catvod（QuickJS）：default 为继承 Spider 的类，方法返回对象
// - TVBox（旧 JS 运行时）：default 为旧对象，方法返回 JSON 字符串，用全局 req
import * as catvod from 'catvod';

const HOST = 'https://www.keke1.app';
const PIC = 'https://vres.wkcyvs.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const CK = 'cdndefend_js_cookie=FE93A2DAC8385915AB132EBDE19FA2289BD6C83587216';
const Spider = catvod.Spider;
const options = () => ({
  headers: {
    'User-Agent': UA,
    'Cookie': CK,
    'Referer': HOST + '/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9'
  },
  timeout: 20000
});

const CLASSES = [
  { type_id: '1', type_name: '电影' },
  { type_id: '2', type_name: '连续剧' },
  { type_id: '3', type_name: '动漫' },
  { type_id: '4', type_name: '综艺纪录' },
  { type_id: '6', type_name: '短剧' }
];

function absPic(u) {
  if (!u) return '';
  if (/^https?:/.test(u)) return u;
  return PIC + u;
}

// 解析卡片列表（分类页 / 搜索结果通用）
function parseList(html) {
  const list = [];
  const re = /<a href="\/detail\/(\d+)\.html" class="v-item">([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const seg = m[2];
    const pic = /<img[^>]*data-original="(\/vod1[^"]*)"/.exec(seg);
    const title = /<div class="v-item-title">([^<]+)<\/div>/.exec(seg);
    const rem = /<div class="v-item-bottom">([\s\S]*?)<\/div>/.exec(seg);
    list.push({
      vod_id: m[1],
      vod_name: title ? title[1].trim() : '',
      vod_pic: absPic(pic ? pic[1] : ''),
      vod_remarks: rem ? rem[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''
    });
  }
  return list;
}

// 搜索结果卡片（结构不同于分类页）
function parseSearchList(html) {
  const list = [];
  const re = /<a href="\/detail\/(\d+)\.html" class="search-result-item">([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const seg = m[2];
    const tm = /<img[^>]*?(?:alt|title)="([^"]+)"/.exec(seg);
    const pic = /data-original="(\/vod1[^"]*)"/.exec(seg);
    list.push({
      vod_id: m[1],
      vod_name: tm ? tm[1].trim() : '',
      vod_pic: absPic(pic ? pic[1] : ''),
      vod_remarks: ''
    });
  }
  return list;
}

// 详情基础信息
function collectMeta(html) {
  const tm = /<title>([^<]*)<\/title>/.exec(html);
  const picM = /class="detail-pic"[\s\S]*?data-original="([^"]+)"/.exec(html);
  const descM = /<div class="detail-desc">([\s\S]*?)<\/div>/.exec(html);
  return {
    name: tm ? tm[1].split('-')[0].trim() : '',
    pic: absPic(picM ? picM[1] : ''),
    content: descM ? descM[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : ''
  };
}

// 收集线路：每个 .episode-list 块 = 一条线路，线路名按 .source-item-label 顺序对应
function collectLines(html, maxFrom, maxEp) {
  const srcNames = [];
  const reName = /<span class="source-item-label">([^<]+)<\/span>/g;
  let m;
  while ((m = reName.exec(html))) srcNames.push(m[1].trim());

  const lines = [];
  const reBlock = /<div class="episode-list"[^>]*>([\s\S]*?)<\/div>/g;
  let bi = 0;
  while ((m = reBlock.exec(html))) {
    if (lines.length >= maxFrom) break;
    const b = m[1];
    const eps = [];
    const reEp = /<a href="(\/play\/\d+-\d+-\d+\.html)"[^>]*>([\s\S]{0,220}?)<\/a>/g;
    let e;
    while ((e = reEp.exec(b))) {
      const idx = (/data-index="(\d+)"/.exec(e[0]) || [])[1] || '';
      const sp = (/<span>([^<]*)<\/span>/.exec(e[2]) || [])[1] || '';
      eps.push({ href: e[1], idx: idx, sp: sp.trim() });
    }
    if (!eps.length) { bi++; continue; }
    const multi = eps.length > 1;
    const parts = [];
    for (let k = 0; k < eps.length && k < maxEp; k++) {
      const x = eps[k];
      const nm = multi ? ('第' + (x.idx || (k + 1)) + '集') : (x.sp || '正片');
      parts.push(nm + '$' + HOST + x.href);
    }
    let fromName = srcNames[bi] || ('线路' + (bi + 1));
    if (lines.some(function (l) { return l.name === fromName; })) fromName = fromName + '-' + (bi + 1);
    lines.push({ name: fromName, parts: parts, firstHref: eps[0].href });
    bi++;
  }
  return lines;
}

function assembleDetail(id, html, lines) {
  const meta = collectMeta(html);
  return {
    vod_id: id,
    vod_name: meta.name,
    vod_pic: meta.pic,
    vod_remarks: '',
    vod_content: meta.content,
    vod_play_from: lines.map(function (l) { return l.name; }).join('$$$'),
    vod_play_url: lines.map(function (l) { return l.parts.join('#'); }).join('$$$')
  };
}

// 详情入口：给了 probe 就把「首集能出流」的线路提到第一位（站点里很多第三方线路 src 为空）
function buildDetail(id, html, probe) {
  const lines = collectLines(html, 8, 300);
  if (probe && lines.length > 1) {
    const n = Math.min(lines.length, 6);
    for (let i = 0; i < n; i++) {
      if (probe(lines[i].firstHref)) {
        if (i > 0) { const t = lines[0]; lines[0] = lines[i]; lines[i] = t; }
        break;
      }
    }
  }
  return assembleDetail(id, html, lines);
}

// 播放：页面内嵌 playSource = { src: "https://...m3u8", type: ... }
function buildPlayer(html) {
  const m = /playSource\s*=\s*\{[^}]*?src:\s*"([^"]*)"/.exec(html);
  if (!m || !m[1] || !/^https?:/.test(m[1])) return null;
  return { url: m[1], parse: 0, header: { 'User-Agent': UA, 'Referer': HOST + '/' } };
}

// 从首页抓搜索 token（形如 /search?k=xx&amp;t=nrO%2B6Gu...%3D%3D）
function extractToken(html) {
  const m = /\/search\?k=[^"&<]*&(?:amp;)?t=([^"&<]+)/.exec(html);
  if (!m) return '';
  try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
}

function searchUrl(key, token) {
  return HOST + '/search?k=' + encodeURIComponent(key) + (token ? ('&t=' + encodeURIComponent(token)) : '');
}

// ===== TVBox 旧端：同步全局 req，方法返回 JSON 字符串 =====
function get(url) {
  const r = req(url, options());
  return (r && r.content) ? r.content : '';
}

const legacy = {
  init() {},

  home() {
    return JSON.stringify({ class: CLASSES, filters: {} });
  },

  homeVod() {
    return JSON.stringify({ list: parseList(get(HOST + '/channel/1.html')) });
  },

  category(tid, pg) {
    const page = Number(pg) || 1;
    const url = page <= 1 ? (HOST + '/channel/' + tid + '.html') : (HOST + '/channel/' + tid + '-' + page + '.html');
    const list = parseList(get(url));
    return JSON.stringify({
      page: page,
      pagecount: list.length ? (page + 1) : page,
      limit: 24,
      total: 0,
      list: list
    });
  },

  detail(id) {
    const html = get(HOST + '/detail/' + id + '.html');
    const d = buildDetail(id, html, function (href) {
      const p = buildPlayer(get(HOST + href));
      return !!(p && p.url);
    });
    return JSON.stringify({ list: [d] });
  },

  search(key) {
    const token = extractToken(get(HOST + '/'));
    return JSON.stringify({ list: parseSearchList(get(searchUrl(key, token))) });
  },

  play(flag, id) {
    const player = buildPlayer(get(id));
    return player ? JSON.stringify(player) : '';
  }
};

// ===== FongMi / catvod 端：继承 Spider，方法返回对象 =====
let modern = null;
if (typeof Spider === 'function') {
  modern = class KK extends Spider {
    async fetch(url) {
      const r = await this.net.req(url, options());
      return r && r.content ? r.content : '';
    }

    homeContent(filter) {
      return { class: CLASSES, filters: {} };
    }

    async homeVideoContent() {
      return { list: parseList(await this.fetch(HOST + '/channel/1.html')) };
    }

    async categoryContent(tid, pg, filter, extend) {
      const page = Number(pg) || 1;
      const url = page <= 1 ? (HOST + '/channel/' + tid + '.html') : (HOST + '/channel/' + tid + '-' + page + '.html');
      const list = parseList(await this.fetch(url));
      return {
        page: page,
        pagecount: list.length ? (page + 1) : page,
        limit: 24,
        total: 0,
        list: list
      };
    }

    async detailContent(ids) {
      const id = Array.isArray(ids) ? ids[0] : ids;
      const html = await this.fetch(HOST + '/detail/' + id + '.html');
      const lines = collectLines(html, 8, 300);
      const n = Math.min(lines.length, 6);
      for (let i = 0; i < n; i++) {
        const ph = await this.fetch(HOST + lines[i].firstHref);
        if (buildPlayer(ph)) {
          if (i > 0) { const t = lines[0]; lines[0] = lines[i]; lines[i] = t; }
          break;
        }
      }
      return { list: [assembleDetail(id, html, lines)] };
    }

    async searchContent(key, quick, pg) {
      const token = extractToken(await this.fetch(HOST + '/'));
      return { list: parseSearchList(await this.fetch(searchUrl(key, token))) };
    }

    async playerContent(flag, id, vipFlags) {
      const player = buildPlayer(await this.fetch(id));
      return player || {};
    }
  };
}

export default modern || legacy;
