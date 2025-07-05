const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const docRoutes = require("./routes/docRoutes");
const app = express();
const PORT = process.env.PORT || 5000;
// server.js or app.js
const signatureRoutes = require("./routes/signature");

const allowedOrigins = [
  'https://relaxed-eclair-42da2d.netlify.app'
];
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

app.use(
  "/uploads",
  (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "https://relaxed-eclair-42da2d.netlify.app"); // <-- match your frontend port, no trailing slash
    res.header("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
  },
  express.static(path.join(__dirname, "uploads"))
);

app.use("/signed", express.static(path.join(__dirname, "signed")));
app.use("/api/share", require(`./routes/share`));

app.use(express.static(path.join(__dirname, "public")));

//Routes
app.use("/api/auth", authRoutes);
app.get("/", (req, res) => {
  res.send("Api is running");
});
app.use("/api/docs", docRoutes);
app.use("/api/signature", signatureRoutes);


  mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error", err))

// Test route
app.get("/", (req, res) => res.send("API Running"));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
