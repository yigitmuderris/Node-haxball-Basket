const express = require("express");
const gameController = require("./gameController");

const router = express.Router();

router.get("/state", gameController.getState);

module.exports = router;