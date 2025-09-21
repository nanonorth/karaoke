// scripts/seed.js
// รัน: npm run seed
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const uri =
  "mongodb+srv://achiz:A124563a@karaoke.xhh0ave.mongodb.net/?retryWrites=true&w=majority&appName=Karaoke";
if (!uri) {
  console.error("❌ Missing MONGODB_URI in env");
  process.exit(1);
}
async function connect() {
  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });
}

/* ========================
 * 2) Schemas (mirror your app)
 * ====================== */

// ---- User (สั้น ๆ ใช้สำหรับล็อกอินทดสอบ) ----
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true },
);

// ---- Room (ตามที่แก้ schema ไป) ----
const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      set: (v) => (v ? String(v).toUpperCase() : v),
    },
    type: {
      type: String,
      required: true,
      trim: true,
      enum: ["STANDARD", "PREMIUM", "DELUXE", "VIP"],
      index: true,
    },
    capacity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["AVAILABLE", "OCCUPIED", "MAINTENANCE"],
      default: "AVAILABLE",
      index: true,
    },
  },
  { timestamps: true },
);
roomSchema.index({ type: 1, status: 1 });
roomSchema.index({ price: 1 });

// ---- Promotion (ถ้าจะใช้ในหน้า Promotions) ----
const promotionSchema = new mongoose.Schema(
  {
    code: { type: String, unique: true },
    name: String,
    discountType: { type: String, enum: ["PERCENT", "FIXED"] },
    discountValue: Number,
    startDate: Date,
    endDate: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ---- Booking (embed room object + monthKey) ----
const roomSubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    number: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ["STANDARD", "PREMIUM", "DELUXE", "VIP"],
    },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true, trim: true },
    room: { type: roomSubSchema, required: true },
    customerName: { type: String, required: true, trim: true },
    customerEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email"],
    },
    customerPhone: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    timeSlot: {
      type: String,
      required: true,
      trim: true,
      match: [
        /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/,
        "Invalid timeSlot (HH:MM-HH:MM)",
      ],
    },
    numberOfPeople: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      required: true,
      enum: [
        "PENDING",
        "CONFIRMED",
        "PAID",
        "COMPLETED",
        "CANCELLED",
        "REFUNDED",
      ],
      default: "PENDING",
      index: true,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["CASH", "PROMPTPAY", "STRIPE"],
    },
    totalAmount: { type: Number, required: true, min: 0 },
    monthKey: { type: String, index: true }, // "YYYY-MM"
  },
  { timestamps: true },
);
bookingSchema.index({ customerEmail: 1 });
bookingSchema.index({ status: 1, date: -1 });
bookingSchema.pre("save", function (next) {
  if (this.date) {
    const y = this.date.getFullYear();
    const m = String(this.date.getMonth() + 1).padStart(2, "0");
    this.monthKey = `${y}-${m}`;
  }
  next();
});

/* ========================
 * 3) Models
 * ====================== */
const User = mongoose.models.User || mongoose.model("User", userSchema);
const Room = mongoose.models.Room || mongoose.model("Room", roomSchema);
const Promotion =
  mongoose.models.Promotion || mongoose.model("Promotion", promotionSchema);
const Booking =
  mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

/* ========================
 * 4) Seed data
 * ====================== */
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const timeSlots = [
  "12:00-14:00",
  "14:00-16:00",
  "16:00-18:00",
  "18:00-20:00",
  "20:00-22:00",
];
const statuses = ["PENDING", "CONFIRMED", "PAID", "COMPLETED"];
const payments = ["CASH", "PROMPTPAY", "STRIPE"];
const pad = (n, len = 4) => String(n).padStart(len, "0");
const year = new Date().getFullYear();
const genBookingId = (i) => `BK${year}${pad(i)}`;
const addMonths = (date, m) =>
  new Date(date.getFullYear(), date.getMonth() + m, date.getDate());

async function main() {
  await connect();
  console.log("🗄️  Connected to MongoDB");

  // เคลียร์ก่อน (คอมเมนต์ทิ้งถ้าไม่อยากล้าง)
  await Promise.all([
    User.deleteMany({}),
    Room.deleteMany({}),
    Promotion.deleteMany({}),
    Booking.deleteMany({}),
  ]);

  // Users
  const hash = await bcrypt.hash("password123", 10);
  const users = await User.insertMany([
    {
      name: "Admin",
      email: "admin@example.com",
      password: hash,
      role: "admin",
    },
    {
      name: "John Doe",
      email: "john@example.com",
      password: hash,
      role: "user",
    },
    {
      name: "Jane Smith",
      email: "jane@example.com",
      password: hash,
      role: "user",
    },
  ]);
  console.log(`👤 Users: ${users.length} (admin@example.com / password123)`);

  // Rooms
  const rooms = await Room.insertMany([
    {
      name: "VIP Room Gold",
      number: "V201",
      type: "VIP",
      capacity: 12,
      price: 2500,
      status: "AVAILABLE",
    },
    {
      name: "Premium Suite A",
      number: "A101",
      type: "PREMIUM",
      capacity: 8,
      price: 1600,
      status: "AVAILABLE",
    },
    {
      name: "Premium Suite B",
      number: "A102",
      type: "PREMIUM",
      capacity: 8,
      price: 1700,
      status: "AVAILABLE",
    },
    {
      name: "Deluxe Suite",
      number: "D301",
      type: "DELUXE",
      capacity: 10,
      price: 1800,
      status: "AVAILABLE",
    },
    {
      name: "Standard Room 1",
      number: "S101",
      type: "STANDARD",
      capacity: 6,
      price: 800,
      status: "AVAILABLE",
    },
    {
      name: "Standard Room 2",
      number: "S102",
      type: "STANDARD",
      capacity: 6,
      price: 800,
      status: "MAINTENANCE",
    },
  ]);
  console.log(`🚪 Rooms: ${rooms.length}`);

  // Promotions (ตัวอย่าง)
  const now = new Date();
  const promotions = await Promotion.insertMany([
    {
      code: "NEWUSER10",
      name: "New User 10%",
      discountType: "PERCENT",
      discountValue: 10,
      startDate: addMonths(now, -2),
      endDate: addMonths(now, 2),
      isActive: true,
    },
    {
      code: "WEEKEND100",
      name: "Weekend ฿100 Off",
      discountType: "FIXED",
      discountValue: 100,
      startDate: addMonths(now, -1),
      endDate: addMonths(now, 1),
      isActive: true,
    },
    {
      code: "VIP500",
      name: "VIP ฿500 Off",
      discountType: "FIXED",
      discountValue: 500,
      startDate: addMonths(now, -3),
      endDate: addMonths(now, 3),
      isActive: true,
    },
  ]);
  console.log(`🎁 Promotions: ${promotions.length}`);

  // Bookings (30 รายการ กระจายย้อนหลัง ~150 วัน)
  const customers = [
    { name: "John Doe", email: "john@example.com", phone: "0812345678" },
    { name: "Jane Smith", email: "jane@example.com", phone: "0887654321" },
    { name: "Somchai K.", email: "somchai@example.com", phone: "0891112222" },
    { name: "Aya T.", email: "aya@example.com", phone: "0822223333" },
    { name: "Min Park", email: "min@example.com", phone: "0865554444" },
  ];

  const bookingsData = [];
  for (let i = 1; i <= 30; i++) {
    const r = rand(rooms);
    const c = rand(customers);
    const daysBack = Math.floor(Math.random() * 150); // 0–150 วัน
    const date = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    bookingsData.push({
      bookingId: genBookingId(i),
      room: { name: r.name, number: r.number, type: r.type, price: r.price }, // ✅ embed ตาม schema
      customerName: c.name,
      customerEmail: c.email,
      customerPhone: c.phone,
      date,
      timeSlot: rand(timeSlots),
      numberOfPeople: Math.min(
        r.capacity,
        2 + Math.floor(Math.random() * r.capacity),
      ),
      status: rand(statuses),
      paymentMethod: rand(payments),
      totalAmount: r.prise,
    });
  }

  const bookings = await Booking.insertMany(bookingsData);
  console.log(`📅 Bookings: ${bookings.length}`);

  console.log("✅ Seed done.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
