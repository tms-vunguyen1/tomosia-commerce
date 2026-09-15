import productFragment from "../fragments/product";

export const getProductQuery = /* GraphQL */ `
  query getProduct($handle: String!) {
    product(handle: $handle) {
      ...product
    }
  }
  ${productFragment}
`;

// The assistant addresses products by their global id, not by handle: a product id and a
// variant id share one namespace, so the node is resolved as either.
export const getProductByIdQuery = /* GraphQL */ `
  query getProductById($id: ID!) {
    node(id: $id) {
      ... on Product {
        ...product
      }
      ... on ProductVariant {
        id
        title
        availableForSale
        selectedOptions {
          name
          value
        }
        price {
          amount
          currencyCode
        }
        product {
          ...product
        }
      }
    }
  }
  ${productFragment}
`;

export const getProductsQuery = /* GraphQL */ `
  query getProducts(
    $sortKey: ProductSortKeys
    $reverse: Boolean
    $query: String
    $cursor: String
  ) {
    products(
      sortKey: $sortKey
      reverse: $reverse
      query: $query
      first: 12
      after: $cursor
    ) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        endCursor
      }
      edges {
        node {
          ...product
        }
      }
    }
  }
  ${productFragment}
`;

export const getProductRecommendationsQuery = /* GraphQL */ `
  query getProductRecommendations($productId: ID!) {
    productRecommendations(productId: $productId) {
      ...product
    }
  }
  ${productFragment}
`;

export const getHighestProductPriceQuery = /* GraphQL */ `
  query getHighestProductPrice {
    products(first: 1, sortKey: PRICE, reverse: true) {
      edges {
        node {
          variants(first: 1) {
            edges {
              node {
                price {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
`;
