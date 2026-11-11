// 努努影院 nnyy.in 自定义 JS 蜘蛛（双端兼容版）
// 分类 /dianying/ /dianshiju/ /zongyi/ /dongman/，翻页 ?page=N（每页 24 条）
// 搜索 /so?q=关键词
// 详情 /<分类>/<id>.html，剧集为 <li class="play-btn" ep_slug="epNN">
// 播放接口 /_gp/<id>/<ep_slug> 返回 JSON：video_plays[0].play_data 即 m3u8 直链
// - TVBox（旧 JS 运行时）：default 为旧对象，方法返回 JSON 字符串，用全局 req
// - FongMi / catvod（QuickJS）：default 为继承 Spider 的类，方法直接返回对象
import * as catvod from 'catvod';

const HOST = 'https://nnyy.in';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const Spider = catvod.Spider;
const options = () => ({ headers: { 'User-Agent': UA }, timeout: 20000 });

const CLASSES = [
  { type_id: 'dianying', type_name: '电影' },
  { type_id: 'dianshiju', type_name: '电视剧' },
  { type_id: 'zongyi', type_name: '综艺' },
  { type_id: 'dongman', type_name: '动漫' }
];

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function absUrl(u) {
  if (!u) return '';
  if (u.indexOf('//') === 0) return 'https:' + u;
  if (u.charAt(0) === '/') return HOST + u;
  return u;
}

// 解析卡片列表（首页 / 分类 / 搜索通用）
function parseList(html) {
  const list = [];
  const seen = {};
  const re = /<li>[\s\S]*?<\/li>/g;
  let m;
  while ((m = re.exec(html))) {
    const seg = m[0];
    const link = /href="(\/(?:dianying|dianshiju|zongyi|dongman)\/\d+\.html)" class="thumbnail"/.exec(seg);
    if (!link) continue;
    if (seen[link[1]]) continue;
    seen[link[1]] = 1;
    const nameM = /<h2><a[\s\S]*?>([^<]+)<\/a><\/h2>/.exec(seg);
    const altM = /alt="([^"]+)"/.exec(seg);
    const picM = /data-src="([^"]+)"/.exec(seg) || /src="(\/nnimg\d?\/[^"]+)"/.exec(seg);
    const noteM = /class="note"><span>([^<]+)<\/span>/.exec(seg);
    list.push({
      vod_id: link[1],
      vod_name: nameM ? nameM[1].trim() : (altM ? altM[1].trim() : ''),
      vod_pic: absUrl(picM ? picM[1] : ''),
      vod_remarks: noteM ? noteM[1].trim() : ''
    });
  }
  return list;
}

// 详情对象（两端共用）
function buildDetail(id, html) {
  let vodName = '';
  let vodYear = '';
  const h1 = /<h1 class="product-title"[\s\S]*?>([\s\S]*?)<\/h1>/.exec(html);
  if (h1) {
    const text = stripTags(h1[1]);
    const ym = /\(\s*(\d{4})\s*\)/.exec(text);
    if (ym) vodYear = ym[1];
    vodName = text.replace(/\(\s*\d{4}\s*\)/g, '').trim();
  }
  const altM = /class="thumb detail-img" alt="([^"]+)"/.exec(html) || /alt="([^"]+)" class="thumb detail-img"/.exec(html);
  const picM = /<img src="([^"]+)" class="thumb detail-img"/.exec(html) || /data-original="([^"]+)"/.exec(html);
  if (!vodName && altM) vodName = altM[1].trim();

  const contM = /剧情简介：<span>([\s\S]*?)<\/span>/.exec(html);
  const vodContent = contM ? stripTags(contM[1]) : '';

  const infoOf = (label) => {
    const re = new RegExp('class="product-excerpt">' + label + '：([\\s\\S]*?)</div>');
    const mm = re.exec(html);
    return mm ? stripTags(mm[1]) : '';
  };
  const director = infoOf('导演');
  const actor = infoOf('主演');
  const type = infoOf('类型');
  const area = infoOf('制片国家\\/地区');

  const vid = (/\/(\d+)\.html/.exec(id) || ['', ''])[1];
  const eps = [];
  const epsRe = /<li class="play-btn"[^>]*ep_slug="([^"]+)"[^>]*><a[^>]*>([^<]+)<\/a>/g;
  let em;
  while ((em = epsRe.exec(html))) {
    const label = stripTags(em[2]) || '播放';
    eps.push({ num: label, url: HOST + '/_gp/' + vid + '/' + em[1], slug: em[1] });
  }
  // 页面默认按倒序输出，能识别集数时按集数升序排
  const numbered = eps.filter((e) => /第\s*\d+\s*集/.test(e.num));
  if (eps.length > 1 && numbered.length === eps.length) {
    eps.sort((a, b) => parseInt((/第\s*(\d+)\s*集/.exec(a.num) || [0, 0])[1], 10) - parseInt((/第\s*(\d+)\s*集/.exec(b.num) || [0, 0])[1], 10));
  }

  return {
    vod_id: id,
    vod_name: vodName,
    vod_pic: absUrl(picM ? picM[1] : ''),
    vod_year: vodYear,
    vod_area: area,
    vod_remarks: vodYear ? vodYear + '年' : '',
    vod_actor: actor,
    vod_director: director,
    vod_content: vodContent,
    vod_play_from: '努努影院',
    vod_play_url: eps.map((e) => e.num + '$' + e.url).join('#')
  };
}

// 播放对象（两端共用）：_gp 接口返回的 video_plays[] 就是各线路，挑第一条通的 m3u8
function extractPlays(jsonText) {
  if (!jsonText) return [];
  let obj = null;
  try { obj = JSON.parse(jsonText); } catch (e) { return []; }
  const plays = obj && obj.video_plays ? obj.video_plays : [];
  const urls = [];
  for (let i = 0; i < plays.length; i++) {
    const u = plays[i] && (plays[i].play_data || plays[i].url);
    if (u && urls.indexOf(u) === -1) urls.push(u);
  }
  return urls;
}

function playerOf(url) {
  return { url: url, parse: 0, header: { 'User-Agent': UA, 'Referer': HOST + '/' } };
}

// 依次试探，最多取前 3 条，能拿到 #EXTM3U 的就用
function pickPlayable(urls, fetchText) {
  const max = Math.min(urls.length, 3);
  for (let i = 0; i < max; i++) {
    const body = fetchText(urls[i]);
    if (body && body.indexOf('#EXTM3U') >= 0) return playerOf(urls[i]);
  }
  return urls.length ? playerOf(urls[0]) : null;
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
    return JSON.stringify({ list: parseList(get(HOST + '/')).slice(0, 60) });
  },

  category(tid, pg) {
    const page = Number(pg) || 1;
    const html = get(HOST + '/' + tid + '/?page=' + page);
    const list = parseList(html);
    return JSON.stringify({
      page: page,
      pagecount: list.length >= 20 ? page + 1 : page,
      limit: 24,
      total: 0,
      list: list
    });
  },

  detail(id) {
    return JSON.stringify({ list: [buildDetail(id, get(HOST + id))] });
  },

  search(key, quick, pg) {
    const page = Number(pg) || 1;
    const html = get(HOST + '/so?q=' + encodeURIComponent(key) + (page > 1 ? '&page=' + page : ''));
    const list = parseList(html);
    return JSON.stringify({
      page: page,
      pagecount: list.length >= 20 ? page + 1 : page,
      limit: 24,
      total: 0,
      list: list
    });
  },

  play(flag, id) {
    const urls = extractPlays(get(id));
    const player = pickPlayable(urls, (u) => get(u));
    return player ? JSON.stringify(player) : '';
  }
};

// ===== FongMi / catvod 端：继承 Spider，方法返回对象 =====
let modern = null;
if (typeof Spider === 'function') {
  modern = class NN extends Spider {
    async fetch(url) {
      const r = await this.net.req(url, options());
      return r && r.content ? r.content : '';
    }

    homeContent(filter) {
      return { class: CLASSES, filters: {} };
    }

    async homeVideoContent() {
      return { list: parseList(await this.fetch(HOST + '/')).slice(0, 60) };
    }

    async categoryContent(tid, pg, filter, extend) {
      const page = Number(pg) || 1;
      const list = parseList(await this.fetch(HOST + '/' + tid + '/?page=' + page));
      return {
        page: page,
        pagecount: list.length >= 20 ? page + 1 : page,
        limit: 24,
        total: 0,
        list: list
      };
    }

    async detailContent(ids) {
      const id = Array.isArray(ids) ? ids[0] : ids;
      return { list: [buildDetail(id, await this.fetch(HOST + id))] };
    }

    async searchContent(key, quick, pg) {
      const page = Number(pg) || 1;
      const list = parseList(await this.fetch(HOST + '/so?q=' + encodeURIComponent(key) + (page > 1 ? '&page=' + page : '')));
      return {
        page: page,
        pagecount: list.length >= 20 ? page + 1 : page,
        limit: 24,
        total: 0,
        list: list
      };
    }

    async playerContent(flag, id, vipFlags) {
      const urls = extractPlays(await this.fetch(id));
      const max = Math.min(urls.length, 3);
      for (let i = 0; i < max; i++) {
        const body = await this.fetch(urls[i]);
        if (body && body.indexOf('#EXTM3U') >= 0) return playerOf(urls[i]);
      }
      return urls.length ? playerOf(urls[0]) : {};
    }
  };
}

export default modern || legacy;
