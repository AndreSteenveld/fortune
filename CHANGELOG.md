## Roadmap

- 100% test coverage.
- Support more schema properties & options.

## Changelog

**v0.1.9 (10/20/2013)**
* Improve parsing of JSON-Patch requests.
* Expose `response` object to `before` and `after` transformations.
* Fix bug in NeDB adapter, not handling schema validations properly.
* Refactor tests, improve coverage.

**v0.1.8 (9/30/2013)**
* Fix resource post route, add shell script for running tests.

**v0.1.7 (9/14/2013)**
* Detect User-Agent header and send back response with `application/json` Content-Type if it exists. This allows a web browser to GET things more conveniently.

**v0.1.6 (9/14/2013)**
* Change the way that `before` and `after` transforms work. Now, one can simply return a value, or return a promise if asynchrony is needed. This is a breaking change that modifies the signature of the transform callbacks. (Thanks @stefanpenner)

**v0.1.5 (9/13/2013)**
* Add `before` transform on DELETE requests. This is a nilpotent operation, and exists mostly to allow for authorization checking on delete.

**v0.1.4 (9/11/2013)**
* Fix type checking in NeDB adapter.

**v0.1.3 (9/11/2013)**
* Fortune no longer enforces snake case on field names and resource names. The adapters have also been updated to reflect this.

**v0.1.2 (9/10/2013)**
* Make NeDB adapter persistent by default.

**v0.1.1 (9/10/2013)**
* Fix bug in NeDB adapter which would cause relationship updates to fail.
* Refactor unit tests.

**v0.1.0 (9/10/2013)**
* Use NeDB as default database adapter. This is a breaking change if you were relying on the default adapter to be MongoDB.
* Split up the database adapters into separate packages. There is now `fortune-mongodb` and `fortune-relational`.

**v0.0.5 (9/8/2013)**
* Convert keys to underscore for all incoming requests.

**v0.0.4 (9/6/2013)**
* Fix type checking code that breaks on Buffer types for all adapters.
* Fix regression in MongoDB adapter that exposed `_id` and `__v` fields.

**v0.0.3 (9/4/2013)**
* Use `createConnection` instead of `connect` in mongoose, which allows for multiple database connections.
* Expose and document the `router` namespace, which is actually an instance of `express`.
* Remove fields from the response that are not specified in the schema.

**v0.0.2 (8/27/2013)**
* Fix associations in MongoDB adapter.
* Improve request validation.

**v0.0.1 (8/26/2013)**
* Initial public release.
