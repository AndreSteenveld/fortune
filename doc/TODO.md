# To-do list

- Update and delete workflows.
- NeDB Adapter.
- JSON API Serializer.
- Replace `idCache` with `Set` type.
- HTTP miscellaneous features.
- Write more tests with tape, and integration test using the default stack.

## Done

- Dispatcher should do all adapter calls to sync inverse relationships.
- Consider if Fortune can be isomorphic (run on server and client). Answer: it already should.
- Internal refactor of actions into flows.
- Dependency injection for adapter/serializer.
- Known bug: Array.prototype.find doesn't work correctly with babel-runtime. Resolved by using proxy method for find.
- Consider using [URI Template](http://tools.ietf.org/html/rfc6570).
- Changed signature of transform function. Now entity is accepted as second parameter and `this` is no longer bound.
- Add optional `processRequest` and `processResponse` in serializer.
- Remove `bufferEncoding` option. Superceded by `schema` options object.
- How to remove `_entities` and `_include` from response object? Done in `_processResponse` now.
- Remove 6to5 from distribution.
- Pagination (limit and offset options in the adapter).
- Add serializer hooks to allow the entire request/response payload to be transformed (useful for "meta" object). Implemented as `Serializer.processRequest`.
- Reorganize file/folder structure.
- Server initialization method? This is now handled separately from core module.
- Should serializer process query strings? Leaning towards no since that is HTTP, but maybe? Actually I think it should though. Now it is implemented as `Serializer.processRequest`.
- Request options should be specific to a type.
- Make dispatcher call stubs to adapter for ACID transactions.
- Option to disable casting and mangling of buffers? Now this option exists on `Schema.Enforcer`.
- Removed `inflect` and `prefix` options, these should be handled per serializer.
- Make serializer methods return context, this makes life easier.
- Create linked entity if there was a related field.
- Include uniqueness problem if original request does not supply IDs.
- Primary key configuration.
- Minimize or eliminate `indexOf`, `map`, `reduce` calls.
- ID requirement? Primary key? Problem with checking object sameness for includes by ID. Resolved with ID lookup hash table.
- Schema enforcement during I/O.
- Ordered serializers by priority.
- Typed errors.
- Remove the `_relatedType` and `_relatedIds`.
- Dispatcher abstraction from HTTP, consolidate `request` and `response` in the `context` object.
- Remove `require` calls in Serializer and Adapter. Resolved by removing strings.
