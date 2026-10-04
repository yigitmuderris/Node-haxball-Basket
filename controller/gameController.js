

const gameState = require("../services/GameStateService");


function getState(req, res) {
    res.json(gameState.getState());
}

module.exports = {
    getState
};