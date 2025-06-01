
# 🎵 music-bot-sinsamuth

บอท Discord สำหรับเล่นเพลง (หรือใช้งานตามที่คุณออกแบบไว้)  
พัฒนาโดย [Khaoseekakun](https://github.com/Khaoseekakun)

---

## 📦 คุณสมบัติ

- เขียนด้วย TypeScript + Bun  
- ใช้ Prisma เป็น ORM  
- เชื่อมต่อกับ Discord ผ่าน [discord.js](https://discord.js.org)  
- จัดการ ENV ด้วย dotenv  

---

## ⚙️ การติดตั้ง

### 1️⃣ ติดตั้ง Bun

ถ้ายังไม่มี Bun ติดตั้งในเครื่อง ให้ทำตาม [คู่มือ Bun](https://bun.sh)  

```bash
curl -fsSL https://bun.sh/install | bash
````

---

### 2️⃣ โคลนโปรเจ็ก

```bash
git clone https://github.com/Khaoseekakun/music-bot-sinsamuth-2025.git
cd music-bot-sinsamuth-2025
```

---

### 3️⃣ ติดตั้ง dependencies

```bash
bun install
```

---

### 4️⃣ ตั้งค่าไฟล์ ENV

สร้างไฟล์ `.env` ใน root (ตัวอย่างตัวแปรที่อาจต้องมี: **TOKEN**, **DATABASE\_URL**)

```env
DISCORD_TOKEN=your_discord_bot_token
DATABASE_URL=your_database_connection_string
```

---

### 5️⃣ สร้าง Prisma Client

```bash
bun prisma generate
```

---

## 🚀 การรันโปรเจ็ก

### โหมดพัฒนา (dev)

```bash
bun run dev
```

### สร้างไฟล์ build (สำหรับ production)

```bash
bun run build
```

### รัน production (หลัง build)

```bash
bun run start
```

---

## 🛠️ คำสั่งสำคัญ (ใน package.json)

| คำสั่ง          | รายละเอียด                                  |
| --------------- | ------------------------------------------- |
| `bun run dev`   | รันโค้ดแบบ hot-reload (เหมาะสำหรับพัฒนา)    |
| `bun run build` | สร้างไฟล์ build (minify, output ใน `dist/`) |
| `bun run start` | รันไฟล์ที่ build แล้ว (production)          |

---

## 📜 License

โปรเจ็กนี้ให้ใช้ภายใต้เงื่อนไข:

* **ห้ามนำไปใช้เชิงพาณิชย์หรือขายต่อ**
* **หากดัดแปลงหรือนำไปใช้ ต้องให้เครดิต**
  ดูรายละเอียดเพิ่มเติมใน [LICENSE](./LICENSE)

---

## 🙌 เครดิต

* ผู้พัฒนา: [Khaoseekakun](https://github.com/Khaoseekakun)
* โปรเจ็กต้นฉบับ: [music-bot-sinsamuth-2025](https://github.com/Khaoseekakun/music-bot-sinsamuth-2025)

```