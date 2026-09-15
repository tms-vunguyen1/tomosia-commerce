// The customer's own orders, reachable only through their access token: that is what
// keeps another customer's order unreachable. Read by the assistant's internal API.
export const getCustomerOrdersQuery = /* GraphQL */ `
  query getCustomerOrders($token: String!, $first: Int!) {
    customer(customerAccessToken: $token) {
      id
      firstName
      lastName
      defaultAddress {
        address1
        address2
        city
        company
        countryCodeV2
        province
        provinceCode
        zip
      }
      orders(first: $first, sortKey: PROCESSED_AT, reverse: true) {
        edges {
          node {
            id
            name
            processedAt
            financialStatus
            fulfillmentStatus
            statusUrl
            currentTotalPrice {
              amount
              currencyCode
            }
            successfulFulfillments(first: 1) {
              trackingInfo {
                url
              }
            }
            lineItems(first: 20) {
              edges {
                node {
                  title
                  quantity
                  variant {
                    id
                    price {
                      amount
                      currencyCode
                    }
                    selectedOptions {
                      name
                      value
                    }
                    product {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;
