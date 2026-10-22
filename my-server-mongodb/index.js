require("dotenv").config();
const express = require("express");
const app = express();
const port = 3002;

const morgan = require("morgan");
app.use(morgan("combined"));

const path = require("path");
const fs = require("fs");
app.use(express.static(path.join(__dirname, "public")));

const cors = require("cors");
app.use(cors());
const bodyParser = require("body-parser");
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

const { MongoClient, ObjectId } = require("mongodb");
const client = new MongoClient(process.env.MONGO_URI);
const db = client.db("ken_space_booking");

app.listen(port, () => {
  console.log(`My Server listening on port ${port}`);
});

app.get("/", (req, res) => {
  res.send("This Web server is processed for MongoDB");
});

app.get("/api/:collection", async (req, res) => {
  const data = await db.collection(req.params.collection).find().toArray();
  res.send(data);
});
