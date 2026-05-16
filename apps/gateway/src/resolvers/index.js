const userResolvers = require('./userResolvers');
const bookResolvers = require('./bookResolvers');
const reservationResolvers = require('./reservationResolvers');

// Combined resolver map for Apollo Server. Each domain owns its own file.
module.exports = {
  Query: {
    _empty: () => null,
    ...userResolvers.Query,
    ...bookResolvers.Query,
    ...reservationResolvers.Query,
  },
  Mutation: {
    ...userResolvers.Mutation,
    ...bookResolvers.Mutation,
    ...reservationResolvers.Mutation,
  },
  User: {
    ...bookResolvers.User,
  },
  Book: {
    ...bookResolvers.Book,
  },
  SearchBook: {
    ...bookResolvers.SearchBook,
  },
  Reservation: {
    ...reservationResolvers.Reservation,
  },
  Me: {
    ...userResolvers.Me,
  },
};
