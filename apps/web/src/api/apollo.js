import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

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

// Mirror the axios 401 behaviour for GraphQL. Apollo Server returns
// AUTHENTICATION_REQUIRED in extensions.code when our resolvers reject.
// Skip the redirect for the Signup / Login operations themselves so a failed
// login does not loop the user back to /login.
const errorLink = onError(({ graphQLErrors, operation }) => {
  if (!graphQLErrors || graphQLErrors.length === 0) return;
  const isAuthOp = operation.operationName === 'Signup' || operation.operationName === 'Login';
  const requiresLogin = graphQLErrors.some((e) => e.extensions?.code === 'AUTHENTICATION_REQUIRED');
  if (requiresLogin && !isAuthOp) {
    localStorage.removeItem('bookshare.token');
    localStorage.removeItem('bookshare.user');
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
});

const client = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
});

export default client;
