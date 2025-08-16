const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

// حتى يشتغل موقعك من مجلد "public"
app.use(express.static("public"));

// مسار افتراضي
app.get("/", (req, res) => {
  res.send("🚀 السيرفر شغال تمام على Render!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
