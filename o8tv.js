// o8tv.com (555电影) 自定义 JS 蜘蛛
// 结构：分类 /vodtype/{id}.html，详情 /voddetail/{id}.html，播放页 /vodplay/{id}-{from}-{ep}.html
// 播放页内嵌 player_aaaa JSON，url 字段为 m3u8
import * as catvod from 'catvod';

const HOST = 'https://www.o8tv.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const Spider = catvod.Spider;
const options = () => ({ headers: { 'User-Agent': UA, 'Referer': HOST + '/' }, timeout: 20000 });

const CLASSES = [
  { type_id: '1', type_name: '电影' },
  { type_id: '2', type_name: '电视剧' },
  { type_id: '3', type_name: '综艺' },
  { type_id: '4', type_name: '动漫' },
  { type_id: '126', type_name: '短剧' }
];

function absUrl(u) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  return HOST + u;
}

function parseList(html) {
  const list = [];
  const re = /<a[^>]*href="(\/voddetail\/\d+\.html)"[^>]*title="([^"]*)"[^>]*class="module-poster-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const seg = m[3];
    const pic = /data-original="([^"]+)"/.exec(seg);
    const note = /module-item-note">([^<]*)</.exec(seg);
    list.push({
      vod_id: m[1],
      vod_name: m[2].trim(),
      vod_pic: pic ? absUrl(pic[1]) : '',
      vod_remarks: note ? note[1].trim() : ''
    });
  }
  return list;
}

function buildDetail(id, html) {
  const name = (/<title>([^<]+)</.exec(html) || ['', ''])[1].split('-')[0].trim();
  const pic = /data-original="([^"]+)"/.exec(html);
  const desc = /class="module-info-content[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(html);

  // 按播放源分组集数
  const sourceNames = {};
  const sourceRe = /<li[^>]*class="module-tab-item[^"]*"[^>]*data-type="(\d+)"[^>]*>([\s\S]*?)<\/li>/g;
  let sm;
  while ((sm = sourceRe.exec(html))) {
    const nm = /<span[^>]*>([^<]+)<\/span>/.exec(sm[2]);
    sourceNames[sm[1]] = nm ? nm[1].trim() : '线路' + sm[1];
  }

  const groups = {};
  const epRe = /<a[^>]*class="module-play-list-link"[^>]*href="(\/vodplay\/\d+-(\d+)-\d+\.html)"[^>]*>\s*<span>([^<]+)<\/span>/g;
  let em;
  while ((em = epRe.exec(html))) {
    const from = em[2];
    if (!groups[from]) groups[from] = [];
    groups[from].push(em[3].trim() + '$' + HOST + em[1]);
  }

  const playFrom = [];
  const playUrl = [];
  for (const from in groups) {
    playFrom.push(sourceNames[from] || '线路' + from);
    playUrl.push(groups[from].join('#'));
  }

  return {
    vod_id: id,
    vod_name: name,
    vod_pic: pic ? absUrl(pic[1]) : '',
    vod_remarks: '',
    vod_content: desc ? desc[1].replace(/<[^>]+>/g, '').trim() : '',
    vod_play_from: playFrom.join('$$$'),
    vod_play_url: playUrl.join('$$$')
  };
}

function buildPlayer(html) {
  const m = /player_aaaa=(\{[\s\S]*?\})<\/script>/.exec(html);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[1]);
    if (!obj.url) return null;
    return { url: obj.url.replace(/\\\//g, '/'), parse: 0, header: { 'User-Agent': UA, 'Referer': HOST + '/' } };
  } catch (e) {
    return null;
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
    const url = page <= 1 ? (HOST + '/vodtype/' + tid + '.html') : (HOST + '/vodtype/' + tid + '-' + page + '.html');
    const html = get(url);
    return JSON.stringify({ page: page, pagecount: page + 1, limit: 30, total: 0, list: parseList(html) });
  },
  detail(id) { return JSON.stringify({ list: [buildDetail(id, get(HOST + id))] }); },
  search(key) {
    const url = HOST + '/vodsearch/-------------.html?wd=' + encodeURIComponent(key);
    return JSON.stringify({ list: parseList(get(url)) });
  },
  play(flag, id) {
    const player = buildPlayer(get(id));
    return player ? JSON.stringify(player) : '';
  }
};

let modern = null;
if (typeof Spider === 'function') {
  modern = class O8TV extends Spider {
    async fetch(url) {
      const r = await this.net.req(url, options());
      return r && r.content ? r.content : '';
    }
    homeContent(filter) { return { class: CLASSES, filters: {} }; }
    async homeVideoContent() { return { list: parseList(await this.fetch(HOST + '/')) }; }
    async categoryContent(tid, pg, filter, extend) {
      const page = Number(pg) || 1;
      const url = page <= 1 ? (HOST + '/vodtype/' + tid + '.html') : (HOST + '/vodtype/' + tid + '-' + page + '.html');
      return { page: page, pagecount: page + 1, limit: 30, total: 0, list: parseList(await this.fetch(url)) };
    }
    async detailContent(ids) {
      const id = Array.isArray(ids) ? ids[0] : ids;
      return { list: [buildDetail(id, await this.fetch(HOST + id))] };
    }
    async searchContent(key, quick, pg) {
      const url = HOST + '/vodsearch/-------------.html?wd=' + encodeURIComponent(key);
      return { list: parseList(await this.fetch(url)) };
    }
    async playerContent(flag, id, vipFlags) {
      const player = buildPlayer(await this.fetch(id));
      return player || {};
    }
  };
}

export default modern || legacy;
