import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

/**
 * Player service
 *
 * The microservice separates the player domain from other domains (e.g., teams)
 * to enable independent scaling, deployment, and ownership. This keeps changes
 * to player data isolated from consumers who only need team data, and vice
 * versa.
 */

const fastify = Fastify({ logger: true });

// Schemas are defined to generate OpenAPI docs and provide runtime response
// shape guarantees, helping us catch breaking changes early.
/**
 * @typedef {object} Player
 * @property {number} id - Identifier used across services for joins.
 * @property {number} teamId - Foreign key to the team domain. Referenced by the gateway.
 * @property {string} name - The player's name.
 * @property {string} position - The player's primary position.
 */
/**
 * @typedef {object} ServiceError
 * @property {string} error - Human-readable error message
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

const errorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
  },
};

await fastify.register(swagger, {
  openapi: {
    // Clear name for the API docs.
    info: { title: "Player Microservice" },
    components: {
      schemas: {
        Player: playerSchema,
        Error: errorSchema,
      },
    },
  },
});

await fastify.register(swaggerUi);

// In-memory seed data. In production, this would be replaced by persistent
// storage.
const players = [
  { id: 1, teamId: 1, name: "Shohei Ohtani", position: "DH/P" },
  { id: 2, teamId: 1, name: "Mookie Betts", position: "2B" },
  { id: 3, teamId: 2, name: "Aaron Judge", position: "RF" },
];

fastify.get(
  "/",
  {
    schema: {
      // Descriptions communicate intent to API consumers, not implementation details.
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
   * Returns the full player list.
   *
   * Returning the whole set keeps the service simple and lets the gateway
   * compose/filter for specific views (e.g., roster by team) without coupling
   * this service to gateway concerns.
   */
  async function handler() {
    return players;
  }
);

fastify.get(
  "/:id",
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
   * Looks up a single player by their unique identifier.
   */
  async function handler(request, reply) {
    const { id } = request.params;
    const player = players.find((player) => player.id === parseInt(id));

    if (!player) {
      reply.statusCode = 404;
      return { error: "Player not found" };
    }

    return player;
  }
);

try {
  // Port 3001 avoids conflicts with the gateway and other services.
  await fastify.listen({ port: 3001 });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
