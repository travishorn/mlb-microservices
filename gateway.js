import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

/**
 * MLB API Gateway
 *
 * The gateway offers a single entry point that composes multiple domain
 * services (players, teams) so clients have a unified API surface and do not
 * need to orchestrate calls across services.
 */

const fastify = Fastify({
  logger: true,
});

const services = {
  player: {
    url: "http://localhost:3001",
  },
  team: {
    url: "http://localhost:3002",
  },
};

// Schemas are duplicated here intentionally so the gateway can document its
// contracts independently of each downstream service. This decoupling allows
// the gateway to evolve response composition while still providing accurate,
// client-facing documentation.
/**
 * @typedef {object} Player
 * @property {number} id - Identifier used to correlate with teams.
 * @property {number} teamId - Foreign key linking a player to a team.
 * @property {string} name - Display name consumed by clients.
 * @property {string} position - Primary role. Used by client UIs for labeling and grouping.
 */
/**
 * @typedef {object} Team
 * @property {number} id - Identifier for team.
 * @property {string} name - Team name.
 * @property {string} division - Team division (e.g., AL East, NL West).
 */
/**
 * @typedef {object} Roster
 * @property {Team} team - Team details.
 * @property {Player[]} roster - Player subset computed by the gateway.
 */
/**
 * @typedef {object} ServiceError
 * @property {string} error - Human-readable error.
 */
const playerSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    teamId: { type: "integer" },
    name: { type: "string" },
    position: { type: "string" },
  },
};

const teamSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    division: { type: "string" },
  },
};

const rosterSchema = {
  type: "object",
  properties: {
    team: teamSchema,
    roster: {
      type: "array",
      items: playerSchema,
    },
  },
};

const errorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
  },
};

await fastify.register(swagger, {
  openapi: {
    // Clear name for the API docs.
    info: { title: "MLB Gateway" },
    components: {
      schemas: {
        Player: playerSchema,
        Team: teamSchema,
        Roster: rosterSchema,
        Error: errorSchema,
      },
    },
  },
});

await fastify.register(swaggerUi);

fastify.get(
  "/players",
  {
    schema: {
      // Gateway forwards the domain data as-is.
      description: "Get all players",
      tags: ["players"],
      response: {
        200: {
          type: "array",
          items: playerSchema,
        },
      },
    },
  },
  /**
   * Proxies the players list from the player service.
   *
   * Proxying instead of aggregating keeps the basic list cheap and fast.
   */
  async function handler(request, reply) {
    const response = await fetch(`${services.player.url}`);
    return response.json();
  }
);

fastify.get(
  "/teams",
  {
    schema: {
      description: "Get all teams",
      tags: ["teams"],
      response: {
        200: {
          type: "array",
          items: teamSchema,
        },
      },
    },
  },
  /**
   * Proxies the teams list from the team service.
   */
  async function handler(request, reply) {
    const response = await fetch(`${services.team.url}`);
    return response.json();
  }
);

fastify.get(
  "/players/:id",
  {
    schema: {
      description: "Get a player by ID",
      tags: ["players"],
      params: {
        type: "object",
        properties: {
          id: { type: "integer" },
        },
        required: ["id"],
      },
      response: {
        200: playerSchema,
        404: errorSchema,
      },
    },
  },
  /**
   * Retrieves a single player by ID via the player service.
   *
   * Why the gateway does not rewrite 404s here:
   * - Preserves the downstream error semantics so clients and logs reflect the true source.
   */
  async function handler(request, reply) {
    const response = await fetch(`${services.player.url}/${request.params.id}`);
    return response.json();
  }
);

fastify.get(
  "/teams/:id",
  {
    schema: {
      description: "Get a team by ID",
      tags: ["teams"],
      params: {
        type: "object",
        properties: {
          id: { type: "integer" },
        },
        required: ["id"],
      },
      response: {
        200: teamSchema,
        404: errorSchema,
      },
    },
  },
  /**
   * Retrieves a single team by ID via the team service.
   *
   * Why keep passthrough semantics:
   * - Makes client and gateway behavior predictable and debuggable.
   */
  async function handler(request, reply) {
    const response = await fetch(`${services.team.url}/${request.params.id}`);
    return response.json();
  }
);

fastify.get(
  "/teams/:id/roster",
  {
    schema: {
      description: "Get team roster with team details",
      tags: ["teams"],
      params: {
        type: "object",
        properties: {
          id: { type: "integer" },
        },
        required: ["id"],
      },
      response: {
        200: rosterSchema,
        404: errorSchema,
      },
    },
  },
  /**
   * Composes a roster view by joining team details with players filtered by
   * team.
   *
   * Composition here centralizes cross-domain joins so domain services remain
   * focused and independently scalable and prevents data duplication across
   * services and reduces client complexity.
   */
  async function handler(request, reply) {
    const teamId = request.params.id;

    const teamRes = await fetch(`${services.team.url}/${teamId}`);
    const team = await teamRes.json();

    if (team && team.error) {
      reply.status(404);
      return { error: "Team not found" };
    }

    const playersRes = await fetch(`${services.player.url}`);
    const players = await playersRes.json();

    const roster = Array.isArray(players)
      ? players.filter((player) => String(player.teamId) === String(teamId))
      : [];

    return {
      team,
      roster,
    };
  }
);

try {
  await fastify.listen({ port: 3000 });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
