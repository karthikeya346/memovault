const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const noteRoutes = require("./routes/notes");

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.log(err));
app.use("/notes", noteRoutes);
app.get("/", (req, res) => {
    res.send("Notes API Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});