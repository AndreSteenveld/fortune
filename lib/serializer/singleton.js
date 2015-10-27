import Serializer from './'
import DefaultSerializer from './default'
import castValue from './cast_value'
import * as errors from '../common/errors'

var constants = require('../common/constants')


const { UnsupportedError, NotAcceptableError, BadRequestError,
  nativeErrors } = errors


/**
 * Reroute the publicly accessed methods of the serializer to an underlying
 * serializer matching the context. For internal use.
 */
export default class SerializerSingleton extends Serializer {

  constructor (dependencies) {
    super()

    const { recordTypes, adapter, serializers } = dependencies
    const ids = []
    const types = serializers ? serializers.reduce((types, serializer) => {
      let { type } = serializer

      if (typeof type !== 'function')
        throw new TypeError(`The serializer must be a function or class.`)

      const CustomSerializer = Serializer.prototype
        .isPrototypeOf(type.prototype) ? type : type(Serializer)

      if (!Serializer.prototype.isPrototypeOf(CustomSerializer.prototype))
        throw new TypeError(`The serializer must be a class that extends ` +
          `Serializer.`)

      const { id } = CustomSerializer

      if (!id)
        throw new Error(`The serializer must have a static property ` +
          `named "id".`)

      ids.push(id)

      types[id] = new CustomSerializer({
        options: serializer.options || {},
        errors, recordTypes, adapter, castValue,
        methods: {
          find: constants.find,
          create: constants.create,
          update: constants.update,
          delete: constants.delete
        },
        keys: {
          primary: constants.primary,
          link: constants.link,
          isArray: constants.isArray,
          inverse: constants.inverse,
          denormalizedInverse: constants.denormalizedInverse
        }
      })

      return types
    }, {}) : {}

    Object.defineProperties(this, {

      // Internal property to keep instances of serializers.
      types: { value: types },

      // Internal instance of the default serializer.
      defaultSerializer: {
        value: new DefaultSerializer({ recordTypes, errors })
      },

      // Array of IDs ordered by priority.
      ids: { value: ids }

    })

    assignSerializerProxy.call(this)
  }

}


const inputMethods = new Set([ 'parseCreate', 'parseUpdate' ])


// Assign the proxy methods on top of the base methods.
function assignSerializerProxy () {
  const prototype = Object.getPrototypeOf(this)
  const methods = Object.getOwnPropertyNames(Serializer.prototype)
    .filter(name => name !== 'constructor')

  Object.assign(prototype, methods.reduce((proxy, method) => {
    const isInput = inputMethods.has(method)

    proxy[method] = proxyMethod.bind(this, { method, isInput })

    return proxy
  }, {}))
}


// Internal proxy method to call serializer method based on context.
function proxyMethod (options, context, ...args) {
  const { types, defaultSerializer } = this
  const { isInput, method } = options
  const format = context.request[isInput ?
    'serializerInput' : 'serializerOutput']
  let serializer

  // If a serializer is specified, use it.
  if (format in types) serializer = types[format]

  // Fall back to default serializer.
  else if (!format) serializer = defaultSerializer

  // Fail if no serializer was found.
  else {
    const NoopError = isInput ?
      UnsupportedError : NotAcceptableError

    return Promise.reject(
      new NoopError(`The serializer for "${format}" is unrecognized.`))
  }

  try {
    return Promise.resolve(serializer[method](context, ...args))
  }
  catch (e) {
    let error = e

    // Only in the special case of input methods, it may be more appropriate to
    // throw a BadRequestError.
    if (nativeErrors.has(error.constructor) && isInput)
      error = new BadRequestError(`The request is malformed.`)

    return Promise.reject(error)
  }
}
