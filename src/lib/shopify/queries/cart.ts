import cartFragment from "../fragments/cart";

export const getCartQuery = /* GraphQL */ `
  query getCart($cartId: ID!) {
    cart(id: $cartId) {
      ...cart
    }
  }
  ${cartFragment}
`;

// Read once a delivery address is on the cart (cartDeliveryAddressesAddMutation);
// one group per address the cart's lines ship to, which is one for this store.
export const getCartDeliveryGroupsQuery = /* GraphQL */ `
  query getCartDeliveryGroups($cartId: ID!) {
    cart(id: $cartId) {
      deliveryGroups(first: 5) {
        edges {
          node {
            deliveryOptions {
              handle
              title
              description
              deliveryMethodType
              estimatedCost {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`;
