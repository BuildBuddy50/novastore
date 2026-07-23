// Tiny JSON-file database — zero native dependencies.
// Persists all data to db.json. Good for demos, small stores, and easy hosting.
import fs from "fs";

const FILE = process.env.DB_FILE || "db.json";

const empty = { users: [], products: [], orders: [], seq: { users: 0, products: 0, orders: 0 } };

let data;
function read() {
  try { data = JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { data = structuredClone(empty); }
  for (const k of Object.keys(empty)) if (data[k] == null) data[k] = structuredClone(empty[k]);
}
function write() { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); }
read();

export const db = {
  all(table) { return data[table]; },
  find(table, pred) { return data[table].find(pred); },
  filter(table, pred) { return data[table].filter(pred); },
  insert(table, obj) {
    const id = ++data.seq[table];
    const row = { id, ...obj };
    data[table].push(row);
    write();
    return row;
  },
  update(table, id, patch) {
    const row = data[table].find(r => r.id === Number(id));
    if (!row) return null;
    Object.assign(row, patch);
    write();
    return row;
  },
  remove(table, pred) {
    const before = data[table].length;
    data[table] = data[table].filter(r => !pred(r));
    const changed = before - data[table].length;
    if (changed) write();
    return changed;
  },
  save: write,
};
