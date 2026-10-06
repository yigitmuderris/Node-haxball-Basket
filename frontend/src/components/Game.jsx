
import { useEffect, useState } from "react";
import "./Game.css";

function Game() {
    const [gameState, setGameState] = useState(null);

    useEffect(() => {
        const fetchGameState = () => {
            fetch("http://localhost:3000/api/game/state")
                .then(response => response.json())
                .then(data => {
                    setGameState(data);
                })
                .catch(error => {
                    console.error("Game state alınamadı:", error);
                });
        };

        // Sayfa açılır açılmaz al
        fetchGameState();

        // Her 500ms'de bir güncelle
        const interval = setInterval(fetchGameState, 500);

        // Component kapanınca interval'i temizle
        return () => {
            clearInterval(interval);
        };
    }, []);






    if (!gameState) {
        return (
            <div className="loading-screen">
                <div className="loading">Loading...</div>
            </div>
        );
    }

    const redPlayers = gameState.players.filter(
        player => player.teamId === 1
    );

    const bluePlayers = gameState.players.filter(
        player => player.teamId === 2
    );

    return (
        <div className="dashboard">

            {/* HEADER */}
            <header className="header">
                <div>
                    <h1>🏀 BASKET 3V3</h1>
                    <span className="room-name">
                        {gameState.room.name}
                    </span>
                </div>

                <div className="status">
                    <span className="status-dot"></span>
                    LIVE
                </div>
            </header>

            {/* SCOREBOARD */}
            <section className="score-card">

                <div className="section-title">
                    CURRENT GAME
                </div>

                <div className="scoreboard">

                    <div className="team-score red">
                        <span className="team-name">RED</span>
                        <strong>{gameState.score.red}</strong>
                    </div>

                    <div className="game-middle">
                        <span className="game-status">
                            {gameState.game.status.toUpperCase()}
                        </span>

                        <span className="vs">VS</span>

                        <span className="game-mode">
                            {gameState.game.mode}
                        </span>
                    </div>

                    <div className="team-score blue">
                        <span className="team-name">BLUE</span>
                        <strong>{gameState.score.blue}</strong>
                    </div>

                </div>

            </section>

            {/* INFO */}
            <section className="info-grid">

                <div className="info-card">
                    <span>PLAYERS</span>
                    <strong>
                        {gameState.room.playerCount}
                        <small> / {gameState.room.maxPlayers}</small>
                    </strong>
                </div>

                <div className="info-card">
                    <span>GAME MODE</span>
                    <strong>
                        {gameState.game.mode}
                    </strong>
                </div>

                <div className="info-card">
                    <span>STATUS</span>
                    <strong>
                        {gameState.game.status}
                    </strong>
                </div>

            </section>

            {/* TEAMS */}
            <section className="teams">

                {/* RED TEAM */}
                <div className="team-card red-card">

                    <div className="team-header">
                        <span className="team-indicator red-indicator"></span>
                        <h2>RED TEAM</h2>
                    </div>

                    <div className="player-list">
                        {redPlayers.length === 0 ? (
                            <span className="empty">
                                No players
                            </span>
                        ) : (
                            redPlayers.map(player => (
                                <div
                                    className="player"
                                    key={player.id}
                                >
                                    <span className="player-number">
                                        #{player.id}
                                    </span>

                                    <span>
                                        {player.name}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>

                </div>

                {/* BLUE TEAM */}
                <div className="team-card blue-card">

                    <div className="team-header">
                        <span className="team-indicator blue-indicator"></span>
                        <h2>BLUE TEAM</h2>
                    </div>

                    <div className="player-list">
                        {bluePlayers.length === 0 ? (
                            <span className="empty">
                                No players
                            </span>
                        ) : (
                            bluePlayers.map(player => (
                                <div
                                    className="player"
                                    key={player.id}
                                >
                                    <span className="player-number">
                                        #{player.id}
                                    </span>

                                    <span>
                                        {player.name}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>

                </div>

            </section>

            {/* LAST SCORE */}
            <section className="last-score">

                <div>
                    <span className="section-title">
                        LAST SCORE
                    </span>

                    {gameState.lastScore ? (
                        <div className="last-score-content">
                            <strong>
                                {gameState.lastScore.playerName}
                            </strong>

                            <span>
                                scored for{" "}
                                {gameState.lastScore.teamId === 1
                                    ? "RED"
                                    : "BLUE"}
                            </span>
                        </div>
                    ) : (
                        <span className="empty">
                            No score yet
                        </span>
                    )}
                </div>

            </section>

        </div>
    );
}

export default Game;

