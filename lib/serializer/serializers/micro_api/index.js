import uriTemplates from 'uri-templates'
import inflection from 'inflection'
import { mediaType, reservedKeys, defaults } from './settings'
import { initializeContext, showLinks, showQueries,
  mapRecord, attachIncluded, castValue, encodeRoute } from './helpers'
import * as arrayProxy from '../../../common/array_proxy'


export default Serializer => Object.assign(
class MicroApiSerializer extends Serializer {

  constructor () {
    super(...arguments)

    const { options, methods } = this

    const methodMap = {
      GET: methods.find,
      POST: methods.create,
      PATCH: methods.update,
      DELETE: methods.delete,
      OPTIONS: this.showAllow.bind(this)
    }

    // Set options.
    for (let key in defaults) if (!(key in options))
      options[key] = defaults[key]

    const uriTemplate = uriTemplates(options ?
      options.uriTemplate : null || defaults.uriTemplate)

    Object.defineProperties(this, {

      // Parse the URI template.
      uriTemplate: { value: uriTemplate },

      // Default method mapping.
      methodMap: { value: methodMap },

      // Methods which may accept input.
      inputMethods: { value: new Set([ methods.create, methods.update ]) }

    })
  }


  processRequest (context) {
    // If the request was initiated without HTTP arguments, this is a no-op.
    if (arguments.length === 1) return context

    const request = arguments[1]

    return initializeContext.call(this, context, request)
  }


  showAllow (context) {
    const { options: { allowLevel } } = this
    const { uriObject } = context.request

    delete uriObject.query

    const degree = Object.keys(uriObject)
      .filter(key => uriObject[key]).length

    const allow = allowLevel[degree]

    if (allow) context.response.meta['Allow'] = allow.join(', ')

    return context
  }


  showIndex (context) {
    const { recordTypes } = this
    const output = { [reservedKeys.links]: {} }

    for (let type in recordTypes)
      output[reservedKeys.links][type] = showLinks.call(this, type)

    context.response.payload = output

    return context
  }


  showResponse (context, records, include) {
    if (!records) return this.showIndex(context)

    const { keys, methods, errors, options, uriTemplate } = this
    const { queries, prefix, inflectPath } = options
    const { request, response } = context
    const { method, type, ids, relatedField } = request

    // Handle a not found error.
    if (ids && ids.length && method === methods.find &&
      !relatedField && !records.length)
      throw new errors.NotFoundError(`No records match the request.`)

    // Delete and update requests shouldn't respond with anything.
    if (method === methods.delete || method === methods.update)
      return context

    // Create method should include location header.
    if (method === methods.create)
      response.meta['Location'] = prefix +
        encodeRoute(uriTemplate.fillFromObject({
          type: inflectPath ? inflection.pluralize(type) : type,
          ids: records.map(record => record[keys.primary])
        }), options.obfuscateURIs)

    const output = { [reservedKeys.meta]: {}, [reservedKeys.graph]: [] }

    // If showing a collection, display the count.
    if (!ids && method !== methods.create)
      output[reservedKeys.meta].count = records.count

    // For the find method, it may be helpful to show available queries.
    if (method === methods.find)
      Object.assign(output[reservedKeys.meta], showQueries(queries, request))

    // At least one type will be present.
    output[reservedKeys.graph].push(
      ...records.map(record => mapRecord.call(this, type, record)))

    if (include) for (let includeType in include)
      output[reservedKeys.graph].push(...include[includeType]
        .map(mapRecord.bind(this, includeType))
        .map(attachIncluded))

    if (!Object.keys(output[reservedKeys.meta]).length)
      delete output[reservedKeys.meta]

    context.response.payload = output

    return context
  }


  showError (context, error) {
    const { nativeErrors, MethodError } = this.errors
    const { name, message } = error
    const output = {}

    if (error.constructor === MethodError)
      this.showAllow(context)

    output[reservedKeys.error] = !nativeErrors.has(error.constructor) ?
      Object.assign({},
        name ? { name } : null,
        message ? { message } : null,
        error) :
      {
        name: 'Error',
        message: 'An internal server error occured.'
      }

    context.response.payload = output

    return context
  }


  parseCreate (context) {
    const { keys, errors, recordTypes, options } = this
    const { type, ids, payload, relatedField } = context.request

    if (ids) throw new errors.MethodError(
      `Can not create with IDs in the route.`)

    if (relatedField) throw new errors.MethodError(
      `Can not create related record.`)

    const fields = recordTypes[type]
    const records = payload[reservedKeys.graph].map(record => {
      if (record[reservedKeys.type] !== type) throw new errors.BadRequestError(
        `The field "${reservedKeys.type}" must be valued as "${type}".`)

      for (let field in record) {
        if (field in fields && fields[field][keys.link]) {
          record[field] = record[field][keys.primary]
          continue
        }
        record[field] = castValue(record[field], field in fields ?
          fields[field][keys.type] : null, options)
      }

      return record
    })

    return records
  }


  parseUpdate (context) {
    const { payload, type, ids } = context.request
    const { keys, errors, options, recordTypes } = this
    const fields = recordTypes[type]

    return payload[reservedKeys.graph].map(update => {
      if (update[reservedKeys.type] !== type) throw new errors.BadRequestError(
        `The field "${reservedKeys.type}" must be valued as "${type}".`)

      const clone = {}
      const id = update[keys.primary]

      if (!id) throw new errors.BadRequestError(`An ID is missing.`)

      if (ids && !arrayProxy.includes(ids, id))
        throw new errors.BadRequestError(`The requested ID "${id}" is ` +
          `not addressable.`)

      clone.id = id

      const replace = {}
      const cast = (type, options) => value =>
        castValue(value, type, options)

      for (let field in update) {
        const fieldDefinition = fields[field]
        const value = update[field]

        if (fieldDefinition && keys.link in fieldDefinition) {
          replace[field] = value[keys.primary]
          continue
        }

        const fieldType = fieldDefinition ?
          fieldDefinition[keys.type] : null

        replace[field] = Array.isArray(value) ?
          value.map(cast(fieldType, options)) :
          castValue(value, fieldType, options)
      }

      clone.replace = replace

      const operate = update[reservedKeys.operate]

      if (operate) {
        clone.push = operate.push
        clone.pull = operate.pull
      }

      return clone
    })
  }

}, { id: mediaType })
