const express = require("express");
const app = express();
const port = 3000;
const morgan = require("morgan");
app.use(morgan("combined"));

const path = require("path");
app.use(express.static(path.join(__dirname, "public")));

const cors = require("cors");
app.use(cors());
const bodyParser = require("body-parser");
app.use(bodyParser.json());

//create default API
app.get("/", (req, res) => {
  res.send("Hello Restful API");
});
app.listen(port, () => {
  console.log(`My Server listening on port ${port}`);
});
