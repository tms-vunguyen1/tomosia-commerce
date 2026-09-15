import cartFragment from "../fragments/cart";

export const addToCartMutation = /* GraphQL */ `
  mutation addToCart($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        ...cart
      }
    }
  }
  ${cartFragment}
`;

export const createCartMutation = /* GraphQL */ `
  mutation createCart($lineItems: [CartLineInput!]) {
    cartCreate(input: { lines: $lineItems }) {
      cart {
        ...cart
      }
    }
  }
  ${cartFragment}
`;

export const editCartItemsMutation = /* GraphQL */ `
  mutation editCartItems($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart {
        ...cart
      }
    }
  }
  ${cartFragment}
`;

export const removeFromCartMutation = /* GraphQL */ `
  mutation removeFromCart($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart {
        ...cart
      }
    }
  }
  ${cartFragment}
`;

// Selected so this quote becomes the cart's own; `withCarrierRates` is left off
// (its live-carrier rates need @defer, a streaming response this app doesn't parse),
// so this returns only the rates the store itself has configured.
export const cartDeliveryAddressesAddMutation = /* GraphQL */ `
  mutation cartDeliveryAddressesAdd(
    $cartId: ID!
    $address: CartDeliveryAddressInput!
  ) {
    cartDeliveryAddressesAdd(
      cartId: $cartId
      addresses: [{ selected: true, address: { deliveryAddress: $address } }]
    ) {
      userErrors {
        message
        field
      }
    }
  }
`;

export const updateCartBuyerIdentityMutation = /* GraphQL */ `
  mutation updateCartBuyerIdentity(
    $cartId: ID!
    $buyerIdentity: CartBuyerIdentityInput!
  ) {
    cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) {
      cart {
        ...cart
      }
      userErrors {
        code
        field
        message
      }
    }
  }
  ${cartFragment}
`;
