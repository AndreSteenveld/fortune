// local modules
import AdapterSingleton from './adapter/singleton'
import SerializerSingleton from './serializer/singleton'
import Dispatcher from './dispatcher'
import validate from './schema/validate'
import checkSchemas from './schema/check_schemas'

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
   *   // Default: JSON API, Micro API
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
      initializationStatus: { writable: true, value: 0 },
      currentModel: { writable: true, value: undefined },
      options: { value: options },
      transforms: { value: {} },
      schemas: { value: {} }
    })
  }


  /**
   * This method must be called when all setup is done. after this method
   * succeeds, models can not be defined. The resolved value
   * is the instance of Fortune.
   *
   * @return {Promise}
   */
  initialize () {
    if (this.initializationStatus === 1)
      throw new Error(`Initialization is in progress.`)

    else if (this.initializationStatus === 2)
      throw new Error(`Initialization is already done.`)

    return new Promise((resolve, reject) => {
      checkSchemas(this.schemas)
      setDefaults(this.options)

      this.initializationStatus = 1

      // The singletons are responsible for extracting options and
      // dependencies, and doing dependency injection.
      this.adapter = new AdapterSingleton(this)
      this.serializer = new SerializerSingleton(this)
      this.dispatcher = new Dispatcher(this)

      this.adapter.initialize().then(() => {
        this.initializationStatus = 2
        return resolve(this)
      }, (error) => {
        this.initializationStatus = 0
        return reject(error)
      })
    })
  }


  /**
   * Define a model given a name and a schema definition.
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
   *   // Creates a to-many link to 'animal' model. If the field `owner`
   *   // on the `animal` type is not an array, this is a many-to-one
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
   * `Object`, `Buffer`.
   *
   * @param {String} name name of the model
   * @param {Object} schema definition object
   * @return this
   */
  defineModel (name, schema) {
    if (this.initializationStatus !== 0)
      throw new Error(`Cannot define new models after initialization.`)

    if (typeof name !== 'string')
      throw new TypeError(`Name must be a string.`)

    if (!name.length)
      throw new Error(`Name must be non-trivial.`)

    if (name in this.schemas)
      throw new Error(`The model "${name}" was already defined.`)

    if (typeof schema !== 'object')
      throw new TypeError(`Schema for "${name}" must be an object.`)

    validate(schema)

    this.schemas[name] = schema

    // Memoize the current name, for chaining methods.
    this.currentModel = name

    return this
  }


  /**
   * Define a transformation per model type.
   *
   * A transform function takes at least two arguments, the internal `context`
   * object and a single `record`. The input transform may take an additional
   * argument, `update`, if the request is to update an record.
   *
   * There are two kinds of transforms, before a record is written to transform
   * input, and after it is read to transform output, either is optional. It
   * must return the second argument `record` either synchronously, or
   * asynchronously as a Promise. If an error occurs within an transform
   * function, it will be forwarded to the response. Use typed errors to
   * provide the appropriate feedback. It is important to note that `output`
   * transforms are run every time a record is shown in a response, so it
   * should be idempotent.
   *
   * An example transform to apply a timestamp on a record before writing,
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
   * @param {String} [type]
   * @param {Function} [input]
   * @param {Function} [output]
   * @return this
   */
  transform (type, input, output) {
    if (arguments.length < 3) {
      input = arguments[0]
      output = arguments[1]
      type = this.currentModel
    }

    if (![ input, output ].filter(fn => typeof fn === 'function').length)
      throw new TypeError(`A function must be passed to transform.`)

    if (!(type in this.schemas))
      throw new Error(`Attempted to define transform on "${type}" ` +
        `model which does not exist.`)

    this.transforms[type] = {}

    if (typeof input === 'function')
      this.transforms[type].input = input

    if (typeof output === 'function')
      this.transforms[type].output = output

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
      type = this.currentModel
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
      type = this.currentModel
    }
    return this.transform(type, null, fn)
  }


  /**
   * Set the adapter.
   *
   * @param {Function} type
   * @param {Object} [options]
   * @return this
   */
  setAdapter (type, options) {
    if (this.initializationStatus !== 0)
      throw new Error(`Cannot set adapter after initialization.`)

    this.options.adapter = { type, options }

    return this
  }


  /**
   * Add a serializer, with priority given to last added.
   *
   * @param {Function} type
   * @param {Object} [options]
   * @return this
   */
  addSerializer (type, options) {
    if (this.initializationStatus !== 0)
      throw new Error(`Cannot add serializer after initialization.`)

    if (!('serializers' in this.options))
      this.options.serializers = []

    this.options.serializers.unshift({ type, options })

    return this
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
    options.serializers = Object.keys(serializers).map(name => {
      return { type: serializers[name] }
    })

  return options
}
