
const EventEmitter = require("events");

class GameStateService extends EventEmitter {

    constructor() {
        super();

        this.reset();
    }

    reset() {
        this.state = {
            room: {
                name: null,
                playerCount: 0,
                maxPlayers: 9
            },

            game: {
                status: "waiting",
                mode: "training",
                startedAt: null,
                elapsedMs: 0,
                durationMs: 120000,
                drawEnd: false
            },

            score: {
                red: 0,
                blue: 0
            },

            players: [],

            ball: {
                x: 0,
                y: 0
            },

            lastTouch: null,

            lastScore: null,

            queue: [],

            match: {
                active: false,
                points: {}
            }
        };
    }


    /* =========================================================
       ROOM
    ========================================================= */

    setRoomInfo({ name, playerCount, maxPlayers }) {

        this.state.room = {
            name,
            playerCount,
            maxPlayers
        };

        this.publish();
    }


    /* =========================================================
       GAME
    ========================================================= */

    startGame({ mode = "training", durationMs = 120000 } = {}) {

        this.state.game = {
            ...this.state.game,

            status: "running",
            mode,
            startedAt: Date.now(),
            elapsedMs: 0,
            durationMs,
            drawEnd: false
        };

        this.state.score = {
            red: 0,
            blue: 0
        };

        this.state.lastScore = null;

        this.publish("GAME_START");
    }


    stopGame() {

        this.state.game.status = "stopped";

        this.updateElapsed();

        this.publish("GAME_STOP");
    }


    updateElapsed() {

        if (
            this.state.game.status !== "running" ||
            !this.state.game.startedAt
        ) {
            return;
        }

        this.state.game.elapsedMs =
            Date.now() - this.state.game.startedAt;
    }


    setDrawEnd(value) {

        this.state.game.drawEnd = Boolean(value);

        this.publish();
    }


    /* =========================================================
       SCORE
    ========================================================= */

    setScore(red, blue) {

        this.state.score = {
            red,
            blue
        };

        this.publish("SCORE_UPDATE");
    }


    setLastScore(score) {

        this.state.lastScore = {
            ...score,
            at: Date.now()
        };

        this.publish("GOAL");
    }


    /* =========================================================
       PLAYERS
    ========================================================= */

    updatePlayers(players) {

        this.state.players = players.map(player => ({
            id: player.id,
            name: player.name,
            teamId: player.teamId,
            x: player.x,
            y: player.y
        }));

        this.state.room.playerCount = players.length;

        this.publish("PLAYERS_UPDATE");
    }


    setQueue(queue) {

        this.state.queue = [...queue];

        this.publish();
    }


    /* =========================================================
       BALL
    ========================================================= */

    updateBall(x, y) {

        this.state.ball = {
            x,
            y
        };
    }


    /* =========================================================
       TOUCH
    ========================================================= */

    setLastTouch(touch) {

        this.state.lastTouch = touch
            ? { ...touch }
            : null;

        this.publish("TOUCH");
    }


    /* =========================================================
       MATCH
    ========================================================= */

    setMatchPoints(points) {

        this.state.match.points = { ...points };

        this.publish();
    }


    setMatchActive(active) {

        this.state.match.active = Boolean(active);

        this.publish();
    }


    /* =========================================================
       READ
    ========================================================= */

    getState() {

        this.updateElapsed();

        return structuredClone(this.state);
    }


    /* =========================================================
       EVENT
    ========================================================= */

    publish(type = "STATE_UPDATE") {

        this.emit("change", {
            type,
            state: this.getState()
        });
    }
}


module.exports = new GameStateService();

