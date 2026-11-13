// 美剧天堂 meijutt.cc 自定义 JS 蜘蛛（双端兼容 + cookie 反爬自动重试）
// 站点：https://www.meijutt.cc  PHP 站（非苹果CMS）
// 分类：/mjtt/{catId}.html（第1页），/mjtt/{catId}-{page}.html（第N页）
//   1=魔幻科幻 2=灵异惊悚 3=都市情感 4=犯罪历史 5=选秀综艺 6=动漫卡通
// 详情：/meijutt/{id}.html
// 播放：/meijuplay/{id}-{source}-{ep}.html，页面内嵌 var now=unescape("URL编码m3u8")
// 线路：动态从页面 label 提取（无尽视频/最大视频/索尼视频/优质视频/量子资源）
// 搜索：搜索页有验证码，不支持
// 反爬：详情/播放页首次请求返回 403 + JS 跳转 + Set-Cookie 种 cookie。
//   TVBox/系统 HTTP 层会自动维护 cookie jar，所以本蜘蛛检测到拦截页后
//   自动重试一次（第二次请求携带刚种下的 cookie 即 200）。cookie 名是
//   hash（94c7e1b3...），不硬编码，不解析 header，靠自动重试过墙。
// - FongMi / catvod（QuickJS）：default 为继承 Spider 的类，方法返回对象
// - TVBox（旧 JS 运行时）：default 为旧对象，方法返回 JSON 字符串，用全局 req
import * as catvod from 'catvod';
const HOST = 'https://www.meijutt.cc';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const Spider = catvod.Spider;

// 分类列表
const CLASSES = [
  { type_id: '1', type_name: '魔幻科幻' },
  { type_id: '2', type_name: '灵异惊悚' },
  { type_id: '3', type_name: '都市情感' },
  { type_id: '4', type_name: '犯罪历史' },
  { type_id: '5', type_name: '选秀综艺' },
  { type_id: '6', type_name: '动漫卡通' }
];

// 线路名（从页面动态提取，这里只是兜底）
const SOURCE_NAMES_FALLBACK = ['线路1', '线路2', '线路3', '线路4', '线路5'];

function buildHeaders() {
  return {
    'User-Agent': UA,
    'Referer': HOST + '/',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9'
  };
}
const options = () => ({
  headers: buildHeaders(),
  timeout: 20000
});

// 检测是否是反爬拦截页（403 + JS 跳转）
function isBlocked(html) {
  if (!html) return false;
  // 拦截页特征：很短 + 含 window.location.href 跳转
  return html.length < 500 && /window\.location\.href/.test(html);
}

// 解析分类列表页
function parseList(html) {
  const list = [];
  const seen = {};
  // 分类页列表项：<a title="片名" href="/meijutt/12345.html" target="_blank">片名</a>
  // title 在 href 前面
  const re = /<a[^>]*title="([^"]*)"[^>]*href="\/meijutt\/(\d+)\.html"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const id = m[2];
    if (seen[id]) continue;
    seen[id] = true;
    list.push({
      vod_id: id,
      vod_name: m[1].trim(),
      vod_pic: '',
      vod_remarks: ''
    });
  }
  return list;
}

// 从详情页提取封面
function parseCover(html) {
  const m = /class="lazy-img"[^>]*data-src="([^"]+)"/.exec(html);
  return m ? m[1] : '';
}

// 从详情页提取简介
function parseContent(html) {
  // 找简介正文块
  const m = /<div class="o_r_contact">([\s\S]*?)<\/div>\s*<\/div>/.exec(html);
  if (m) return m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  // 兜底：meta description
  const d = /<meta name="description" content="([^"]*)"\/>/.exec(html);
  return d ? d[1].replace(/美剧天堂提供[^：]*：/, '').trim() : '';
}

// 从详情页提取标题
function parseName(html) {
  const m = /<div class="info-title"><span>([^<]*)<\/span><h1>([^<]*)<\/h1>/.exec(html);
  if (m) return m[2].trim();
  const t = /<title>([^<]*)<\/title>/.exec(html);
  return t ? t[1].split('-')[0].trim() : '';
}

// 收集线路和剧集
function collectLines(html) {
  const lines = [];
  // 动态提取线路名：<label class="playIco_XXX">名称<em>[N]</em></label>
  const sourceNames = [];
  const reName = /<label[^>]*class="playIco_[^"]*"[^>]*>([^<]+)<em>/g;
  let nm;
  while ((nm = reName.exec(html))) sourceNames.push(nm[1].trim());
  // 按 source 分组：找所有 /meijuplay/{id}-{src}-{ep}.html 链接
  // 注意 HTML 里 title 在 href 前面：<a title="第01集" href="/meijuplay/...">
  const reEp = /<a[^>]*title="([^"]*)"[^>]*href="\/meijuplay\/(\d+)-(\d+)-(\d+)\.html"[^>]*>/g;
  let m;
  const groups = {}; // src -> [{name, url}]
  while ((m = reEp.exec(html))) {
    const src = m[3];
    const epName = m[1].trim();
    if (!groups[src]) groups[src] = [];
    groups[src].push({ name: epName, url: HOST + '/meijuplay/' + m[2] + '-' + src + '-' + m[4] + '.html' });
  }
  // 按 source 顺序输出
  const srcKeys = Object.keys(groups).sort(function(a, b) { return Number(a) - Number(b); });
  for (let i = 0; i < srcKeys.length; i++) {
    const src = srcKeys[i];
    const eps = groups[src];
    const fromName = sourceNames[Number(src)] || SOURCE_NAMES_FALLBACK[Number(src)] || ('线路' + (Number(src) + 1));
    const parts = [];
    for (let k = 0; k < eps.length; k++) {
      parts.push(eps[k].name + '$' + eps[k].url);
    }
    lines.push({ name: fromName, parts: parts });
  }
  return lines;
}

function assembleDetail(id, html) {
  const lines = collectLines(html);
  return {
    vod_id: id,
    vod_name: parseName(html),
    vod_pic: parseCover(html),
    vod_remarks: '',
    vod_content: parseContent(html),
    vod_play_from: lines.map(function(l) { return l.name; }).join('$$$'),
    vod_play_url: lines.map(function(l) { return l.parts.join('#'); }).join('$$$')
  };
}

// 播放页：从 var now=unescape("...") 提取 m3u8
function buildPlayer(html) {
  // var now=unescape("https%3A%2F%2F...m3u8");
  const m = /var\s+now\s*=\s*unescape\("([^"]+)"\)/.exec(html);
  if (!m) return null;
  var url;
  try {
    url = decodeURIComponent(m[1]);
  } catch (e) {
    url = unescape(m[1]);
  }
  if (!/^https?:/.test(url)) return null;
  return {
    url: url,
    parse: 0,
    header: { 'User-Agent': UA, 'Referer': HOST + '/' }
  };
}

// ===== TVBox 旧端：同步全局 req，方法返回 JSON 字符串 =====
function get(url) {
  var r = req(url, options());
  var content = (r && r.content) ? r.content : '';
  // 反爬拦截页：自动重试一次（cookie jar 会带上第一次种下的 cookie）
  if (isBlocked(content)) {
    r = req(url, options());
    content = (r && r.content) ? r.content : '';
  }
  return content;
}

const legacy = {
  init() {},
  home() {
    return JSON.stringify({ class: CLASSES, filters: {} });
  },
  homeVod() {
    return JSON.stringify({ list: parseList(get(HOST + '/mjtt/1.html')) });
  },
  category(tid, pg) {
    const page = Number(pg) || 1;
    const url = page <= 1
      ? (HOST + '/mjtt/' + tid + '.html')
      : (HOST + '/mjtt/' + tid + '-' + page + '.html');
    const list = parseList(get(url));
    return JSON.stringify({
      page: page,
      pagecount: list.length ? (page + 1) : page,
      limit: 30,
      total: 0,
      list: list
    });
  },
  detail(id) {
    const html = get(HOST + '/meijutt/' + id + '.html');
    return JSON.stringify({ list: [assembleDetail(id, html)] });
  },
  search(key) {
    // 搜索有验证码，不支持
    return JSON.stringify({ list: [] });
  },
  play(flag, id) {
    const player = buildPlayer(get(id));
    return player ? JSON.stringify(player) : '';
  }
};

// ===== FongMi / catvod 端：继承 Spider，方法返回对象 =====
let modern = null;
if (typeof Spider === 'function') {
  modern = class Meijutt extends Spider {
    async fetch(url) {
      var r = await this.net.req(url, options());
      var content = (r && r.content) ? r.content : '';
      if (isBlocked(content)) {
        r = await this.net.req(url, options());
        content = (r && r.content) ? r.content : '';
      }
      return content;
    }
    homeContent(filter) {
      return { class: CLASSES, filters: {} };
    }
    async homeVideoContent() {
      return { list: parseList(await this.fetch(HOST + '/mjtt/1.html')) };
    }
    async categoryContent(tid, pg, filter, extend) {
      const page = Number(pg) || 1;
      const url = page <= 1
        ? (HOST + '/mjtt/' + tid + '.html')
        : (HOST + '/mjtt/' + tid + '-' + page + '.html');
      const list = parseList(await this.fetch(url));
      return {
        page: page,
        pagecount: list.length ? (page + 1) : page,
        limit: 30,
        total: 0,
        list: list
      };
    }
    async detailContent(ids) {
      const id = Array.isArray(ids) ? ids[0] : ids;
      const html = await this.fetch(HOST + '/meijutt/' + id + '.html');
      return { list: [assembleDetail(id, html)] };
    }
    async searchContent(key, quick, pg) {
      return { list: [] };
    }
    async playerContent(flag, id, vipFlags) {
      const player = buildPlayer(await this.fetch(id));
      return player || {};
    }
  };
}

export default modern || legacy;
