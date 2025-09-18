import Fastify from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

/**
 * Team service
 *
 * The microservice encapsulates team data and ownership so organizational
 * boundaries map to system boundaries.
 */

const fastify = Fastify({ logger: true });

// Explicit schemas offer guarantees to consumers and power OpenAPI docs.
/**
 * @typedef {object} Team
 * @property {number} id - Identifier used for joins with other domains (e.g., players).
 * @property {string} name - Display name for UI and reporting.
 * @property {string} division - Organization grouping used by clients for filtering and display.
 */
/**
 * @typedef {object} ServiceError
 * @property {string} error - Human-readable error message
 */
const teamSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    division: { type: "string" },
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
    info: { title: "Team Microservice" },
    components: {
      schemas: {
        Team: teamSchema,
        Error: errorSchema,
      },
    },
  },
});

await fastify.register(swaggerUi);

// In-memory data would be replaced with persistent storage in production.
const teams = [
  { id: 1, name: "Los Angeles Dodgers", division: "NL West" },
  { id: 2, name: "New York Yankees", division: "AL East" },
];

fastify.get(
  "/",
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
   * Returns the complete set of teams.
   *
   * Returning the whole set keeps the service simple and lets the gateway
   * compose/filter for specific views (e.g., roster by team) without coupling
   * this service to gateway concerns.
   */
  async function handler() {
    return teams;
  }
);

fastify.get(
  "/:id",
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
   * Fetches a team by its unique identifier.
   */
  async function handler(request, reply) {
    const { id } = request.params;
    const team = teams.find((team) => team.id === parseInt(id));

    if (!team) {
      reply.statusCode = 404;
      return { error: "Team not found" };
    }

    return team;
  }
);

try {
  // Port 3002 avoids collisions with the gateway and other services.
  await fastify.listen({ port: 3002 });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
