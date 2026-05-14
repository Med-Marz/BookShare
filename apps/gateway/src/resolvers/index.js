const userResolvers = require('./userResolvers');

// Combined resolver map for Apollo Server. Each domain owns its own file.
module.exports = {
  Query: {
    _empty: () => null,
  },
  Mutation: {
    ...userResolvers.Mutation,
  },
};
