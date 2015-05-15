// local modules
import AdapterSingleton from './adapter/singleton'
import SerializerSingleton from './serializer/singleton'
import Dispatcher, { dispatch } from './dispatcher'
import validate from './schema/validate'
import ensureSchemas from './schema/ensure_schemas'

// static exports
import * as adapters from './adapter/adapters'
import * as serializers from './serializer/serializers'
import * as net from './net'
import * as errors from './common/errors'


/**
 * The Fortune class has a few static properties attached to it that may be
 * useful to access:
 *
 * - `adapters`: included adapters
 * - `serializers`: included serializers
 * - `net`: network protocol helpers
 * - `errors`: custom typed errors
 */
export default class Fortune {

  /**
   * Create a new instance. The options object may be as follows:
   *
   * ```js
   * {
   *   // Storage adapter configuration.
   *   // Default: NeDB
   *   adapter: {
   *     // Must be a class that extends `Fortune.Adapter`, or a function
   *     // that accepts one argument, the Adapter class, and returns a
   *     // subclass. Required.
   *     type: function (Adapter) { ... },
   *
   *     // An options object that is specific to the adapter.
   *     // Default: undefined
   *     options: {}
   *   },
   *
   *   // An array of objects ordered by priority.
   *   // Default: Micro API, JSON API
   *   serializers: [{
   *     // Must be a class that extends `Fortune.Serializer`, or a function
   *     // that accepts one argument, the Serializer class, and returns a
   *     // subclass. Required.
   *     type: function (Serializer) { ... },
   *
   *     // An options object that is specific to the serializer.
   *     // Default: undefined
   *     options: { ... }
   *   }]
   * }
   * ```
   *
   * @param {Object} [options]
   */
  constructor (options = {}) {
    if (typeof options !== 'object')
      throw new TypeError(`Argument "options" must be an object.`)

    Object.defineProperties(this, {
      // 0 = not started, 1 = started, 2 = done.
      connectionStatus: { writable: true, value: 0 },
      currentType: { writable: true, value: undefined },
      options: { value: setDefaults(options) },
      transforms: { value: {} },
      schemas: { value: {} }
    })

    // The singletons are responsible for extracting options and
    // dependencies, and doing dependency injection.
    this.adapter = new AdapterSingleton(this)
    this.serializer = new SerializerSingleton(this)
    this.dispatcher = new Dispatcher(this)
  }


  /**
   * This method should be called when all setup is done. After this method
   * succeeds, record types can not be defined. The resolved value
   * is the instance of Fortune.
   *
   * @return {Promise}
   */
  start () {
    if (this.connectionStatus === 1)
      throw new Error(`Connection is in progress.`)

    else if (this.connectionStatus === 2)
      throw new Error(`Connection is already done.`)

    this.connectionStatus = 1

    return new Promise((resolve, reject) => {
      ensureSchemas(this.schemas)

      this.adapter.connect().then(() => {
        this.connectionStatus = 2
        return resolve(this)
      }, error => {
        this.connectionStatus = 0
        return reject(error)
      })
    })
  }


  /**
   * Close adapter connection, reset state to pre-connection.
   *
   * @return {Promise}
   */
  stop () {
    if (this.connectionStatus !== 2)
      throw new Error(`Instance has not been started.`)

    this.connectionStatus = 1

    return new Promise((resolve, reject) =>
      this.adapter.disconnect().then(() => {
        this.connectionStatus = 0
        return resolve(this)
      }, error => {
        this.connectionStatus = 2
        return reject(error)
      }))
  }


  /**
   * Define a record type given a name and a schema definition.
   * The `schema` object only serves to enforce data types, and does do not
   * do anything more, such as validation. Here are some example fields
   * of the `schema` object:
   *
   * ```js
   * {
   *   // A singular value.
   *   name: { type: String },
   *
   *   // An array containing values of a single type.
   *   lucky_numbers: { type: Number, isArray: true },
   *
   *   // Creates a to-many link to 'animal' record type. If the field `owner`
   *   // on the `animal` record type is not an array, this is a many-to-one
   *   // relationship, otherwise it is many-to-many. If a link is defined,
   *   // then the inverse field must also be specified.
   *   pets: { link: 'animal', isArray: true, inverse: 'owner' },
   *
   *   // This is allowed. `min` and `max` keys are ignored, need to
   *   // introspect the schema to implement validation.
   *   thing: { type: Number, min: 0, max: 100 },
   *
   *   // Nested schema fields will not be recursed.
   *   nested: { thing: { ... } } // wrong
   * }
   * ```
   *
   * The allowed native types are `String`, `Number`, `Boolean`, `Date`,
   * `Object`, `Buffer`. Note that the `Object` type should be a JSON
   * serializable object that may be persisted. The only other allowed type is
   * a `Symbol`, which may be used to represent custom types.
   *
   * @param {String} name - Name of the record type.
   * @param {Object} schema - Definition object.
   * @return this
   */
  defineType (name, schema) {
    const { schemas } = this

    if (this.connectionStatus !== 0)
      throw new Error(`Cannot define new record types after connection.`)

    if (typeof name !== 'string')
      throw new TypeError(`Name must be a string.`)

    if (!name.length)
      throw new Error(`Name must be non-trivial.`)

    if (name in schemas)
      throw new Error(`The record type "${name}" was already defined.`)

    if (typeof schema !== 'object')
      throw new TypeError(`Schema for "${name}" must be an object.`)

    schemas[name] = validate(schema)

    // Memoize the current name, for chaining methods.
    this.currentType = name

    return this
  }


  /**
   * This is the primary method for initiating dynamic dispatch. The options
   * object must be formatted as follows:
   *
   * ```js
   * {
   *   // The method is a Symbol type, keyed under `dispatcher.methods` and may
   *   // be one of `find`, `create`, `update`, or `delete`. To implement a
   *   // custom method, define a new flow under `dispatcher.flows`, and
   *   // define corresponding middleware functions under
   *   // `dispatcher.middlewares`.
   *   method: methods.find,
   *
   *   type: undefined, // Name of a type. Optional.
   *   ids: undefined, // An array of IDs. Optional.
   *
   *   // A 2-dimensional array specifying links to include. The first
   *   // dimension is a list, the second dimension is depth. For example:
   *   // [['comments'], ['comments', 'author']]
   *   include: [],
   *
   *   // Exactly the same as the adapter's `find` method options. The options
   *   // apply only to the primary type on `find` requests.
   *   options: { ... },
   *
   *   // Same as `options`, but is an object keyed by type. This is only
   *   // used in conjunction with the `include` option.
   *   includeOptions: { [type]: { ... } },
   *
   *   // The ID of the serializer to use for the input (request).
   *   serializerInput: undefined,
   *
   *   // The ID of the serializer to use for the output (response).
   *   serializerOutput: undefined,
   *
   *   meta: {}, // Meta-info of the request.
   *   payload: undefined // Payload of the request.
   * }
   * ```
   *
   * The response object looks much simpler:
   *
   * ```js
   * {
   *   meta: {}, // Meta-info of the response.
   *   payload: {} // Payload of the response.
   * }
   * ```
   *
   * The resolved response object should always be typed.
   *
   * @param {Object} options
   * @param {...*} [args]
   * @return {Promise}
   */
  dispatch () {
    if (this.connectionStatus !== 2)
      throw new Error(`Instance must be started before dispatching.`)

    return dispatch.apply(this.dispatcher, arguments)
  }


  /**
   * Define a transformation per record type.
   *
   * A transform function takes at least two arguments, the internal `context`
   * object and a single `record`.
   *
   * There are two kinds of transforms, before a record is written to transform
   * input, and after it is read to transform output, either is optional. If an
   * error occurs within an transform function, it will be forwarded to the
   * response. Use typed errors to provide the appropriate feedback. It is
   * important to note that `output` transforms are run every time a record is
   * shown in a response, so it should be idempotent.
   *
   * For a create request, the input transform must return the second argument
   * `record` either synchronously, or asynchronously as a Promise. The return
   * value of an update or delete request is inconsequential, but it may return
   * a value or a Promise.
   *
   * An example transform to apply a timestamp on a record before creation,
   * and displaying the timestamp in the server's locale:
   *
   * ```js
   * app.transform((context, record) => {
   *   record.timestamp = new Date()
   *   return record
   * }, (context, record) => {
   *   record.timestamp = record.timestamp.toLocaleString()
   *   return record
   * })
   * ```
   *
   * Requests to update a record will have the updates already applied
   * to the record.
   *
   * @param {String} [type]
   * @param {Function} [input]
   * @param {Function} [output]
   * @return this
   */
  transform (type, input, output) {
    const { schemas, transforms } = this

    if (arguments.length < 3) {
      input = arguments[0]
      output = arguments[1]
      type = this.currentType
    }

    if (![ input, output ].filter(fn => typeof fn === 'function').length)
      throw new TypeError(`A function must be passed to transform.`)

    if (!(type in schemas))
      throw new Error(`Attempted to define transform on "${type}" ` +
        `type which does not exist.`)

    if (!(type in transforms))
      transforms[type] = {}

    if (typeof input === 'function')
      transforms[type].input = input

    if (typeof output === 'function')
      transforms[type].output = output

    return this
  }


  /**
   * Convenience method to define only the `input` argument of
   * a transform.
   *
   * @param {String} [type]
   * @param {Function} fn
   * @return this
   */
  transformInput (type, fn) {
    if (arguments.length < 2) {
      fn = type
      type = this.currentType
    }

    return this.transform(type, fn, null)
  }


  /**
   * Convenience method to define only the `output` argument of
   * a transform.
   *
   * @param {String} [type]
   * @param {Function} fn
   * @return this
   */
  transformOutput (type, fn) {
    if (arguments.length < 2) {
      fn = type
      type = this.currentType
    }

    return this.transform(type, null, fn)
  }


  /**
   * An alternative to the constructor method, for people who hate the `new`
   * keyword with a passion. This is exactly the same as invoking
   * `new Fortune(options)`, so you're really not better off.
   */
  static create () {
    return new Fortune(...arguments)
  }

}


// Assign useful static properties to the default export.
Object.assign(Fortune, { adapters, serializers, net, errors })


// Apply default options, for internal use.
function setDefaults (options) {
  if (!('adapter' in options))
    options.adapter = { type: adapters.NeDB }

  if (!('serializers' in options))
    options.serializers = Object.keys(serializers).map(name =>
      ({ type: serializers[name] }))

  return options
}
