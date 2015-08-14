import uriTemplates from 'uri-templates'
import inflection from 'inflection'
import { mediaType, reservedKeys, defaults } from './settings'
import { initializeContext, showLinks, showQueries,
  mapRecord, attachIncluded, encodeRoute } from './helpers'
import { castValue } from '../common'
import { includes } from '../../../common/array_proxy'


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
    for (let key in defaults)
      if (!(key in options))
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

    const { keys, methods, options, uriTemplate,
      errors: { NotFoundError } } = this
    const { queries, prefix, inflectPath } = options
    const { request, request: { method, type, ids, relatedField },
      response, response: { updateModified } } = context

    // Handle a not found error.
    if (ids && ids.length && method === methods.find &&
      !relatedField && !records.length)
      throw new NotFoundError(`No records match the request.`)

    // Delete and update requests may not respond with anything.
    if (method === methods.delete ||
    (method === methods.update && !updateModified))
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

    response.payload = output

    return context
  }


  showError (context, error) {
    const { errors: { MethodError } } = this
    const { name, message } = error
    const output = {}

    if (error.constructor === MethodError)
      this.showAllow(context)

    output[reservedKeys.error] = Object.assign({},
      name ? { name } : null,
      message ? { message } : null,
      error)

    context.response.payload = output

    return context
  }


  parseCreate (context) {
    const { keys, recordTypes, options,
      errors: { MethodError, BadRequestError } } = this
    const { request: { type, ids, payload, relatedField } } = context

    if (ids) throw new MethodError(
      `Can not create with IDs in the route.`)

    if (relatedField) throw new MethodError(
      `Can not create related record.`)

    const fields = recordTypes[type]
    const records = payload[reservedKeys.graph].map(record => {
      if (record[reservedKeys.type] !== type) throw new BadRequestError(
        `The field "${reservedKeys.type}" must be valued as "${type}".`)

      for (let field in record) {
        if (field in fields && fields[field][keys.link]) {
          if (!(keys.primary in record[field]))
            throw new BadRequestError(`The field "${field}" must be an ` +
              `object containing at least the key "${keys.primary}".`)

          record[field] = record[field][keys.primary]
          continue
        }
        record[field] = castValue.call(this, record[field], field in fields ?
          fields[field][keys.type] : null, options)
      }

      return record
    })

    return records
  }


  parseUpdate (context) {
    const { request: { payload, type, ids } } = context
    const { keys, options, recordTypes,
      errors: { BadRequestError } } = this
    const fields = recordTypes[type]

    return payload[reservedKeys.graph].map(update => {
      if (update[reservedKeys.type] !== type) throw new BadRequestError(
        `The field "${reservedKeys.type}" must be valued as "${type}".`)

      const clone = {}
      const id = update[keys.primary]

      if (!id) throw new BadRequestError(`An ID is missing.`)

      if (ids && !includes(ids, id))
        throw new BadRequestError(`The requested ID "${id}" is ` +
          `not addressable.`)

      clone.id = id

      const replace = {}
      const cast = (type, options) => value =>
        castValue.call(this, value, type, options)

      for (let field in update) {
        const fieldDefinition = fields[field]
        const value = update[field]

        if (fieldDefinition && keys.link in fieldDefinition) {
          if (!(keys.primary in value))
            throw new BadRequestError(`The field "${field}" must be an ` +
              `object containing at least the key "${keys.primary}".`)

          replace[field] = value[keys.primary]
          continue
        }

        const fieldType = fieldDefinition ?
          fieldDefinition[keys.type] : null

        replace[field] = Array.isArray(value) ?
          value.map(cast(fieldType, options)) :
          castValue.call(this, value, fieldType, options)
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
