/* Penghubung database: meniru API yang dipakai aplikasi (collection / doc / set / update / delete / onSnapshot)
   dan menyimpannya di tabel public.docs di Supabase.
   Belum diuji terhadap proyek asli. Pemakaian:
     const sb = supabase.createClient(URL, ANON_KEY);
     const db = createDb(sb);
*/
(function (global) {
  var POLL_MS = 3000;

  // "coll/sub/id" -> { coll: "coll/sub", id: "id" }
  function split(path) {
    var seg = String(path).split('/').filter(Boolean);
    return { coll: seg.slice(0, -1).join('/'), id: seg[seg.length - 1] || '' };
  }

  function snap(id, data) {
    return { id: id, exists: data !== null && data !== undefined, data: function () { return data ? JSON.parse(JSON.stringify(data)) : undefined; } };
  }

  function createDb(sb) {
    function assertOk(res) { if (res.error) { var e = new Error(res.error.message); e.code = res.error.code || 'unknown'; throw e; } return res.data; }

    // ---------- dokumen tunggal ----------
    function Doc(path) { this.path = path; var p = split(path); this.coll = p.coll; this.id = p.id; }
    Doc.prototype.get = async function () {
      var rows = assertOk(await sb.from('docs').select('data,version').eq('collection', this.coll).eq('id', this.id).limit(1));
      return rows && rows.length ? snap(this.id, rows[0].data) : snap(this.id, null);
    };
    Doc.prototype.set = async function (data) {
      var user = (await sb.auth.getUser()).data.user;
      var ex = assertOk(await sb.from('docs').select('created_by').eq('collection', this.coll).eq('id', this.id).limit(1));
      var owner = ex && ex.length ? ex[0].created_by : (user ? user.id : null);
      assertOk(await sb.from('docs').upsert({ collection: this.coll, id: this.id, data: data, updated_at: new Date().toISOString(), created_by: owner }, { onConflict: 'collection,id' }));
    };
    Doc.prototype.update = async function (patch) {
      var cur = (await this.get()).data() || {};
      Object.keys(patch).forEach(function (k) { if (patch[k] && patch[k].__delete__) delete cur[k]; else cur[k] = patch[k]; });
      await this.set(cur);
    };
    Doc.prototype.delete = async function () {
      assertOk(await sb.from('docs').delete().eq('collection', this.coll).eq('id', this.id));
    };
    Doc.prototype.onSnapshot = function (cb, err) { return watch(this.coll, this.id, cb, err); };

    // ---------- koleksi ----------
    function Col(path) { this.path = path; this._order = null; this._limit = null; this._where = []; }
    Col.prototype.doc = function (id) { return new Doc(this.path + '/' + id); };
    Col.prototype.orderBy = function (field, dir) { var c = clone(this); c._order = { f: field, desc: dir === 'desc' }; return c; };
    Col.prototype.limit = function (n) { var c = clone(this); c._limit = n; return c; };
    Col.prototype.where = function (f, op, v) { var c = clone(this); c._where.push([f, op, v]); return c; };
    Col.prototype.get = async function () { return runQuery(this); };
    Col.prototype.onSnapshot = function (cb, err) { return watchCol(this, cb, err); };

    function clone(c) { var n = new Col(c.path); n._order = c._order; n._limit = c._limit; n._where = c._where.slice(); return n; }

    async function runQuery(q) {
      var rows = assertOk(await sb.from('docs').select('id,data').eq('collection', q.path));
      var list = rows.map(function (r) { return { id: r.id, data: r.data }; });
      q._where.forEach(function (w) {
        list = list.filter(function (r) {
          var v = r.data[w[0]];
          if (w[1] === '==') return v === w[2];
          if (w[1] === '!=') return v !== w[2];
          if (w[1] === '<') return v < w[2];
          if (w[1] === '<=') return v <= w[2];
          if (w[1] === '>') return v > w[2];
          if (w[1] === '>=') return v >= w[2];
          return true;
        });
      });
      if (q._order) {
        var f = q._order.f, s = q._order.desc ? -1 : 1;
        list.sort(function (a, b) { var x = a.data[f], y = b.data[f]; return x > y ? s : x < y ? -s : 0; });
      }
      if (q._limit) list = list.slice(0, q._limit);
      var docs = list.map(function (r) { return { id: r.id, exists: true, data: function () { return JSON.parse(JSON.stringify(r.data)); } }; });
      return { docs: docs, empty: docs.length === 0, size: docs.length, forEach: function (fn) { docs.forEach(fn); } };
    }

    // ---------- langganan (polling sederhana) ----------
    function watch(coll, id, cb, err) {
      var last = null, stop = false;
      async function tick() {
        if (stop) return;
        try {
          var rows = assertOk(await sb.from('docs').select('data').eq('collection', coll).eq('id', id).limit(1));
          var data = rows && rows.length ? rows[0].data : null, key = JSON.stringify(data);
          if (key !== last) { last = key; cb(snap(id, data)); }
        } catch (e) { if (err) err(e); }
        if (!stop) setTimeout(tick, POLL_MS);
      }
      tick();
      return function () { stop = true; };
    }
    function watchCol(q, cb, err) {
      var last = null, stop = false;
      async function tick() {
        if (stop) return;
        try {
          var s = await runQuery(q), key = JSON.stringify(s.docs.map(function (d) { return [d.id, d.data()]; }));
          if (key !== last) { last = key; cb(s); }
        } catch (e) { if (err) err(e); }
        if (!stop) setTimeout(tick, POLL_MS);
      }
      tick();
      return function () { stop = true; };
    }

    // ---------- titik masuk ----------
    return {
      collection: function (path) { return new Col(path); },
      doc: function (path) { return new Doc(path); },
      _sb: sb
    };
  }

  global.createDb = createDb;
})(typeof window !== 'undefined' ? window : globalThis);
