import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const gatewayUrl = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000';

const httpLink = new HttpLink({ uri: `${gatewayUrl}/graphql` });

const authLink = setContext((_operation, { headers }) => {
  const token = localStorage.getItem('bookshare.token');
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export default client;
