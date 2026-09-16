// Throwaway, one-off script — never imported by the app, never run at
// dev/build time. Pulls a handful of real Tomosia products from the live
// Storefront API so the merchant portal's fixture data (lib/fixtures/*)
// can be hand-authored from real ids/titles/prices instead of invented
// ones. Run once with:
//   node --env-file=.env scripts/pull-merchant-fixtures.mjs
const rawDomain = process.env.SHOPIFY_STORE_DOMAIN ?? "";
const domain = rawDomain && !rawDomain.startsWith("https://") ? `https://${rawDomain}` : rawDomain;
const endpoint = `${domain}/api/2023-01/graphql.json`;
const token =
  process.env.SHOPIFY_STOREFRONT_PRIVATE_ACCESS_TOKEN ||
  process.env.SHOPIFY_STOREFRONT_PUBLIC_ACCESS_TOKEN ||
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

if (!domain || !token) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or a storefront access token — run with: node --env-file=.env scripts/pull-merchant-fixtures.mjs");
  process.exit(1);
}

const query = /* GraphQL */ `
  query getProductsForFixtures {
    products(first: 15) {
      edges {
        node {
          id
          handle
          title
          productType
          options {
            name
            values
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          featuredImage {
            url
          }
          variants(first: 20) {
            edges {
              node {
                id
                title
                availableForSale
                selectedOptions {
                  name
                  value
                }
                price {
                  amount
                }
              }
            }
          }
        }
      }
    }
  }
`;

const res = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(process.env.SHOPIFY_STOREFRONT_PRIVATE_ACCESS_TOKEN
      ? { "Shopify-Storefront-Private-Token": token }
      : { "X-Shopify-Storefront-Access-Token": token }),
  },
  body: JSON.stringify({ query }),
});

const body = await res.json();
if (body.errors) {
  console.error(JSON.stringify(body.errors, null, 2));
  process.exit(1);
}

const products = body.data.products.edges.map((edge) => edge.node);
console.log(JSON.stringify(products, null, 2));
