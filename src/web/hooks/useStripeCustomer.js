import { useMutation } from '@redwoodjs/web'
import gql from 'graphql-tag'
import { useApolloClient } from '@apollo/client'

import { StripeContext } from '../provider/StripeContext'



export const useStripeCustomer = (returnValues = `id
email
name`) => {
    const [createStripeCustomer] = useMutation(
    gql`
      mutation createStripeCustomer($data: CreateStripeCustomerInput ) {
        createStripeCustomer(data: $data) {
          ${returnValues}
        }
      }
    `
    )
  
  const RETRIEVE_STRIPE_CUSTOMER = gql`
    query retrieveStripeCustomer(
      $id: String!
    ) {
      retrieveStripeCustomer(id: $id) {
        id 
        name
        email
      }
    }
  `
    
  return {
    customer: StripeContext.customer,
    retrieveStripeCustomer: async (id) => {
      const client = useApolloClient()
      
      // create query
      const result = await client.query({
        query: RETRIEVE_STRIPE_CUSTOMER,
        variables: {
          id: id
        }
      })

      if (result.error) {
        throw result.error
      }

    return result.data?.retrieveStripeCustomer ?? null
    },
    createStripeCustomer: async (args) => {
      // Create Payload
      const payload = {
        variables: {
          data: args
        }
      }

      // Create Customer Portal Session
      const { data } = await createStripeCustomer(payload)
      return data.createStripeCustomer
    }
  }
}