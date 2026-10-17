# 🏀 Node Haxball Basket

A **full-stack, event-driven, real-time multiplayer basketball system** built with Node.js, PostgreSQL, React and Haxball.

The project combines a real-time Haxball game environment with a persistent backend and web interface, providing player accounts, statistics, competitive ELO ranking, match tracking, in-game chat, and real-time game logic.

---

## ✨ Features

### 🎮 Real-Time Multiplayer

* 3v3 / 2v2 basketball gameplay
* Event-driven game logic
* Automatic team balancing
* Player join/leave handling
* Real-time game state management
* Haxball room integration

### 🧠 Event-Driven Architecture

The system is built around the event model provided by Haxball.

Important room events drive the application:
```text
Player Join
     │
     ▼
Account / Session Initialization
     │
     ▼
Queue
     │
     ▼
Team Balancing
     │
     ▼
Game Start
     │
     ▼
Game Events
     │
     ├── Player Input
     ├── Ball Touch
     ├── Score
     ├── AFK Check
     └── Player Leave
     └── Chat
     └── ---
     │
     ▼
Match Result
     │
     ▼
Statistics + ELO
     │
     ▼
Persistence
```

This allows the room to behave as the real-time execution environment while the backend services handle application and persistence concerns.

### 👤 Player System

* Persistent player accounts
* Player statistics
* Match history
* Win/loss tracking
* Win streak tracking
* Username management
* Player profiles

### 🏆 Competitive Ranking

The project includes an ELO-based competitive ranking system.

* Initial ELO rating
* Provisional rating system
* Dynamic K-factor
* Team ELO calculation
* Individual performance contribution
* Win/loss updates
* Rank tiers

Current rank progression:


```text
Coal → Bronze → Silver → Gold → Diamond → Legend
```

The ELO system also prevents low-participant matches from being used for unfair rating gains by requiring a minimum number of registered players per team.

### 📊 Statistics

Player statistics are persisted in PostgreSQL and updated through the backend service layer.

Tracked data includes:

* Wins
* Losses
* ELO
* Win streak
* Point contributions
* Match results

### 💬 Chat & Moderation

The in-game chat system provides:

* Player commands
* Statistics commands
* Ranking commands
* Leaderboard
* Player comparisons
* Account-related commands
* Help system
* ELO/rank announcements
* Spam protection
* Progressive chat cooldowns
* Profanity filtering

---

#### 🔄 Match & ELO Flow

A simplified match lifecycle looks like this:

```text
Haxball Match
      │
      ▼
Game Events
      │
      ▼
Game Logic
      │
      ▼
Match Result
      │
      ▼
User Service
      │
      ├──────────────┐
      ▼              ▼
ELO Calculation   Statistics
      │              │
      └──────┬───────┘
             ▼
        Repository
             │
             ▼
         PostgreSQL
```

For completed matches, the backend calculates the result and updates player progression through the service and repository layers.

The ELO system considers team strength and individual contribution when calculating rating changes.

### 🔐 Authentication & Account Management

The account system supports:
```text
Guest Account
      │
      ├── !register / !kayit
      ▼
Registered Account
      │
      └── !login / !giris

```

Password handling is implemented in the service layer using Node.js cryptographic primitives and scrypt.

Passwords are stored as peppered hashes rather than plaintext, while a deterministic password key is separately generated for enforcing password uniqueness.

```text
The system supports:

Guest accounts
Account registration
Login
Username updates
Password verification
Automatic account lookup
Guest → registered account conversion
Guest statistic migration
Transaction-safe account operations
 ```
---

## 🏗️ Architecture

The project follows a layered architecture separating the real-time game environment from game logic and persistence.

```text
                         ┌──────────────────────┐
                         │      React Web       │
                         │      Frontend        │
                         └──────────┬───────────┘
                                    │
                              REST / WebSocket
                                    │
                                    ▼
┌─────────────────┐       ┌──────────────────────┐
│                 │       │                      │
│    Haxball      │──────▶│     Node.js          │
│    Room         │       │     Backend           │
│                 │       │                      │
└─────────────────┘       └──────────┬───────────┘
                                     │
                              ┌──────▼──────┐
                              │ Game Logic  │
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │  Services   │
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │ Repositories│
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │ PostgreSQL  │
                              └─────────────┘
```



<img width="2105" height="569" alt="node-haxball" src="https://github.com/user-attachments/assets/27aedfbc-82e3-4f6a-912f-8168690f643c" />




### Architecture Responsibilities

**Haxball / Room Layer**

Responsible for the real-time multiplayer environment and room events.

**Game Logic**

Handles gameplay-related rules and real-time state transitions such as team balancing, player distribution, and game flow.

**Services**

Contains application and domain-level operations such as game logic, player management, match recording, statistics, and ELO updates.

**Repositories**

Provide the persistence layer between the application and PostgreSQL.

**PostgreSQL**

Stores persistent player, ranking, statistics, and match-related data.

**React Frontend**

Provides the web-facing interface for interacting with the system and visualizing player/game data.

---



---

## 🧩 Technology Stack

| Technology       | Purpose                         |
| ---------------- | ------------------------------- |
| **React**        | Web frontend                    |
| **Node.js**      | Backend runtime                 |
| **JavaScript**   | Application language            |
| **node-haxball** | Real-time game environment      |
| **PostgreSQL**   | Persistent database             |
| **Docker**       | Containerization and deployment |
| **REST API**     | Backend/frontend communication  |

---

## 📁 Project Structure

The project is organized around responsibilities rather than keeping the entire application inside a single room script.

```text
.
├── controllers/
│
│
├── services/
└── gameLogic
└── eloLogic
└── ...
│
│
├── repositories/
│
├── migrations/
│
├── frontend/
│   └── React application
│
├── test/
└── Unit tests
│   
├── docker
│
└── main
│
└──  ...
```

> The exact directory structure may evolve as the project continues to develop.

---

## 🗄️ Persistence

PostgreSQL is used as the persistent source of player and competitive data.

The database-backed architecture allows player progression and statistics to survive independently from an individual Haxball room session.

This separates:

```text
Real-Time Game State
        │
        ▼
   Haxball Room
```

from:

```text
Persistent Player State
        │
        ▼
      Backend
        │
        ▼
    PostgreSQL
```

---


## 🚀 Development Goals

The project is being developed toward a broader full-stack real-time game ecosystem.

Planned or expanding areas include:

* Interactive Website
* Live match monitoring with WebSocket
* Player dashboards
* Leaderboards
* Match history
* Additional game analytics
* Discord integration
* TypeScript migration and integration

---

## 🐳 Deployment

The project uses Docker-based infrastructure to simplify deployment and isolate application components.

The backend, database, and supporting services can be managed as separate containers depending on the deployment environment.

---

## 📌 Project Status

**Active Development**

The core game environment, player system, PostgreSQL persistence, statistics, ELO/ranking logic, chat functionality, and backend service architecture are already running on a VPS.

[![Live Room](https://img.shields.io/badge/🎮-Live%20Room-brightgreen)](https://www.haxball.com/play?c=xcUWRXMEeGQ)

The full-stack web layer and external integrations are being expanded alongside the core system.

---

## 🎯 Project Direction

The long-term goal is to turn the project from a traditional Haxball room script into a complete **real-time multiplayer game system** 
```

The architecture is designed to keep real-time gameplay, application logic, persistence, and external interfaces separated while allowing them to work together as a single system.

---

## 📄 License

License information will be added as the project is prepared for public release.


