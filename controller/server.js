const express = require("express");
const gameRoutes = require("./gameRoutes");


const app = express();
const cors = require("cors");


app.use(cors());



app.use(express.json());

app.use("/api/game", gameRoutes);

app.listen(3000, () => {
    console.log("API server 3000 portunda çalışıyor.");
});