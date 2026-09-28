/**
 * Page metadata in one shape.
 *
 * Every page states its own title and description; sharing a link to a client
 * page and getting the app's generic name back is the kind of small wrongness
 * that makes a tool feel unfinished.
 */
export function meta(title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
