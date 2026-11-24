import * as catvod from "catvod";

const HOST = "https://gimytv.biz";
const API = HOST + "/api.php/provide/vod/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// 父分类“電影/電視劇/資訊/公告”没有数据或只有少量异常条目，直接不展示。
// 只保留站点真正有内容的子分类。
const CLASSES = [
  { type_id: 3, type_name: "綜藝" },
  { type_id: 4, type_name: "動漫" },
  { type_id: 6, type_name: "動作片" },
  { type_id: 7, type_name: "喜劇片" },
  { type_id: 8, type_name: "愛情片" },
  { type_id: 9, type_name: "科幻片" },
  { type_id: 10, type_name: "恐怖片" },
  { type_id: 11, type_name: "劇情片" },
  { type_id: 12, type_name: "戰爭片" },
  { type_id: 13, type_name: "陸劇" },
  { type_id: 14, type_name: "台劇" },
  { type_id: 15, type_name: "韓劇" },
  { type_id: 16, type_name: "美劇" },
  { type_id: 20, type_name: "日劇" },
  { type_id: 21, type_name: "海外劇" },
  { type_id: 22, type_name: "港劇" },
  { type_id: 23, type_name: "紀錄片" },
  { type_id: 24, type_name: "動畫電影" },
  { type_id: 54, type_name: "短劇" }
];

function clean(s) {
  return String(s == null ? "" : s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function absPic(p) {
  p = String(p == null ? "" : p).trim();
  if (!p) return "";
  if (p.indexOf("//") === 0) return "https:" + p;
  if (/^https?:\/\//i.test(p)) return p;
  return HOST + "/" + p.replace(/^\/+/, "");
}

function mapItem(v) {
  return {
    vod_id: String(v.vod_id),
    vod_name: clean(v.vod_name),
    vod_pic: absPic(v.vod_pic),
    vod_remarks: clean(v.vod_remarks),
    vod_content: clean(v.vod_blurb || v.vod_content || "")
  };
}

class Gimy extends catvod.Spider {
  constructor() {
    super();
  }

  init() {}

  async request(query) {
    try {
      const r = await this.net.req(API + query, {
        headers: {
          "User-Agent": UA,
          "Referer": HOST + "/"
        },
        timeout: 20000
      });
      const body = r && r.content ? r.content : "";
      return JSON.parse(body);
    } catch (e) {
      return null;
    }
  }

  async homeContent() {
    return { class: CLASSES, filters: {} };
  }

  async homeVideoContent() {
    const j = await this.request("?ac=detail&pg=1");
    return { list: j && j.list ? j.list.map(mapItem) : [] };
  }

  async categoryContent(tid, pg) {
    const page = Math.max(1, Number(pg) || 1);
    const j = await this.request("?ac=detail&t=" + encodeURIComponent(tid) + "&pg=" + page);
    return {
      page: page,
      pagecount: j && j.pagecount ? j.pagecount : 1,
      limit: 20,
      total: j && j.total ? j.total : 0,
      list: j && j.list ? j.list.map(mapItem) : []
    };
  }

  async detailContent(ids) {
    const id = Array.isArray(ids) ? ids[0] : ids;
    const j = await this.request("?ac=detail&ids=" + encodeURIComponent(id));
    if (!j || !j.list || !j.list.length) return { list: [] };
    const v = j.list[0];
    return {
      list: [{
        vod_id: String(v.vod_id),
        vod_name: clean(v.vod_name),
        vod_pic: absPic(v.vod_pic),
        vod_remarks: clean(v.vod_remarks),
        vod_content: clean(v.vod_blurb || v.vod_content || ""),
        vod_year: clean(v.vod_year),
        vod_area: clean(v.vod_area),
        vod_actor: clean(v.vod_actor),
        vod_director: clean(v.vod_director),
        vod_play_from: v.vod_play_from,
        vod_play_url: v.vod_play_url
      }]
    };
  }

  async searchContent(wd) {
    const j = await this.request("?ac=detail&wd=" + encodeURIComponent(wd || ""));
    return { list: j && j.list ? j.list.map(mapItem) : [] };
  }

  async playerContent(flag, id) {
    if (!id) return {};
    return {
      parse: 0,
      url: id,
      header: {
        "User-Agent": UA,
        "Referer": HOST + "/"
      }
    };
  }
}

export default Gimy;
