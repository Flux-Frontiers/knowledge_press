/**
 * Fading the sun's shadows out at the edge of the shadow map. A map that
 * follows the cart otherwise switches a grove's shadows on all at once as its
 * edge passes over them; this eases them in across the outer part of the map.
 */

/** The outer fraction of the map's half-width over which shadows fade out. */
export const SHADOW_EDGE_FADE = 0.25;

const RETURN = "\t\t\treturn mix( 1.0, shadow, shadowIntensity );";

/**
 * three's shadow lookup with the edge fade added: each directional and spot
 * `getShadow` scales its shadow by how far the point sits from the map's edge.
 * Applied to ShaderChunk.shadowmap_pars_fragment before anything compiles.
 *
 * :param chunk: three's `shadowmap_pars_fragment` source.
 * :returns: The patched source, and how many lookups it changed (3 in three r187; 0 means three changed it).
 */
export function fadeShadowChunk(chunk: string): { source: string; patched: number } {
  const parts = chunk.split(RETURN);
  const faded = [
    "\t\t\tvec2 kpEdge = abs( shadowCoord.xy - 0.5 ) * 2.0;",
    `\t\t\tfloat kpFade = smoothstep( ${(1 - SHADOW_EDGE_FADE).toFixed(3)}, 1.0, max( kpEdge.x, kpEdge.y ) );`,
    "\t\t\treturn mix( 1.0, shadow, shadowIntensity * ( 1.0 - kpFade ) );",
  ].join("\n");
  return { source: parts.join(faded), patched: parts.length - 1 };
}
