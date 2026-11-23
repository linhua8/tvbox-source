// fdzys.com（饭搭子影视）自定义 JS 蜘蛛
// 站点是 mizhiady 模板，官方 api.php 已关闭，只能按网页结构抓取：
//   分类 /movie/all?page=N、/tv/all、/dongman/all、/zongyi/all、/duanju/all、/tiyu/all
//   搜索 /yu-{关键词}-xianguan-de-yingpian-shippin-zhibo
//   详情页 h1.title / og:image / vod-content / playlistN 分集
//   播放页 player_aaaa.url 可能是 m3u8，也可能是 cdn.*/share/* 的分享页，分享页里有 var main 直链
import * as catvod from 'catvod';

const HOST = 'https://fdzys.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const Spider = catvod.Spider;
const headers = { 'User-Agent': UA, 'Referer': HOST + '/' };
const options = (referer) => ({
  headers: { 'User-Agent': UA, 'Referer': referer || (HOST + '/') },
  timeout: 20000
});

const CLASSES = [
  { type_id: 'movie', type_name: '电影' },
  { type_id: 'tv', type_name: '电视剧' },
  { type_id: 'dongman', type_name: '动漫' },
  { type_id: 'zongyi', type_name: '综艺' },
  { type_id: 'duanju', type_name: '短剧' },
  { type_id: 'tiyu', type_name: '体育' }
];

const CATS = {
  movie: '/movie/all',
  tv: '/tv/all',
  dongman: '/dongman/all',
  zongyi: '/zongyi/all',
  duanju: '/duanju/all',
  tiyu: '/tiyu/all'
};

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
  return unesc(String(s == null ? '' : s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function abs(u) {
  if (!u) return '';
  u = unesc(String(u).trim());
  if (u.indexOf('//') === 0) return 'https:' + u;
  if (u.indexOf('http') === 0) return u;
  return HOST + (u.charAt(0) === '/' ? u : '/' + u);
}

function isDetailUrl(u) {
  return /^https:\/\/fdzys\.com\/(movie|tv|dongman|zongyi|duanju|tiyu)\/[^/?#]+/.test(u) &&
    !/\/all(?:$|\?)/.test(u);
}

// 分类/搜索页卡片：div.myui-vodbox-content + a[href] + content-card
function parseList(html) {
  const list = [];
  const seen = {};
  const parts = String(html || '').split('myui-vodbox-content');
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].slice(0, 6000);
    const a = /<a\s+href="([^"]+)"/.exec(block);
    if (!a) continue;
    const id = abs(a[1]);
    if (!isDetailUrl(id) || seen[id]) continue;
    const pic = /<img[^>]+data-src="([^"]+)"/.exec(block) || /<img[^>]+src="([^"]+)"/.exec(block);
    const title = /<div\s+class="title">([\s\S]*?)<\/div>/.exec(block);
    const tag = /<div\s+class="tag text-overflow">([\s\S]*?)<\/div>/.exec(block);
    const score = /<div\s+class="score"[^>]*>([\s\S]*?)<\/div>/.exec(block);
    const name = title ? plain(title[1]) : '';
    if (!name) continue;
    seen[id] = 1;
    list.push({
      vod_id: id,
      vod_name: name,
      vod_pic: pic ? abs(pic[1]) : '',
      vod_remarks: plain(tag ? tag[1] : (score ? score[1] : ''))
    });
  }
  return list;
}

function pageCount(html) {
  const nums = [];
  const re = /[?&]page=(\d+)/g;
  let m;
  while ((m = re.exec(String(html || '')))) nums.push(parseInt(m[1], 10));
  return nums.length ? Math.max.apply(null, nums) : 1;
}

function parseDetail(id, html) {
  const url = abs(id);
  const nameM = /<h1[^>]*class="title"[^>]*>([\s\S]*?)<\/h1>/.exec(html) ||
    /<meta\s+property="og:title"\s+content="([^"]+)"/.exec(html);
  const name = nameM ? plain(nameM[1]).replace(/_?免费在线观看.*$/, '').trim() : '';

  const picM = /<meta\s+property="og:image"\s+content="([^"]+)"/.exec(html) ||
    /<img[^>]+data-src="([^"]+)"/.exec(html);
  const pic = picM ? abs(picM[1]) : '';

  // 主简介在 h1 后面的 vod-content，页面顶部还有一堆相关推荐，不能直接用第一个 info-intro
  let desc = '';
  const contentM = /<div\s+class="vod-content">([\s\S]*?)<!--\s*面包屑导航/.exec(html);
  if (contentM) {
    desc = plain(contentM[1].replace(/^[\s\S]*?<div\s+class="intro">/, '')).replace(/^简介[：:]\s*/, '').trim();
  }
  if (!desc) {
    const meta = /<meta\s+name="description"\s+content="([^"]+)"/.exec(html);
    desc = meta ? unesc(meta[1]).trim() : '';
  }

  const scoreM = /<div\s+class="other-box">[\s\S]*?<div\s+class="score">([^<]+)</.exec(html);
  const remark = scoreM ? plain(scoreM[1]) : '';

  // 线路名：播放地址区的 li.player_name[data-sid]
  const tabNames = {};
  const tabRe = /<li[^>]*class="[^"]*player_name[^"]*"[^>]*data-sid="(\d+)"[\s\S]{0,160}?class="swiper-slide-text">([^<]+)/g;
  let tm;
  while ((tm = tabRe.exec(html))) {
    tabNames[String(tm[1])] = unesc(tm[2]).trim() || ('线路' + tm[1]);
  }

  const slug = url.replace(HOST, '').split('?')[0].replace(/\/$/, '');
  const escSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const groups = {};

  // 按播放列表区块抓：电影集名可能是 hd-guo-yu，电视剧是 1、2、3，不能只认数字
  const parts = String(html).split(/<div\s+id="playlist/);
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].slice(0, 8000);
    const sidM = /data-sid="(\d+)"/.exec(block);
    const sid = sidM ? sidM[1] : String(i);
    const epBlockRe = /<a[^>]+href="([^"]+)"[^>]*>([^<]*)</g;
    let em;
    while ((em = epBlockRe.exec(block))) {
      const href = abs(em[1]);
      if (href.indexOf(slug + '/') < 0) continue;
      const label = plain(em[2]) || ('第' + (href.match(/\/([^\/?#]+)(?:\?|$)/) || ['', '1'])[1]);
      if (!groups[sid]) groups[sid] = [];
      if (groups[sid].some(function (x) { return x.url === href; })) continue;
      groups[sid].push({ name: label, url: href });
    }
  }

  // 兜底：页面结构变化时仍按本详情路径 + 数字抓
  if (!Object.keys(groups).length) {
    const epRe = new RegExp('href="([^"]*' + escSlug + '/\\d+(?:\\?sid=\\d+)?)"[^>]*>([^<]*)<', 'g');
    let em;
    while ((em = epRe.exec(html))) {
      const href = abs(em[1]);
      const sidM = /[?&]sid=(\d+)/.exec(em[1]);
      const sid = sidM ? sidM[1] : '1';
      const label = plain(em[2]) || ('第' + (href.match(/\/(\d+)(?:\?|$)/) || ['', '1'])[1] + '集');
      if (!groups[sid]) groups[sid] = [];
      if (groups[sid].some(function (x) { return x.url === href; })) continue;
      groups[sid].push({ name: label, url: href });
    }
  }

  const playFrom = [];
  const playUrl = [];
  const order = Object.keys(tabNames);
  Object.keys(groups).forEach(function (sid) { if (order.indexOf(sid) < 0) order.push(sid); });
  order.forEach(function (sid) {
    const eps = groups[sid];
    if (!eps || !eps.length) return;
    playFrom.push(tabNames[sid] || ('线路' + sid));
    playUrl.push(eps.map(function (e) { return e.name + '$' + e.url; }).join('#'));
  });

  return {
    vod_id: url,
    vod_name: name,
    vod_pic: pic,
    vod_remarks: remark,
    vod_content: desc,
    vod_play_from: playFrom.join('$$$'),
    vod_play_url: playUrl.join('$$$')
  };
}

function parsePlayer(html) {
  const m = /var\s+player_aaaa\s*=\s*(\{[\s\S]+?\})\s*;?\s*<\/script>/.exec(String(html || ''));
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1]);
    if (!obj || !obj.url) return null;
    return obj;
  } catch (e) {
    const u = /"url":"([^"]+)"/.exec(m[1]);
    return u ? { url: u[1].replace(/\\\//g, '/'), encrypt: 0 } : null;
  }
}

function decodePlayer(data) {
  if (!data || !data.url) return '';
  let u = data.url;
  try {
    if (String(data.encrypt) === '1' && typeof unescape === 'function') u = unescape(u);
    else if (String(data.encrypt) === '2' && typeof atob === 'function' && typeof unescape === 'function') u = unescape(atob(u));
  } catch (e) {}
  return String(u || '').replace(/\\\//g, '/');
}

function shareMain(html, shareUrl) {
  const m = /(?:var|let|const)\s+(?:main|url)\s*=\s*"([^"]+)"/.exec(String(html || ''));
  if (!m) return '';
  let main = m[1].replace(/\\\//g, '/');
  if (/^http/i.test(main)) return main;
  const originM = /^(https?:\/\/[^\/]+)/.exec(shareUrl);
  const origin = originM ? originM[1] : 'https://cdn.ryplay12.com';
  return origin + (main.charAt(0) === '/' ? main : '/' + main);
}

function playerResult(video, epUrl) {
  return {
    parse: 0,
    url: video,
    header: {
      'User-Agent': UA,
      'Referer': epUrl || (HOST + '/')
    }
  };
}

function resolveVideoSync(epUrl) {
  const html = get(epUrl, epUrl);
  const data = parsePlayer(html);
  let video = decodePlayer(data);
  if (!video) return '';
  if (!/\.(m3u8|mp4)(?:$|\?)/i.test(video)) {
    const share = get(video, epUrl);
    const main = shareMain(share, video);
    if (main) video = main;
  }
  return video;
}

function get(url, referer) {
  const r = req(url, options(referer));
  return (r && r.content) ? r.content : '';
}

const legacy = {
  init() {},
  home() { return JSON.stringify({ class: CLASSES, filters: {} }); },
  homeVod() {
    try { return JSON.stringify({ list: parseList(get(HOST + '/')) }); }
    catch (e) { return JSON.stringify({ list: [] }); }
  },
  category(tid, pg) {
    const page = Number(pg) || 1;
    const path = CATS[tid] || ('/' + tid + '/all');
    const url = HOST + path + (page > 1 ? ('?page=' + page) : '');
    try {
      const html = get(url);
      return JSON.stringify({
        page: page,
        pagecount: Math.max(pageCount(html), page, 24),
        limit: 24,
        total: 0,
        list: parseList(html)
      });
    } catch (e) {
      return JSON.stringify({ page: page, pagecount: page, limit: 24, total: 0, list: [] });
    }
  },
  detail(id) {
    try {
      const url = abs(Array.isArray(id) ? id[0] : id);
      return JSON.stringify({ list: [parseDetail(url, get(url))] });
    } catch (e) { return JSON.stringify({ list: [] }); }
  },
  search(key) {
    try {
      const url = HOST + '/yu-' + encodeURIComponent(key || '') + '-xianguan-de-yingpian-shippin-zhibo';
      return JSON.stringify({ list: parseList(get(url)) });
    } catch (e) { return JSON.stringify({ list: [] }); }
  },
  play(flag, id) {
    try {
      const epUrl = abs(id);
      const video = resolveVideoSync(epUrl);
      return video ? JSON.stringify(playerResult(video, epUrl)) : '';
    } catch (e) { return ''; }
  }
};

let modern = null;
if (typeof Spider === 'function') {
  modern = class Fdzys extends Spider {
    async fetch(url, referer) {
      const r = await this.net.req(url, options(referer));
      return r && r.content ? r.content : '';
    }
    homeContent(filter) { return { class: CLASSES, filters: {} }; }
    async homeVideoContent() {
      try { return { list: parseList(await this.fetch(HOST + '/')) }; }
      catch (e) { return { list: [] }; }
    }
    async categoryContent(tid, pg) {
      const page = Number(pg) || 1;
      const path = CATS[tid] || ('/' + tid + '/all');
      const url = HOST + path + (page > 1 ? ('?page=' + page) : '');
      try {
        const html = await this.fetch(url);
        return {
          page: page,
          pagecount: Math.max(pageCount(html), page, 24),
          limit: 24,
          total: 0,
          list: parseList(html)
        };
      } catch (e) {
        return { page: page, pagecount: page, limit: 24, total: 0, list: [] };
      }
    }
    async detailContent(ids) {
      const id = Array.isArray(ids) ? ids[0] : ids;
      const url = abs(id);
      try { return { list: [parseDetail(url, await this.fetch(url, url))] }; }
      catch (e) { return { list: [] }; }
    }
    async searchContent(key) {
      const url = HOST + '/yu-' + encodeURIComponent(key || '') + '-xianguan-de-yingpian-shippin-zhibo';
      try { return { list: parseList(await this.fetch(url)) }; }
      catch (e) { return { list: [] }; }
    }
    async playerContent(flag, id) {
      const epUrl = abs(id);
      try {
        const html = await this.fetch(epUrl, epUrl);
        const data = parsePlayer(html);
        let video = decodePlayer(data);
        if (!video) return {};
        if (!/\.(m3u8|mp4)(?:$|\?)/i.test(video)) {
          const share = await this.fetch(video, epUrl);
          const main = shareMain(share, video);
          if (main) video = main;
        }
        return playerResult(video, epUrl);
      } catch (e) { return {}; }
    }
  };
}

export default modern || legacy;
