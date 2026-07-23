// ============================================================
//  Nova Store REST API
//  Node + Express + JSON-file storage + JWT auth
//  Run:  npm install && npm start
//  Base: http://localhost:4000/api
// ============================================================
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const PORT = process.env.PORT || 4000;

// ---------- seed admin + products on first run ----------
(function seed() {
  if (db.all("users").length === 0) {
    const now = new Date().toISOString();
    db.insert("users", { name: "Admin", email: "admin@nova.com", password: bcrypt.hashSync("admin123", 10), role: "admin", createdAt: now });
    const items = [
      ["Wireless Noise-Cancelling Headphones", 89.99, 119.99, "Electronics", 24, "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500", "Premium over-ear wireless headphones.", true, 4.6, 212],
      ["Smart Watch Series 7", 199.0, null, "Electronics", 15, "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500", "Track fitness, calls and notifications.", true, 4.8, 540],
      ["Handcrafted Leather Backpack", 64.5, null, "Accessories", 40, "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500", "Full-grain leather backpack.", false, 4.4, 98],
    ];
    for (const [name, price, oldPrice, category, stock, image, description, featured, rating, reviews] of items)
      db.insert("products", { name, price, oldPrice, category, stock, image, description, featured, rating, reviews, createdAt: now });
    console.log("Seeded admin (admin@nova.com / admin123) and 3 products.");
  }
})();

const app = express();
app.use(cors());
app.use(express.json());

// ---------- helpers ----------
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt });
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "");
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

const auth = (req, res, next) => {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return bad(res, "Missing token", 401);
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return bad(res, "Invalid or expired token", 401); }
};
const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") return bad(res, "Admin access required", 403);
  next();
};
const tokenFor = (u) => jwt.sign({ id: u.id, role: u.role, email: u.email }, JWT_SECRET, { expiresIn: "7d" });

// ============================================================
//  AUTH
// ============================================================
app.post("/api/auth/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim()) return bad(res, "Name is required");
  if (!isEmail(email)) return bad(res, "Valid email is required");
  if (!password || password.length < 6) return bad(res, "Password must be at least 6 characters");
  if (db.find("users", u => u.email.toLowerCase() === email.toLowerCase())) return bad(res, "An account with this email already exists", 409);
  const user = db.insert("users", { name, email, password: bcrypt.hashSync(password, 10), role: "user", createdAt: new Date().toISOString() });
  res.status(201).json({ user: publicUser(user), token: tokenFor(user) });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const u = db.find("users", x => x.email.toLowerCase() === (email || "").toLowerCase());
  if (!u || !bcrypt.compareSync(password || "", u.password)) return bad(res, "Invalid email or password", 401);
  res.json({ user: publicUser(u), token: tokenFor(u) });
});

app.get("/api/auth/me", auth, (req, res) => {
  const u = db.find("users", x => x.id === req.user.id);
  if (!u) return bad(res, "User not found", 404);
  res.json({ user: publicUser(u) });
});

// ============================================================
//  PRODUCTS
// ============================================================
app.get("/api/products", (req, res) => {
  let list = [...db.all("products")].sort((a, b) => b.id - a.id);
  const { category, search, featured, sort } = req.query;
  if (category && category !== "All") list = list.filter(p => p.category === category);
  if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  if (featured === "true") list = list.filter(p => p.featured);
  if (sort === "price_asc") list.sort((a, b) => a.price - b.price);
  if (sort === "price_desc") list.sort((a, b) => b.price - a.price);
  if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
  res.json({ products: list, count: list.length });
});

app.get("/api/products/:id", (req, res) => {
  const p = db.find("products", x => x.id === Number(req.params.id));
  if (!p) return bad(res, "Product not found", 404);
  res.json({ product: p });
});

app.post("/api/products", auth, adminOnly, (req, res) => {
  const { name, price, oldPrice, category, stock, image, description, featured } = req.body;
  if (!name?.trim()) return bad(res, "Product name is required");
  if (price == null || isNaN(Number(price)) || Number(price) <= 0) return bad(res, "Valid price is required");
  if (stock != null && (isNaN(Number(stock)) || Number(stock) < 0)) return bad(res, "Stock must be 0 or greater");
  const p = db.insert("products", {
    name, price: Number(price), oldPrice: oldPrice ? Number(oldPrice) : null,
    category: category || null, stock: stock != null ? Number(stock) : 0,
    image: image || null, description: description || null, featured: !!featured,
    rating: 4.0, reviews: 0, createdAt: new Date().toISOString(),
  });
  res.status(201).json({ product: p });
});

app.put("/api/products/:id", auth, adminOnly, (req, res) => {
  const p = db.find("products", x => x.id === Number(req.params.id));
  if (!p) return bad(res, "Product not found", 404);
  const b = req.body;
  if (b.price != null && (isNaN(Number(b.price)) || Number(b.price) <= 0)) return bad(res, "Valid price required");
  const patch = {};
  if (b.name != null) patch.name = b.name;
  if (b.price != null) patch.price = Number(b.price);
  if (b.oldPrice !== undefined) patch.oldPrice = b.oldPrice ? Number(b.oldPrice) : null;
  if (b.category != null) patch.category = b.category;
  if (b.stock != null) patch.stock = Number(b.stock);
  if (b.image != null) patch.image = b.image;
  if (b.description != null) patch.description = b.description;
  if (b.featured != null) patch.featured = !!b.featured;
  res.json({ product: db.update("products", p.id, patch) });
});

app.delete("/api/products/:id", auth, adminOnly, (req, res) => {
  const n = db.remove("products", p => p.id === Number(req.params.id));
  if (!n) return bad(res, "Product not found", 404);
  res.json({ deleted: true, id: Number(req.params.id) });
});

// ============================================================
//  CUSTOMERS / USERS
// ============================================================
app.post("/api/customers", auth, adminOnly, (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name?.trim()) return bad(res, "Name is required");
  if (!isEmail(email)) return bad(res, "Valid email is required");
  if (!password || password.length < 6) return bad(res, "Password must be at least 6 characters");
  if (db.find("users", u => u.email.toLowerCase() === email.toLowerCase())) return bad(res, "Email already exists", 409);
  const u = db.insert("users", { name, email, password: bcrypt.hashSync(password, 10), role: role === "admin" ? "admin" : "user", createdAt: new Date().toISOString() });
  res.status(201).json({ customer: publicUser(u) });
});

app.get("/api/customers", auth, adminOnly, (req, res) => {
  const customers = db.filter("users", u => u.role === "user").sort((a, b) => b.id - a.id).map(u => {
    const orders = db.filter("orders", o => o.userId === u.id);
    return { ...publicUser(u), orders: orders.length, totalSpent: orders.reduce((s, o) => s + o.total, 0) };
  });
  res.json({ customers, count: customers.length });
});

app.get("/api/customers/:id", auth, adminOnly, (req, res) => {
  const u = db.find("users", x => x.id === Number(req.params.id));
  if (!u) return bad(res, "Customer not found", 404);
  const orders = db.filter("orders", o => o.userId === u.id).sort((a, b) => b.id - a.id);
  res.json({ customer: publicUser(u), orders });
});

app.delete("/api/customers/:id", auth, adminOnly, (req, res) => {
  const n = db.remove("users", u => u.id === Number(req.params.id) && u.role === "user");
  if (!n) return bad(res, "Customer not found", 404);
  res.json({ deleted: true, id: Number(req.params.id) });
});

// ============================================================
//  ORDERS
// ============================================================
app.post("/api/orders", (req, res) => {
  const { customer, items, coupon, payment, cardLast4, userId } = req.body;
  if (!customer?.name || !isEmail(customer?.email) || !customer?.address || !customer?.city)
    return bad(res, "customer name, valid email, address and city are required");
  if (!Array.isArray(items) || items.length === 0) return bad(res, "Order must contain at least one item");

  let subtotal = 0;
  const lineItems = [];
  for (const it of items) {
    const p = db.find("products", x => x.id === Number(it.id));
    if (!p) return bad(res, `Product ${it.id} not found`);
    const qty = Math.max(1, parseInt(it.qty) || 1);
    if (p.stock < qty) return bad(res, `Insufficient stock for ${p.name}`);
    subtotal += p.price * qty;
    lineItems.push({ id: p.id, name: p.name, price: p.price, qty });
  }
  const COUPONS = { SAVE10: { type: "pct", val: 10 }, WELCOME5: { type: "flat", val: 5 } };
  const c = coupon ? COUPONS[String(coupon).toUpperCase()] : null;
  const discount = c ? (c.type === "pct" ? subtotal * c.val / 100 : c.val) : 0;
  const shipping = subtotal > 75 ? 0 : 6.99;
  const tax = (subtotal - discount) * 0.08;
  const total = Math.max(0, subtotal - discount + shipping + tax);

  const order = db.insert("orders", {
    userId: userId || null, customer, items: lineItems,
    subtotal, discount, shipping, tax, total, status: "Pending",
    payment: payment || null, cardLast4: cardLast4 || null, createdAt: new Date().toISOString(),
  });
  for (const li of lineItems) {
    const p = db.find("products", x => x.id === li.id);
    db.update("products", p.id, { stock: Math.max(0, p.stock - li.qty) });
  }
  res.status(201).json({ order });
});

app.get("/api/orders", auth, adminOnly, (req, res) => {
  let list = [...db.all("orders")].sort((a, b) => b.id - a.id);
  if (req.query.status && req.query.status !== "All") list = list.filter(o => o.status === req.query.status);
  res.json({ orders: list, count: list.length });
});

app.get("/api/orders/mine", auth, (req, res) => {
  const list = db.filter("orders", o => o.userId === req.user.id).sort((a, b) => b.id - a.id);
  res.json({ orders: list });
});

app.patch("/api/orders/:id/status", auth, adminOnly, (req, res) => {
  const allowed = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
  if (!allowed.includes(req.body.status)) return bad(res, "Invalid status");
  const o = db.update("orders", Number(req.params.id), { status: req.body.status });
  if (!o) return bad(res, "Order not found", 404);
  res.json({ order: o });
});

app.delete("/api/orders/:id", auth, adminOnly, (req, res) => {
  const n = db.remove("orders", o => o.id === Number(req.params.id));
  if (!n) return bad(res, "Order not found", 404);
  res.json({ deleted: true, id: Number(req.params.id) });
});

// ============================================================
//  STATS
// ============================================================
app.get("/api/stats", auth, adminOnly, (req, res) => {
  const orders = db.all("orders");
  const valid = orders.filter(o => o.status !== "Cancelled");
  const revenue = valid.reduce((s, o) => s + o.total, 0);
  const sold = {};
  valid.forEach(o => o.items.forEach(i => { sold[i.name] = (sold[i.name] || 0) + i.qty; }));
  const bestSellers = Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));
  res.json({
    revenue,
    orders: orders.length,
    customers: db.filter("users", u => u.role === "user").length,
    products: db.all("products").length,
    avgOrder: valid.length ? revenue / valid.length : 0,
    bestSellers,
  });
});

app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.listen(PORT, () => console.log(`Nova Store API running at http://localhost:${PORT}/api`));
