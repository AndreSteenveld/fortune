# Plugins

Fortune comes with some defaults to work out of the box, and there are alternatives to the defaults. The Adapter and Serializer classes adhere to the [polymorphic open/closed principle](https://en.wikipedia.org/wiki/Open/closed_principle#Polymorphic_open.2Fclosed_principle), so they should be extended (subclassed) rather than modified.


### Adapters

Adapters must subclass and implement the Adapter class. The adapter could be backed by anything from a text file to a distributed database, as long as it implements the class.

| Adapter          | Author         | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [NeDB](https://github.com/louischatriot/nedb) (included, default) | [0x8890](https://github.com/0x8890) | Embedded document data store with an API that is mostly compatible with MongoDB. |
| IndexedDB (included) | [0x8890](https://github.com/0x8890) | Data storage adapter that works in modern browsers. |
| Web Storage (included) | [0x8890](https://github.com/0x8890) | Data storage adapter that works in most browsers. |
| [MongoDB](https://github.com/fortunejs/fortune-mongodb) | [0x8890](https://github.com/0x8890) | Document data store. MongoDB is [web scale](http://www.mongodb-is-web-scale.com/). |
| [PostgreSQL](https://github.com/fortunejs/fortune-pg) | [0x8890](https://github.com/0x8890) | Relational database adapter, translates adapter method inputs to SQL. |


### Serializers

Serializers process data, they must subclass and implement the Serializer class.

| Serializer       | Author         | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [Micro API](http://micro-api.org) (included, default) | [0x8890](https://github.com/0x8890) | A minimal serialization format for hypermedia APIs. |
| [JSON API](http://jsonapi.org) (included, default) | [0x8890](https://github.com/0x8890) | Tracking JSON API 1.0, useful for clients such as [Ember Data](https://github.com/emberjs/data). |


### Networking

Network helpers may map external input to a request and map the response to an external output. Using Fortune with a network protocol is optional.

| Implementation   | Author         | Description                             |
|:-----------------|:---------------|:----------------------------------------|
| [HTTP](http://fortunejs.com/api/#net-http) (included) | [0x8890](https://github.com/0x8890) | Implements the `requestListener` function for `http.createServer`, compatible with [Connect](https://github.com/senchalabs/connect), [Express](http://expressjs.com/), and similar frameworks. |
| [WebSocket](http://fortunejs.com/api/#net-websocket) (included) | [0x8890](https://github.com/0x8890) | WebSocket implementation which uses the `ws` module. |


### Browser

Fortune includes a browser build, which comes with only an IndexedDB adapter and the default serializer. A CommonJS-compatible build pipeline is required to use it, along with a bundler that supports the `browser` feature of `package.json`.

```js
import fortune from 'fortune' // Works in browser environment.
```
