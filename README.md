[![Fortune.js](https://fortunejs.github.io/fortune-website/assets/fortune_logo.svg)](http://fortunejs.com/)

**Fortune.js** is a [composable](https://en.wikipedia.org/wiki/Composability) framework for [data-driven applications](https://groups.drupal.org/node/143074). It provides a [workflow](https://en.wikipedia.org/wiki/Workflow) for manipulating data, with networking as an external layer on top.

[View the website](http://fortunejs.com) for documentation. Get it from `npm`:

```sh
$ npm install fortune --save
```


## Key Concepts

- At the core of Fortune is the **dispatcher**, which controls the flow of a request through middleware functions.
- There are two components that are swappable: the **adapter** and the **serializer**. Each instance may have one adapter and multiple serializers.
- Networking is *external* to Fortune. There is a basic `requestListener` function for HTTP that works out of the box, included for convenience.


## Example

Here is a basic CRUD example:

```js
import Fortune from 'fortune'
import http from 'http'

new Fortune()

  .model('user', {
    name: { type: String },
    groups: { link: 'group', isArray: true, inverse: 'members' }})

  .model('group', {
    name: { type: String },
    members: { link: 'user', isArray: true, inverse: 'group' }})

  .initialize().then(app => {
    const listener = fortune.net.requestListener.bind(app)
    http.createServer(listener).listen(1337) })
```

This yields a HTTP API that conforms to the full [JSON API](http://jsonapi.org) specification, and [Micro API](http://micro-api.org) specification. By default, it is backed by an in-memory database, NeDB.


## Contributing

The [main repository is on GitHub](https://github.com/fortunejs/fortune). Fork it, install development dependencies with `npm install`, commit changes, make sure the code lints and the tests pass by running `npm test`, and submit a pull request.


## License

Fortune is licensed under the [MIT license](https://raw.githubusercontent.com/fortunejs/fortune/rewrite/LICENSE).
