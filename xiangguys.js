// 香菇影视 xiangguys.com 自定义 JS 蜘蛛（双端兼容版）
// 结构：搜索 /vod-search-wd-词.html，分类 /<分类>/hjs页.html，
// 详情 /video/<id>.html，播放页 /video/play/<ep>.html 内嵌 cms_player JSON
// - FongMi / catvod（QuickJS）：default 为继承 Spider 的类，方法直接返回对象
// - TVBox（旧 JS 运行时）：default 为旧对象，方法返回 JSON 字符串，用全局 req
import * as catvod from 'catvod';

const HOST = 'https://www.xiangguys.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const Spider = catvod.Spider;
const options = () => ({ headers: { 'User-Agent': UA }, timeout: 20000 });

const CLASSES = [
  { type_id: '/dongzuo', type_name: '动作电影' },
  { type_id: '/aiqing', type_name: '爱情电影' },
  { type_id: '/kehuan', type_name: '科幻电影' },
  { type_id: '/juqing', type_name: '剧情电影' },
  { type_id: '/kongbu', type_name: '恐怖电影' },
  { type_id: '/xiju', type_name: '喜剧电影' },
  { type_id: '/zhanzheng', type_name: '战争电影' },
  { type_id: '/donghua', type_name: '动画动漫' },
  { type_id: '/haokandianying', type_name: '好看电影' }
];

// 解析卡片列表（搜索/分类/首页通用）
function parseList(html) {
  const list = [];
  const re = /<a class="thumbnail" href="(\/video\/\d+\.html)" title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const seg = m[3];
    const pi = /data-original="([^"]+)"/.exec(seg);
    const gr = /video-grade[^>]*>([^<]+)</.exec(seg);
    list.push({
      vod_id: m[1],
      vod_name: m[2],
      vod_pic: pi ? pi[1] : '',
      vod_remarks: gr ? gr[1] : ''
    });
  }
  return list;
}

// 取分页总数
function parsePageCount(html) {
  const nums = [];
  const re = /hjs(\d+)\.html/g;
  let m;
  while ((m = re.exec(html))) nums.push(parseInt(m[1], 10));
  return nums.length ? Math.max.apply(null, nums) : 1;
}

// 详情对象（两端共用）
function buildDetail(id, html) {
  const h2 = /<h2>([\s\S]*?)<\/h2>/.exec(html);
  let vodName = '';
  let vodRemarks = '';
  if (h2) {
    const seg = h2[1];
    vodName = (/([^<]+)/.exec(seg) || [''])[1].trim();
    const sm = /<small>([^<]+)<\/small>/.exec(seg);
    if (sm) vodRemarks = sm[1];
  }
  const pi = /detail-poster[\s\S]*?<img src="([^"]+)"/.exec(html);
  const eps = [];
  const re = /<li data-id="[^"]+"><a href="(\/video\/play\/[^"]+\.html)"[^>]*>([^<]+)<\/a><\/li>/g;
  let m;
  while ((m = re.exec(html))) {
    eps.push(m[2].trim() + '$' + HOST + m[1]);
  }
  return {
    vod_id: id,
    vod_name: vodName,
    vod_pic: pi ? pi[1] : '',
    vod_remarks: vodRemarks,
    vod_content: '',
    vod_play_from: '香菇在线',
    vod_play_url: eps.join('#')
  };
}

// 播放对象（两端共用）
function buildPlayer(html) {
  const m = /var cms_player = (\{[\s\S]*?\});/.exec(html);
  if (!m) return null;
  const obj = JSON.parse(m[1]);
  return { url: obj.url, parse: 0, header: { 'User-Agent': UA } };
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
    return JSON.stringify({ list: parseList(get(HOST + '/')) });
  },

  category(tid, pg) {
    const page = pg || 1;
    const html = get(HOST + tid + '/hjs' + page + '.html');
    return JSON.stringify({
      page: page,
      pagecount: parsePageCount(html),
      limit: 20,
      total: 0,
      list: parseList(html)
    });
  },

  detail(id) {
    return JSON.stringify({ list: [buildDetail(id, get(HOST + id))] });
  },

  search(key) {
    return JSON.stringify({ list: parseList(get(HOST + '/vod-search-wd-' + encodeURIComponent(key) + '.html')) });
  },

  play(flag, id) {
    const player = buildPlayer(get(id));
    return player ? JSON.stringify(player) : '';
  }
};

// ===== FongMi / catvod 端：继承 Spider，方法返回对象 =====
let modern = null;
if (typeof Spider === 'function') {
  modern = class XG extends Spider {
    async fetch(url) {
      const r = await this.net.req(url, options());
      return r && r.content ? r.content : '';
    }

    homeContent(filter) {
      return { class: CLASSES, filters: {} };
    }

    async homeVideoContent() {
      return { list: parseList(await this.fetch(HOST + '/')) };
    }

    async categoryContent(tid, pg, filter, extend) {
      const page = Number(pg) || 1;
      const html = await this.fetch(HOST + tid + '/hjs' + page + '.html');
      return {
        page: page,
        pagecount: parsePageCount(html),
        limit: 20,
        total: 0,
        list: parseList(html)
      };
    }

    async detailContent(ids) {
      const id = Array.isArray(ids) ? ids[0] : ids;
      return { list: [buildDetail(id, await this.fetch(HOST + id))] };
    }

    async searchContent(key, quick, pg) {
      return { list: parseList(await this.fetch(HOST + '/vod-search-wd-' + encodeURIComponent(key) + '.html')) };
    }

    async playerContent(flag, id, vipFlags) {
      const player = buildPlayer(await this.fetch(id));
      return player || {};
    }
  };
}

export default modern || legacy;
