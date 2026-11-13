// 可可影视 keke1.app 自定义 JS 蜘蛛（双端兼容 + 自动过 cdndefend PoW）
// 站点：https://www.keke1.app  自建站（非苹果CMS）
// 分类：/channel/{id}.html，分页 /channel/{id}-{page}.html
// 详情：/detail/{id}.html（.episode-list 每块一条线路，线路名在 .source-item-label）
// 播放：/play/{vodId}-{sid}-{nid}.html，页面内嵌明文 playSource.src（无需签名）
// 搜索：/search?k=词&t=首页动态token（每次搜索前先取首页，从搜索链接里抓 t）
// 反爬：cdndefend PoW 挑战（HTTP 850）。页面内 SHA1 求解 base+i，使
//       SHA1(base+i)[parseInt('0x'+base[0])]===0xb0 且 [+1]===0x0b，
//       结果写入 Cookie cdndefend_js_cookie=base+i。本蜘蛛内置 SHA1，
//       首次请求遇到挑战页时自动求解并缓存 Cookie，base 轮换后自动重解。
// - FongMi / catvod（QuickJS）：default 为继承 Spider 的类，方法返回对象
// - TVBox（旧 JS 运行时）：default 为旧对象，方法返回 JSON 字符串，用全局 req
import * as catvod from 'catvod';
const HOST = 'https://www.keke1.app';
const PIC = 'https://vres.wkcyvs.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const Spider = catvod.Spider;

// ===== 内置 SHA1（从 challenge 页面提取，已对 "abc" / "" 向量校验）=====
function Sha1() {
  var f = [];
  this.blocks = f;
  this.h0 = 1732584193; this.h1 = 4023233417; this.h2 = 2562383102; this.h3 = 271733878; this.h4 = 3285377520;
  this.block = this.start = this.bytes = this.hBytes = 0;
  this.finalized = this.hashed = false;
}
Sha1.prototype.update = function (t) {
  if (this.finalized) return this;
  var s = this.blocks, a = s;
  for (var i, e = this.start, r = 0, o = t.length || 0; r < o;) {
    if (this.hashed) {
      this.hashed = false;
      a[0] = this.block;
      a[16] = a[1] = a[2] = a[3] = a[4] = a[5] = a[6] = a[7] = a[8] = a[9] = a[10] = a[11] = a[12] = a[13] = a[14] = a[15] = 0;
    }
    var n = [24, 16, 8, 0];
    for (i = e; r < o && e < 64; ++r) {
      var c = t.charCodeAt(r);
      a[e >> 2] |= (c << n[3 & e++]);
    }
    this.lastByteIndex = e;
    this.bytes += e - this.start;
    e >= 64 ? (this.block = a[16], this.start = e - 64, this.hash(), this.hashed = true) : this.start = e;
  }
  return this;
};
Sha1.prototype.finalize = function () {
  if (this.finalized) return;
  this.finalized = true;
  var t = this.blocks, h = this.lastByteIndex;
  var o = [-2147483648, 8388608, 32768, 128];
  t[16] = this.block;
  t[h >> 2] |= o[3 & h];
  this.block = t[16];
  if (h >= 56) {
    if (!this.hashed) this.hash();
    t[0] = this.block;
    t[16] = t[1] = t[2] = t[3] = t[4] = t[5] = t[6] = t[7] = t[8] = t[9] = t[10] = t[11] = t[12] = t[13] = t[14] = t[15] = 0;
  }
  t[14] = this.hBytes << 3 | this.bytes >>> 29;
  t[15] = this.bytes << 3;
  this.hash();
};
Sha1.prototype.hash = function () {
  var t, h, s = this.h0, i = this.h1, e = this.h2, r = this.h3, o = this.h4, n = this.blocks;
  for (t = 16; t < 80; ++t) {
    h = n[t - 3] ^ n[t - 8] ^ n[t - 14] ^ n[t - 16];
    n[t] = h << 1 | h >>> 31;
  }
  for (t = 0; t < 20; t += 5) {
    s = (h = (i = (h = (e = (h = (r = (h = (o = (h = s << 5 | s >>> 27) + (i & e | ~i & r) + o + 1518500249 + (n[t] << 0)) << 5 | o >>> 27) + (s & (i = i << 30 | i >>> 2) | ~s & e) + r + 1518500249 + (n[t + 1] << 0)) << 5 | r >>> 27) + (o & (s = s << 30 | s >>> 2) | ~o & i) + e + 1518500249 + (n[t + 2] << 0)) << 5 | e >>> 27) + (r & (o = o << 30 | o >>> 2) | ~r & s) + i + 1518500249 + (n[t + 3] << 0)) << 5 | i >>> 27) + (e & (r = r << 30 | r >>> 2) | ~e & o) + s + 1518500249 + (n[t + 4] << 0),
      e = e << 30 | e >>> 2;
  }
  for (; t < 40; t += 5) {
    s = (h = (i = (h = (e = (h = (r = (h = (o = (h = s << 5 | s >>> 27) + (i ^ e ^ r) + o + 1859775393 + (n[t] << 0)) << 5 | o >>> 27) + (s ^ (i = i << 30 | i >>> 2) ^ e) + r + 1859775393 + (n[t + 1] << 0)) << 5 | r >>> 27) + (o ^ (s = s << 30 | s >>> 2) ^ i) + e + 1859775393 + (n[t + 2] << 0)) << 5 | e >>> 27) + (r ^ (o = o << 30 | o >>> 2) ^ s) + i + 1859775393 + (n[t + 3] << 0)) << 5 | i >>> 27) + (e ^ (r = r << 30 | r >>> 2) ^ o) + s + 1859775393 + (n[t + 4] << 0),
      e = e << 30 | e >>> 2;
  }
  for (; t < 60; t += 5) {
    s = (h = (i = (h = (e = (h = (r = (h = (o = (h = s << 5 | s >>> 27) + (i & e | i & r | e & r) + o + -1894007588 + (n[t] << 0)) << 5 | o >>> 27) + (s & (i = i << 30 | i >>> 2) | s & e | i & e) + r + -1894007588 + (n[t + 1] << 0)) << 5 | r >>> 27) + (o & (s = s << 30 | s >>> 2) | o & i | s & i) + e + -1894007588 + (n[t + 2] << 0)) << 5 | e >>> 27) + (r & (o = o << 30 | o >>> 2) | r & s | o & s) + i + -1894007588 + (n[t + 3] << 0)) << 5 | i >>> 27) + (e & (r = r << 30 | r >>> 2) | e & o | r & o) + s + -1894007588 + (n[t + 4] << 0),
      e = e << 30 | e >>> 2;
  }
  for (; t < 80; t += 5) {
    s = (h = (i = (h = (e = (h = (r = (h = (o = (h = s << 5 | s >>> 27) + (i ^ e ^ r) + o + -899497514 + (n[t] << 0)) << 5 | o >>> 27) + (s ^ (i = i << 30 | i >>> 2) ^ e) + r + -899497514 + (n[t + 1] << 0)) << 5 | r >>> 27) + (o ^ (s = s << 30 | s >>> 2) ^ i) + e + -899497514 + (n[t + 2] << 0)) << 5 | e >>> 27) + (r ^ (o = o << 30 | o >>> 2) ^ s) + i + -899497514 + (n[t + 3] << 0)) << 5 | i >>> 27) + (e ^ (r = r << 30 | r >>> 2) ^ o) + s + -899497514 + (n[t + 4] << 0),
      e = e << 30 | e >>> 2;
  }
  this.h0 = (this.h0 + s) << 0; this.h1 = (this.h1 + i) << 0; this.h2 = (this.h2 + e) << 0; this.h3 = (this.h3 + r) << 0; this.h4 = (this.h4 + o) << 0;
};
Sha1.prototype.digest = function () {
  this.finalize();
  var t = this.h0, h = this.h1, s = this.h2, i = this.h3, e = this.h4;
  return [t >>> 24 & 255, t >>> 16 & 255, t >>> 8 & 255, 255 & t,
          h >>> 24 & 255, h >>> 16 & 255, h >>> 8 & 255, 255 & h,
          s >>> 24 & 255, s >>> 16 & 255, s >>> 8 & 255, 255 & s,
          i >>> 24 & 255, i >>> 16 & 255, i >>> 8 & 255, 255 & i,
          e >>> 24 & 255, e >>> 16 & 255, e >>> 8 & 255, 255 & e];
};
function sha1Bytes(str) {
  var s = new Sha1();
  s.update(str);
  return s.digest();
}

// ===== cdndefend PoW 求解 =====
let solvedCookie = '';  // 缓存已解出的 cookie 值（base+i）
function isChallenge(html) {
  return !!html && html.indexOf('cdndefend') !== -1 && html.indexOf('Protected by cdndefend') !== -1;
}
function solveChallenge(html) {
  // 从 ['BASE','cdndefend_js_cookie=','array'] 里提取 40 位 hex base
  var m = /['"]([A-Fa-f0-9]{40})['"]\s*,\s*['"]cdndefend_js_cookie=/.exec(html);
  if (!m) return null;
  var base = m[1];
  var n1 = parseInt('0x' + base[0]);
  for (var i = 0; i < 2000000; i++) {
    var s = sha1Bytes(base + i);
    if (s[n1] === 0xb0 && s[n1 + 1] === 0x0b) {
      return base + i;
    }
  }
  return null;
}
function buildHeaders() {
  var h = {
    'User-Agent': UA,
    'Referer': HOST + '/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9'
  };
  if (solvedCookie) h['Cookie'] = 'cdndefend_js_cookie=' + solvedCookie;
  return h;
}
const options = () => ({
  headers: buildHeaders(),
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
  var r = req(url, options());
  var content = (r && r.content) ? r.content : '';
  if (isChallenge(content)) {
    var ck = solveChallenge(content);
    if (ck) {
      solvedCookie = ck;
      r = req(url, options());
      content = (r && r.content) ? r.content : '';
    }
  }
  return content;
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
    const d = assembleDetail(id, html, collectLines(html, 8, 300));
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
      var r = await this.net.req(url, options());
      var content = (r && r.content) ? r.content : '';
      if (isChallenge(content)) {
        var ck = solveChallenge(content);
        if (ck) {
          solvedCookie = ck;
          r = await this.net.req(url, options());
          content = (r && r.content) ? r.content : '';
        }
      }
      return content;
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
      return { list: [assembleDetail(id, html, collectLines(html, 8, 300))] };
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
