const userResolvers = require('./userResolvers');
const bookResolvers = require('./bookResolvers');

// Combined resolver map for Apollo Server. Each domain owns its own file.
module.exports = {
  Query: {
    _empty: () => null,
    ...userResolvers.Query,
  },
  Mutation: {
    ...userResolvers.Mutation,
    ...bookResolvers.Mutation,
  },
};
