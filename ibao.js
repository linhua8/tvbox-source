// ibaotv.com（小宝影院）自定义 JS 蜘蛛
// 结构：分类 /index.php/vod/type/id/{tid}/page/{pg}.html
//      详情 /index.php/vod/detail/id/{vid}.html（h1.title / 片头图 data-original / 播放列表 tab-pane）
//      播放 /index.php/vod/play/id/{vid}/sid/{sid}/nid/{nid}.html（页内 player_aaaa.url 为 m3u8）
//      搜索 /index.php/vod/search.html?wd={key}
import * as catvod from 'catvod';

const HOST = 'https://ibaotv.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const Spider = catvod.Spider;
const options = () => ({ headers: { 'User-Agent': UA, 'Referer': HOST + '/' }, timeout: 20000 });

const CLASSES = [
  { type_id: '1', type_name: '电影' },
  { type_id: '2', type_name: '电视剧' },
  { type_id: '3', type_name: '综艺' },
  { type_id: '4', type_name: '动漫' },
  { type_id: '21', type_name: '纪录片' }
];

function unesc(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, '')
    .replace(/&amp;/g, '&');
}

function absUrl(u) {
  if (!u) return '';
  u = unesc(u.trim());
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('http')) return u;
  return HOST + u;
}

// 列表：首页/分类页卡片是 myui-vodlist__thumb，搜索页是同一类名的 media 样式，统一按 a 标签抓
function parseList(html) {
  const list = [];
  const seen = {};
  const re = /<a[^>]*class="[^"]*myui-vodlist__thumb[^"]*"[^>]*>[\s\S]*?<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const block = m[0];
    const href = /href="([^"]*)"/.exec(block);
    if (!href) continue;
    const idm = /\/vod\/detail\/id\/(\d+)\.html/.exec(href[1]);
    if (!idm) continue;
    const vid = '/index.php/vod/detail/id/' + idm[1] + '.html';
    if (seen[vid]) continue;
    seen[vid] = 1;
    const t = /title="([^"]*)"/.exec(block);
    const p = /data-original="([^"]*)"/.exec(block);
    const n = /pic-text text-right">([^<]*)</.exec(block);
    list.push({
      vod_id: vid,
      vod_name: t ? unesc(t[1]).trim() : '',
      vod_pic: p ? absUrl(p[1]) : '',
      vod_remarks: n ? unesc(n[1]).trim() : ''
    });
  }
  return list;
}

function pageCount(html) {
  const nums = [];
  const re = /\/vod\/type\/id\/\d+\/page\/(\d+)\.html/g;
  let m;
  while ((m = re.exec(html))) nums.push(parseInt(m[1], 10));
  return nums.length ? Math.max.apply(null, nums) : 1;
}

function buildDetail(id, html) {
  const name = (/<h1[^>]*class="title"[^>]*>([^<]*)</.exec(html) || ['', ''])[1].trim();
  const pic = /data-original="([^"]+)"/.exec(html);
  const remark = /class="text-red">([^<]*)</.exec(html);
  // 简介：优先取“剧情简介”段落，回退 meta description
  let desc = '';
  const pHtml = /<span[^>]*class="[^"]*data[^"]*"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/.exec(html);
  if (pHtml) {
    desc = unesc(pHtml[1].replace(/<[^>]+>/g, '')).replace(/^[：:]\s*/, '').trim();
  }
  if (!desc) {
    const meta = /name="description" content="([^"]*)"/.exec(html);
    if (meta) {
      const raw = unesc(meta[1]);
      const cut = raw.split(/剧情简介[：:]/)[1];
      desc = (cut || raw).trim();
    }
  }

  // 线路名：播放地址区的 tab（href = #playlistN），按出现顺序记
  const tabNames = [];
  const tabRe = /href="#playlist(\d+)"[^>]*>([^<]{0,20})</g;
  let tm;
  while ((tm = tabRe.exec(html))) {
    tabNames.push(unesc(tm[2]).trim() || ('线路' + tm[1]));
  }

  // 集数：只取播放列表区的 ul.myui-content__list，
  // 避免把页面顶部“最新集数”快捷链接也算成一集（否则同一集会重复出现）
  const playFrom = [];
  const playUrl = [];
  const ulRe = /<ul[^>]*class="[^"]*myui-content__list[^"]*"[^>]*>([\s\S]*?)<\/ul>/g;
  let um;
  let idx = 0;
  const epRe = /href="(\/index\.php\/vod\/play\/id\/\d+\/sid\/(\d+)\/nid\/(\d+)\.html)"[^>]*>([^<]*)</g;
  while ((um = ulRe.exec(html))) {
    const body = um[1];
    const eps = [];
    const seenUrl = {};
    let em;
    while ((em = epRe.exec(body))) {
      const epUrl = HOST + em[1];
      if (seenUrl[epUrl]) continue;
      seenUrl[epUrl] = 1;
      const label = unesc(em[4]).trim() || ('第' + em[3] + '集');
      eps.push(label + '$' + epUrl);
    }
    const lineName = tabNames[idx] || ('线路' + (idx + 1));
    idx++;
    if (!eps.length) continue;
    playFrom.push(lineName);
    playUrl.push(eps.join('#'));
  }

  return {
    vod_id: id,
    vod_name: name,
    vod_pic: pic ? absUrl(pic[1]) : '',
    vod_remarks: remark ? unesc(remark[1]).trim() : '',
    vod_content: desc,
    vod_play_from: playFrom.join('$$$'),
    vod_play_url: playUrl.join('$$$')
  };
}

function buildPlayer(html) {
  const m = /player_aaaa\s*=\s*(\{[\s\S]*?\})<\/script>/.exec(html);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1].replace(/\\\//g, '/'));
    if (!obj || !obj.url) return null;
    return { url: obj.url, parse: 0, header: { 'User-Agent': UA, 'Referer': HOST + '/' } };
  } catch (e) {
    // 兜底：正则直接抠 url
    const u = /"url":"([^"]+)"/.exec(m[1]);
    if (!u) return null;
    return { url: u[1].replace(/\\\//g, '/'), parse: 0, header: { 'User-Agent': UA, 'Referer': HOST + '/' } };
  }
}

function get(url) {
  const r = req(url, options());
  return (r && r.content) ? r.content : '';
}

const legacy = {
  init() {},
  home() { return JSON.stringify({ class: CLASSES, filters: {} }); },
  homeVod() { return JSON.stringify({ list: parseList(get(HOST + '/')) }); },
  category(tid, pg) {
    const page = pg || 1;
    const url = page <= 1 ? (HOST + '/index.php/vod/type/id/' + tid + '.html')
                          : (HOST + '/index.php/vod/type/id/' + tid + '/page/' + page + '.html');
    const html = get(url);
    return JSON.stringify({ page: page, pagecount: pageCount(html), limit: 30, total: 0, list: parseList(html) });
  },
  detail(id) {
    const url = id.startsWith('http') ? id : (HOST + id);
    return JSON.stringify({ list: [buildDetail(id, get(url))] });
  },
  search(key) {
    const url = HOST + '/index.php/vod/search.html?wd=' + encodeURIComponent(key);
    return JSON.stringify({ list: parseList(get(url)) });
  },
  play(flag, id) {
    const url = id.startsWith('http') ? id : (HOST + id);
    const player = buildPlayer(get(url));
    return player ? JSON.stringify(player) : '';
  }
};

let modern = null;
if (typeof Spider === 'function') {
  modern = class IbaoTv extends Spider {
    async fetch(url) {
      const r = await this.net.req(url, options());
      return r && r.content ? r.content : '';
    }
    homeContent(filter) { return { class: CLASSES, filters: {} }; }
    async homeVideoContent() { return { list: parseList(await this.fetch(HOST + '/')) }; }
    async categoryContent(tid, pg, filter, extend) {
      const page = Number(pg) || 1;
      const url = page <= 1 ? (HOST + '/index.php/vod/type/id/' + tid + '.html')
                            : (HOST + '/index.php/vod/type/id/' + tid + '/page/' + page + '.html');
      const html = await this.fetch(url);
      return { page: page, pagecount: pageCount(html), limit: 30, total: 0, list: parseList(html) };
    }
    async detailContent(ids) {
      const id = Array.isArray(ids) ? ids[0] : ids;
      const url = id.startsWith('http') ? id : (HOST + id);
      return { list: [buildDetail(id, await this.fetch(url))] };
    }
    async searchContent(key, quick, pg) {
      const url = HOST + '/index.php/vod/search.html?wd=' + encodeURIComponent(key);
      return { list: parseList(await this.fetch(url)) };
    }
    async playerContent(flag, id, vipFlags) {
      const url = id.startsWith('http') ? id : (HOST + id);
      const player = buildPlayer(await this.fetch(url));
      return player || {};
    }
  };
}

export default modern || legacy;
