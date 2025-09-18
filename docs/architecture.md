# Architecture

This system is a small microservices setup with an API Gateway that composes
data from domain services.

## System context

```mermaid
flowchart LR
  Client((Client))
  Client -->|HTTP| Gateway[Gateway :3000]
  Gateway -->|HTTP :3001| Player[Player Service]
  Gateway -->|HTTP :3002| Team[Team Service]
```

`gateway.js` exposes client-facing endpoints and composes cross-domain
responses. `services/player.js` owns and serves player data. `services/team.js`
owns and serves team data.

## Sequence: GET /players

```mermaid
sequenceDiagram
  participant C as Client
  participant G as Gateway :3000
  participant P as Player :3001

  C->>G: GET /players
  G->>P: GET /
  P-->>G: 200 [Player[]]
  G-->>C: 200 [Player[]]
```

## Sequence: GET /teams/:id/roster

```mermaid
sequenceDiagram
  participant C as Client
  participant G as Gateway :3000
  participant P as Player :3001
  participant T as Team :3002

  C->>G: GET /teams/:id/roster
  G->>T: GET /:id
  alt team exists
    T-->>G: 200 Team
    G->>P: GET /
    P-->>G: 200 [Player[]]
    G-->>C: 200 { team, roster }
  else team not found
    T-->>G: 404 { error }
    G-->>C: 404 { error: "Team not found" }
  end
```

## Notes

- Gateway preserves downstream errors for simple proxy routes.
- Composition lives in the gateway to keep domain services simple and
  scalable.
